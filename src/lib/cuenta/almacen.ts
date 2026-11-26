/**
 * Almacén de cuentas sobre la base operativa del sitio (`SABLY_DB`: `sably.db`
 * en Node, D1 en Workers). Tablas `account_*` de `migrations/0011_cuenta.sql`.
 * Solo lo usan las rutas de cuenta: ninguna página pública consulta la sesión.
 */
import { createHash } from 'node:crypto';
import {
  CODIGO_ESPERA, CODIGO_INTENTOS, CODIGO_SEGUNDOS, LIMITE_CODIGO_CORREO_HORA, LIMITE_CODIGO_IP_HORA, LIMITE_CODIGO_TOTAL_HORA,
  codigoAleatorio, codigoValido,
  LIMITE_IP_HORA, LIMITE_TOTAL_HORA, OAUTH_SEGUNDOS, SESION_RENOVAR_SI_QUEDAN, SESION_SEGUNDOS, SESION_TOPE,
  base64url, bytesAleatorios, mismoValor, normalizarCorreo, resumen, tokenAleatorio, tokenValido,
} from './nucleo';

export interface CuentaActual {
  id: number;
  email: string;
  nombre: string;
  foto: string | null;
  /** Segundos que le quedan a la sesión tras renovarla (para la cookie). */
  quedan: number;
  /** La sesión se acaba de renovar: la ruta debe reescribir la cookie. */
  renovada: boolean;
}

export interface IdentidadGoogle {
  email: string;
  sub: string;
  nombre: string;
  foto: string | null;
  /** `@gmail.com` o cuenta de Google Workspace (`hd`): vincula directo a una cuenta existente. */
  autoritativo: boolean;
}

export type ResultadoEntrada =
  | { ok: true; token: string; nueva: boolean; cuenta: number }
  | { ok: false; aviso: 'google-otra' | 'bloqueada' };

export type ResultadoCodigo = { ok: true; codigo: string } | { ok: false; aviso: 'correo-espera' | 'espera' };
export type ResultadoVerificacion = { ok: true; email: string } | { ok: false; aviso: 'codigo-malo' | 'codigo-caducado' | 'codigo-intentos' };

export interface Consentimiento { texto: string; version: string; ip: string | null }

/** Documento de preferencias (preferencias.md §5.1); Sably ofrece solo `pais`. */
export interface Preferencias { v: 1; pais?: string; t?: { pais?: number } }

const fila = <T>(valor: unknown) => valor as T | null;

export class CuentaAlmacen {
  constructor(private readonly db: D1Database, private readonly secreto: string, private readonly esquema?: string) {
    if (secreto.length < 32) throw new Error('Falta la clave de la cuenta (SABLY_AUTH_SECRET, 32 caracteres o más).');
  }

  private h(ambito: string, valor: string) { return resumen(this.secreto, ambito, valor); }

  /** Crea las tablas si faltan (todo IF NOT EXISTS): el servidor Node no aplica migraciones de D1. */
  async asegurarEsquema(): Promise<void> {
    if (!this.esquema) return;
    if (await this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='account_pending_passwords'").first()) return;
    // El esquema no lleva «;» dentro de textos: se parte por sentencias y va en un solo lote.
    const sentencias = this.esquema.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
    await this.db.batch(sentencias.map(s => this.db.prepare(s)));
  }

  /** Cuenta las peticiones de una clave por hora; false si se pasa del límite. */
  async permitir(clave: string, maximo: number, ahora: number, ventana = 3600): Promise<boolean> {
    const key = this.h('limite', clave);
    const actual = fila<{ started: number; requests: number }>(await this.db.prepare('SELECT started, requests FROM account_rates WHERE key = ?').bind(key).first());
    if (!actual || actual.started + ventana <= ahora) {
      await this.db.prepare('INSERT INTO account_rates (key, started, requests) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET started = excluded.started, requests = 1').bind(key, ahora).run();
      return true;
    }
    if (actual.requests >= maximo) return false;
    await this.db.prepare('UPDATE account_rates SET requests = requests + 1 WHERE key = ?').bind(key).run();
    return true;
  }

  /** Límites del inicio con Google: por IP (la que fija nginx) y del sitio entero. */
  async permitirInicio(ip: string, ahora: number): Promise<boolean> {
    return (await this.permitir('total', LIMITE_TOTAL_HORA, ahora)) && (await this.permitir(`ip:${ip}`, LIMITE_IP_HORA, ahora));
  }

  /** Guarda `state`, `nonce` y el verificador PKCE del flujo, atados a la cookie `flow`. */
  async iniciarGoogle(flujo: string, ahora: number) {
    if (!tokenValido(flujo)) throw new Error('Flujo inválido.');
    const state = tokenAleatorio(), nonce = tokenAleatorio(), verifier = base64url(bytesAleatorios(48));
    await this.db.batch([
      // Limpieza de paso (índices o claves primarias pequeñas): flujos, códigos, límites y sesiones caducados.
      this.db.prepare('DELETE FROM account_oauth WHERE expires <= ?').bind(ahora),
      this.db.prepare('DELETE FROM account_codes WHERE expires <= ?').bind(ahora),
      this.db.prepare('DELETE FROM account_rates WHERE started <= ?').bind(ahora - 3600),
      this.db.prepare('DELETE FROM account_sessions WHERE expires <= ?').bind(ahora),
      this.db.prepare('INSERT OR REPLACE INTO account_oauth (flow, state, nonce, verifier, expires) VALUES (?, ?, ?, ?, ?)')
        .bind(this.h('oauth', flujo), this.h('state', state), nonce, verifier, ahora + OAUTH_SEGUNDOS),
    ]);
    return { state, nonce, verifier };
  }

  /** Un solo uso: la fila se borra siempre; vale solo con el mismo navegador, el mismo `state` y a tiempo. */
  async consumirGoogle(flujo: string, state: string, ahora: number): Promise<{ nonce: string; verifier: string } | null> {
    if (!tokenValido(flujo) || !tokenValido(state)) return null;
    const clave = this.h('oauth', flujo);
    const registro = fila<{ state: string; nonce: string; verifier: string; expires: number }>(
      await this.db.prepare('SELECT state, nonce, verifier, expires FROM account_oauth WHERE flow = ?').bind(clave).first());
    await this.db.prepare('DELETE FROM account_oauth WHERE flow = ?').bind(clave).run();
    if (!registro || registro.expires <= ahora || !mismoValor(registro.state, this.h('state', state))) return null;
    return { nonce: registro.nonce, verifier: registro.verifier };
  }

  private nuevaSesion(cuenta: number, ahora: number) {
    const token = tokenAleatorio();
    return {
      token,
      sentencia: this.db.prepare('INSERT INTO account_sessions (token, account, started, expires) VALUES (?, ?, ?, ?)')
        .bind(this.h('sesion', token), cuenta, ahora, ahora + SESION_SEGUNDOS),
    };
  }

  /**
   * Una sola cuenta por correo (contrato §3): la identidad de Google ya enlazada entra;
   * si no, un correo autoritativo se enlaza a la cuenta que ya tenga ese correo; si no
   * hay cuenta, se crea. Un correo no autoritativo que ya tiene cuenta necesita el código
   * por correo: se le pide entrar con su correo (aviso «google-otra»).
   */
  async entrarConGoogle(id: IdentidadGoogle, ahora: number, consentimiento: Consentimiento, pais?: string): Promise<ResultadoEntrada> {
    const email = normalizarCorreo(id.email);
    if (!email || !id.sub || id.sub.length > 255) throw new Error('Identidad incompleta.');
    const enlazada = fila<{ account: number; status: string }>(await this.db.prepare(
      'SELECT a.id AS account, a.status FROM account_identities i JOIN accounts a ON a.id = i.account WHERE i.provider = ? AND i.subject = ?',
    ).bind('google', id.sub).first());
    let cuenta = enlazada?.account ?? null;
    let estado = enlazada?.status ?? null;
    if (cuenta === null) {
      const porCorreo = fila<{ id: number; status: string }>(await this.db.prepare('SELECT id, status FROM accounts WHERE email = ?').bind(email).first());
      if (porCorreo) {
        if (!id.autoritativo) return { ok: false, aviso: 'google-otra' };
        cuenta = porCorreo.id; estado = porCorreo.status;
      }
    }
    if (estado === 'blocked') return { ok: false, aviso: 'bloqueada' };

    if (cuenta === null) {
      return this.crear(email, ahora, consentimiento, pais, nueva => [
        this.db.prepare('INSERT INTO account_identities (account, provider, subject, email, name, picture, linked) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(nueva, 'google', id.sub, email, id.nombre, id.foto, ahora),
        this.db.prepare('INSERT INTO account_profiles (account, display_name) VALUES (?, ?)').bind(nueva, id.nombre),
      ]);
    }

    const sesion = this.nuevaSesion(cuenta, ahora);
    await this.db.batch([
      this.db.prepare(`INSERT INTO account_identities (account, provider, subject, email, name, picture, linked) VALUES (?, 'google', ?, ?, ?, ?, ?)
        ON CONFLICT(provider, subject) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`)
        .bind(cuenta, id.sub, email, id.nombre, id.foto, ahora),
      this.db.prepare('UPDATE accounts SET last_login = ? WHERE id = ?').bind(ahora, cuenta),
      this.db.prepare('DELETE FROM account_sessions WHERE account = ? AND expires <= ?').bind(cuenta, ahora),
      sesion.sentencia,
    ]);
    return { ok: true, token: sesion.token, nueva: false, cuenta };
  }

  /** Crea la cuenta con su constancia de consentimiento, sus preferencias iniciales y la primera sesión. */
  private async crear(email: string, ahora: number, consentimiento: Consentimiento, pais: string | undefined,
    extra: (cuenta: number) => D1PreparedStatement[]): Promise<ResultadoEntrada> {
    const creada = fila<{ id: number }>(await this.db.prepare('INSERT INTO accounts (email, created, last_login) VALUES (?, ?, ?) RETURNING id').bind(email, ahora, ahora).first());
    if (!creada) throw new Error('No se pudo crear la cuenta.');
    const cuenta = Number(creada.id);
    const sesion = this.nuevaSesion(cuenta, ahora);
    const iniciales: D1PreparedStatement[] = [
      ...extra(cuenta),
      this.db.prepare('INSERT INTO account_consents (account, purpose, text_version, text, granted_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(cuenta, 'cuenta', consentimiento.version, consentimiento.texto, ahora, consentimiento.ip ? this.h('ip', consentimiento.ip) : null),
      sesion.sentencia,
    ];
    // Preferencias: se siembran con lo que la persona ya eligió en este dispositivo (preferencias.md §5.4).
    if (pais) iniciales.push(this.db.prepare('INSERT INTO account_prefs (account, doc, version, updated) VALUES (?, ?, 1, ?)')
      .bind(cuenta, JSON.stringify({ v: 1, pais, t: { pais: ahora } } satisfies Preferencias), ahora));
    try {
      await this.db.batch(iniciales);
    } catch (error) {
      await this.db.prepare('DELETE FROM accounts WHERE id = ?').bind(cuenta).run();
      throw error;
    }
    return { ok: true, token: sesion.token, nueva: true, cuenta };
  }

  /**
   * Pide un código para entrar con el correo. Mismo resultado exista o no la cuenta (sin enumeración):
   * la cuenta se crea al validar el primer código. Espera de 60 s entre envíos en el mismo navegador y
   * límites por hora: 4 por correo, 20 por IP y 160 en el sitio.
   */
  async pedirCodigo(flujo: string, email: string, ip: string, ahora: number, claveHash?: string): Promise<ResultadoCodigo> {
    const correo = normalizarCorreo(email);
    if (!tokenValido(flujo) || !correo) throw new Error('Petición de código inválida.');
    const clave = this.h('codigo-flujo', flujo);
    const previo = fila<{ sent: number }>(await this.db.prepare('SELECT sent FROM account_codes WHERE flow = ?').bind(clave).first());
    if (previo && previo.sent + CODIGO_ESPERA > ahora) return { ok: false, aviso: 'correo-espera' };
    if (!(await this.permitir('codigo:total', LIMITE_CODIGO_TOTAL_HORA, ahora))
      || !(await this.permitir(`codigo:ip:${ip}`, LIMITE_CODIGO_IP_HORA, ahora))
      || !(await this.permitir(`codigo:correo:${correo}`, LIMITE_CODIGO_CORREO_HORA, ahora))) return { ok: false, aviso: 'espera' };
    const codigo = codigoAleatorio();
    await this.db.batch([
      this.db.prepare('DELETE FROM account_codes WHERE expires <= ?').bind(ahora),
      this.db.prepare('INSERT OR REPLACE INTO account_codes (flow, email, code, expires, attempts, sent) VALUES (?, ?, ?, ?, 0, ?)')
        .bind(clave, correo, this.h('codigo', `${flujo}\0${correo}\0${codigo}`), ahora + CODIGO_SEGUNDOS, ahora),
      this.db.prepare('DELETE FROM account_pending_passwords WHERE flow = ? OR expires <= ?').bind(clave, ahora),
      // Alta u «olvidé mi contraseña»: la contraseña nueva espera al código en este mismo navegador.
      ...(claveHash ? [this.db.prepare('INSERT INTO account_pending_passwords (flow, hash, expires) VALUES (?, ?, ?)').bind(clave, claveHash, ahora + CODIGO_SEGUNDOS)] : []),
    ]);
    return { ok: true, codigo };
  }

  /** Si el correo no salió, el código se descarta para poder pedir otro sin esperar. */
  async olvidarCodigo(flujo: string): Promise<void> {
    if (!tokenValido(flujo)) return;
    const clave = this.h('codigo-flujo', flujo);
    await this.db.batch([
      this.db.prepare('DELETE FROM account_codes WHERE flow = ?').bind(clave),
      this.db.prepare('DELETE FROM account_pending_passwords WHERE flow = ?').bind(clave),
    ]);
  }

  /** El código pendiente de este navegador: a qué correo se envió y cuánto falta para poder reenviar. */
  async codigoPendiente(flujo: string, ahora: number): Promise<{ email: string; reenviarEn: number; clave: boolean } | null> {
    if (!tokenValido(flujo)) return null;
    const r = fila<{ email: string; expires: number; sent: number; clave: number }>(await this.db.prepare(
      'SELECT c.email, c.expires, c.sent, EXISTS (SELECT 1 FROM account_pending_passwords p WHERE p.flow = c.flow) AS clave FROM account_codes c WHERE c.flow = ?',
    ).bind(this.h('codigo-flujo', flujo)).first());
    return r && r.expires > ahora ? { email: r.email, reenviarEn: Math.max(0, r.sent + CODIGO_ESPERA - ahora), clave: !!r.clave } : null;
  }

  /** La contraseña que esperaba al código de este navegador (un solo uso). */
  async tomarClavePendiente(flujo: string, ahora: number): Promise<string | null> {
    if (!tokenValido(flujo)) return null;
    const r = fila<{ hash: string }>(await this.db.prepare('DELETE FROM account_pending_passwords WHERE flow = ? AND expires > ? RETURNING hash')
      .bind(this.h('codigo-flujo', flujo), ahora).first());
    return r?.hash ?? null;
  }

  /** Cuenta y hash de la contraseña de un correo (null si no hay cuenta o no tiene contraseña). */
  async claveDe(email: string): Promise<{ cuenta: number; status: string; hash: string } | null> {
    const r = fila<{ cuenta: number; status: string; hash: string }>(await this.db.prepare(
      'SELECT a.id AS cuenta, a.status, p.hash FROM accounts a JOIN account_passwords p ON p.account = a.id WHERE a.email = ?',
    ).bind(normalizarCorreo(email)).first());
    return r ? { cuenta: Number(r.cuenta), status: r.status, hash: r.hash } : null;
  }

  async hashDeCuenta(cuenta: number): Promise<string | null> {
    return fila<{ hash: string }>(await this.db.prepare('SELECT hash FROM account_passwords WHERE account = ?').bind(cuenta).first())?.hash ?? null;
  }

  /**
   * Guarda la contraseña y cierra todas las sesiones de la cuenta salvo `conservar` (la de este navegador,
   * ya rotada). Para rehacer un hash antiguo sin cambiar la contraseña, `cerrarSesiones` = false.
   */
  async fijarClave(cuenta: number, hash: string, ahora: number, conservar?: string, cerrarSesiones = true): Promise<void> {
    const sentencias = [this.db.prepare('INSERT INTO account_passwords (account, hash, updated) VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET hash = excluded.hash, updated = excluded.updated')
      .bind(cuenta, hash, ahora)];
    if (cerrarSesiones) sentencias.push(conservar && tokenValido(conservar)
      ? this.db.prepare('DELETE FROM account_sessions WHERE account = ? AND token <> ?').bind(cuenta, this.h('sesion', conservar))
      : this.db.prepare('DELETE FROM account_sessions WHERE account = ?').bind(cuenta));
    await this.db.batch(sentencias);
  }

  /** Sesión nueva para una cuenta existente (entrada con contraseña o tras cambiarla). */
  async sesionNueva(cuenta: number, ahora: number): Promise<string> {
    const sesion = this.nuevaSesion(cuenta, ahora);
    await this.db.batch([
      this.db.prepare('UPDATE accounts SET last_login = ? WHERE id = ?').bind(ahora, cuenta),
      this.db.prepare('DELETE FROM account_sessions WHERE account = ? AND expires <= ?').bind(cuenta, ahora),
      sesion.sentencia,
    ]);
    return sesion.token;
  }

  /** Cinco intentos por código; al acertar, el código se borra (un solo uso). Comparación en tiempo constante. */
  async verificarCodigo(flujo: string, codigo: string, ahora: number): Promise<ResultadoVerificacion> {
    if (!tokenValido(flujo)) return { ok: false, aviso: 'codigo-caducado' };
    const clave = this.h('codigo-flujo', flujo);
    // El intento se cuenta antes de comparar y de forma atómica: dos peticiones a la vez no ganan intentos.
    const r = fila<{ email: string; code: string; attempts: number }>(await this.db.prepare(
      'UPDATE account_codes SET attempts = attempts + 1 WHERE flow = ? AND attempts < ? AND expires > ? RETURNING email, code, attempts',
    ).bind(clave, CODIGO_INTENTOS, ahora).first());
    if (!r) {
      const resto = fila<{ attempts: number; expires: number }>(await this.db.prepare('SELECT attempts, expires FROM account_codes WHERE flow = ?').bind(clave).first());
      await this.db.prepare('DELETE FROM account_codes WHERE flow = ?').bind(clave).run();
      return { ok: false, aviso: resto && resto.expires > ahora && resto.attempts >= CODIGO_INTENTOS ? 'codigo-intentos' : 'codigo-caducado' };
    }
    const acierto = codigoValido(codigo) && mismoValor(r.code, this.h('codigo', `${flujo}\0${r.email}\0${codigo}`));
    if (!acierto) {
      if (r.attempts < CODIGO_INTENTOS) return { ok: false, aviso: 'codigo-malo' };
      await this.db.prepare('DELETE FROM account_codes WHERE flow = ?').bind(clave).run();
      return { ok: false, aviso: 'codigo-intentos' };
    }
    await this.db.prepare('DELETE FROM account_codes WHERE flow = ?').bind(clave).run();
    return { ok: true, email: r.email };
  }

  /**
   * Entrar con un correo ya confirmado por código. El código prueba que la persona controla ese correo,
   * así que entra en la cuenta que tenga ese correo, la creara con Google o con código (una cuenta por correo).
   */
  async entrarConCorreo(email: string, ahora: number, consentimiento: Consentimiento, pais?: string): Promise<ResultadoEntrada> {
    const correo = normalizarCorreo(email);
    if (!correo) throw new Error('Correo inválido.');
    const existente = fila<{ id: number; status: string }>(await this.db.prepare('SELECT id, status FROM accounts WHERE email = ?').bind(correo).first());
    if (!existente) return this.crear(correo, ahora, consentimiento, pais, () => []);
    if (existente.status === 'blocked') return { ok: false, aviso: 'bloqueada' };
    const cuenta = Number(existente.id);
    return { ok: true, token: await this.sesionNueva(cuenta, ahora), nueva: false, cuenta };
  }

  /** Formas de acceso de la cuenta: el correo siempre; Google si hay identidad enlazada; contraseña si tiene. */
  async formasDeAcceso(cuenta: number): Promise<{ google: boolean; clave: boolean }> {
    const [google, clave] = await Promise.all([
      this.db.prepare("SELECT 1 FROM account_identities WHERE account = ? AND provider = 'google'").bind(cuenta).first(),
      this.db.prepare('SELECT 1 FROM account_passwords WHERE account = ?').bind(cuenta).first(),
    ]);
    return { google: !!google, clave: !!clave };
  }

  /** La cuenta de una sesión vigente; renueva a 30 días si quedan menos de 15, sin pasar del tope de 90. */
  async cuenta(token: string, ahora: number): Promise<CuentaActual | null> {
    if (!tokenValido(token)) return null;
    const clave = this.h('sesion', token);
    const r = fila<{ id: number; email: string; status: string; started: number; expires: number; nombre: string | null; foto: string | null }>(await this.db.prepare(
      `SELECT a.id, a.email, a.status, s.started, s.expires,
              COALESCE(NULLIF(p.display_name, ''), (SELECT name FROM account_identities WHERE account = a.id ORDER BY linked DESC LIMIT 1)) AS nombre,
              (SELECT picture FROM account_identities WHERE account = a.id AND picture IS NOT NULL ORDER BY linked DESC LIMIT 1) AS foto
         FROM account_sessions s JOIN accounts a ON a.id = s.account LEFT JOIN account_profiles p ON p.account = a.id
        WHERE s.token = ?`,
    ).bind(clave).first());
    if (!r) return null;
    if (r.expires <= ahora || r.status !== 'active') {
      await this.db.prepare('DELETE FROM account_sessions WHERE token = ?').bind(clave).run();
      return null;
    }
    let expires = r.expires, renovada = false;
    const tope = r.started + SESION_TOPE;
    if (r.expires - ahora < SESION_RENOVAR_SI_QUEDAN && r.expires < tope) {
      expires = Math.min(ahora + SESION_SEGUNDOS, tope);
      await this.db.prepare('UPDATE account_sessions SET expires = ? WHERE token = ?').bind(expires, clave).run();
      renovada = true;
    }
    return { id: Number(r.id), email: r.email, nombre: r.nombre ?? '', foto: r.foto, quedan: expires - ahora, renovada };
  }

  /** Cuántas sesiones sin vencer tiene la cuenta (solo lectura: lo enseña Preferencias). */
  async sesionesAbiertas(cuenta: number, ahora: number): Promise<number> {
    const r = fila<{ n: number }>(await this.db.prepare('SELECT count(*) AS n FROM account_sessions WHERE account = ? AND expires > ?').bind(cuenta, ahora).first());
    return Number(r?.n ?? 0);
  }

  async revocar(token: string): Promise<void> {
    if (tokenValido(token)) await this.db.prepare('DELETE FROM account_sessions WHERE token = ?').bind(this.h('sesion', token)).run();
  }

  async revocarTodas(cuenta: number): Promise<void> {
    await this.db.prepare('DELETE FROM account_sessions WHERE account = ?').bind(cuenta).run();
  }

  /** Borrado a petición: la cuenta y, en cascada, identidades, perfil, sesiones, guardados, preferencias y constancias. */
  async borrarCuenta(cuenta: number): Promise<void> {
    await this.db.prepare('DELETE FROM accounts WHERE id = ?').bind(cuenta).run();
  }

  async preferencias(cuenta: number): Promise<Preferencias> {
    const r = fila<{ doc: string }>(await this.db.prepare('SELECT doc FROM account_prefs WHERE account = ?').bind(cuenta).first());
    try { const doc = r ? JSON.parse(r.doc) : null; return doc && doc.v === 1 ? doc : { v: 1 }; } catch { return { v: 1 }; }
  }

  async guardarPais(cuenta: number, pais: string | null, ahora: number): Promise<Preferencias> {
    const doc: Preferencias = pais ? { v: 1, pais, t: { pais: ahora } } : { v: 1, t: { pais: ahora } };
    await this.db.prepare('INSERT INTO account_prefs (account, doc, version, updated) VALUES (?, ?, 1, ?) ON CONFLICT(account) DO UPDATE SET doc = excluded.doc, version = 1, updated = excluded.updated')
      .bind(cuenta, JSON.stringify(doc), ahora).run();
    return doc;
  }

  async guardados(cuenta: number): Promise<string[]> {
    const { results } = await this.db.prepare('SELECT item FROM account_saves WHERE account = ? ORDER BY created DESC LIMIT 200').bind(cuenta).all<{ item: string }>();
    return results.map(r => r.item);
  }

  async guardar(cuenta: number, item: string, ahora: number): Promise<void> {
    await this.db.prepare('INSERT OR IGNORE INTO account_saves (account, item, created) VALUES (?, ?, ?)').bind(cuenta, item, ahora).run();
  }

  async quitar(cuenta: number, item: string): Promise<void> {
    await this.db.prepare('DELETE FROM account_saves WHERE account = ? AND item = ?').bind(cuenta, item).run();
  }
}

/** PKCE S256 (RFC 7636). */
export const desafioPkce = (verificador: string) => createHash('sha256').update(verificador).digest('base64url');
