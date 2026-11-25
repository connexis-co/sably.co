/**
 * Almacén de cuentas sobre la base operativa del sitio (`SABLY_DB`: `sably.db`
 * en Node, D1 en Workers). Tablas `account_*` de `migrations/0011_cuenta.sql`.
 * Solo lo usan las rutas de cuenta: ninguna página pública consulta la sesión.
 */
import { createHash } from 'node:crypto';
import {
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
    if (await this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='account_consents'").first()) return;
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
      // Limpieza de paso (índices o claves primarias pequeñas): flujos, límites y sesiones caducados.
      this.db.prepare('DELETE FROM account_oauth WHERE expires <= ?').bind(ahora),
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
   * por correo (fase siguiente): hasta entonces no se mezcla nada.
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
      const creada = fila<{ id: number }>(await this.db.prepare('INSERT INTO accounts (email, created, last_login) VALUES (?, ?, ?) RETURNING id').bind(email, ahora, ahora).first());
      if (!creada) throw new Error('No se pudo crear la cuenta.');
      cuenta = Number(creada.id);
      const sesion = this.nuevaSesion(cuenta, ahora);
      const iniciales: D1PreparedStatement[] = [
        this.db.prepare('INSERT INTO account_identities (account, provider, subject, email, name, picture, linked) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(cuenta, 'google', id.sub, email, id.nombre, id.foto, ahora),
        this.db.prepare('INSERT INTO account_profiles (account, display_name) VALUES (?, ?)').bind(cuenta, id.nombre),
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
