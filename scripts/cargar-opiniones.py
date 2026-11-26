#!/usr/bin/env python3
"""Carga en `sably_public_review` los extractos de opiniones públicas de Hotmart elegidos por hotmart-opiniones.mjs.

Qué hace, por curso leído:
  - inserta los extractos elegidos (id `hotmart-ask-<ucode>`, aprobados, `created_at` = fecha de la evaluación);
  - pasa a `rejected` las filas de la captura anterior (`hotmart-<hash>`, cortadas a 120 caracteres en el checkout),
    con su entrada en `sably_public_review_log`. No borra nada que existiera.
Las opiniones de compradores de Sably (`course_review`) no se tocan.

Uso (stdlib, Python 3.9+; en connexis-prod corre en el host contra el volumen del contenedor):
  python3 cargar-opiniones.py --db /opt/stacks/sably-emdash/data/sably.db --datos carga-opiniones.json
      → modo de prueba: abre la base en solo lectura y dice qué haría.
  python3 cargar-opiniones.py --db … --datos … --aplicar [--respaldo DIR]
      → escribe primero DIR/respaldo-opiniones-<marca>.json y luego aplica todo en una transacción.
  python3 cargar-opiniones.py --db … --revertir DIR/respaldo-opiniones-<marca>.json
      → borra lo insertado y devuelve cada fila anterior a su estado (y quita las entradas del registro).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sqlite3
import sys
import time
from datetime import datetime, timezone

MODERADOR = 'carga-opiniones-hotmart'
NUEVO = 'hotmart-ask-'


def epoch(fecha: str) -> int:
    return int(datetime.strptime(fecha[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc).timestamp())


def conectar(ruta: str, solo_lectura: bool) -> sqlite3.Connection:
    if not pathlib.Path(ruta).is_file():
        sys.exit(f'No existe la base {ruta}')
    uri = f"file:{ruta}?mode={'ro' if solo_lectura else 'rw'}"
    con = sqlite3.connect(uri, uri=True)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA busy_timeout = 10000')
    if not con.execute("SELECT 1 FROM sqlite_master WHERE name='sably_public_review'").fetchone():
        sys.exit('La base no tiene la tabla sably_public_review: ¿es sably.db?')
    return con


def validar(datos: dict) -> list[dict]:
    filas = datos.get('opiniones') or []
    for f in filas:
        faltan = [k for k in ('id', 'slug', 'author_name', 'rating', 'body', 'source_url', 'review_date') if not f.get(k)]
        if faltan or not f['id'].startswith(NUEVO) or not 1 <= int(f['rating']) <= 5 or not f['source_url'].startswith('https://hotmart.com/'):
            sys.exit(f'Fila inválida en los datos: {f.get("id")} {faltan}')
    return filas


def plan(con: sqlite3.Connection, filas: list[dict], cursos: list[str]) -> dict:
    existentes = {r['id'] for r in con.execute(f"SELECT id FROM sably_public_review WHERE id LIKE '{NUEVO}%'")}
    marcas = ','.join('?' * len(cursos)) or "''"
    viejas = [dict(r) for r in con.execute(
        f"SELECT id,slug,status,moderated_at FROM sably_public_review WHERE slug IN ({marcas}) AND id LIKE 'hotmart-%' "
        f"AND id NOT LIKE '{NUEVO}%' AND status='approved'", cursos)]
    return {'insertar': [f for f in filas if f['id'] not in existentes], 'ya_estaban': sorted(existentes & {f['id'] for f in filas}), 'retirar': viejas}


def resumen(p: dict, filas: list[dict], cursos: list[str]) -> None:
    por = {}
    for f in filas:
        por[f['slug']] = por.get(f['slug'], 0) + 1
    print(f"Cursos leídos: {len(cursos)} · con extractos: {len(por)} · con 3 o más: {sum(1 for n in por.values() if n >= 3)}")
    print(f"Insertar: {len(p['insertar'])} · ya estaban: {len(p['ya_estaban'])} · retirar de la captura anterior: {len(p['retirar'])}")
    sin = sorted(set(cursos) - set(por))
    if sin:
        print(f"Cursos leídos sin extractos (el bloque mostrará su estado vacío): {len(sin)}")


def aplicar(con: sqlite3.Connection, p: dict, carpeta: pathlib.Path) -> pathlib.Path:
    marca = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    carpeta.mkdir(parents=True, exist_ok=True)
    respaldo = carpeta / f'respaldo-opiniones-{marca}.json'
    ahora = int(time.time())
    ids_viejos = [v['id'] for v in p['retirar']]
    huecos = ','.join('?' * len(ids_viejos)) or "''"
    filas_previas = [dict(r) for r in con.execute(f'SELECT * FROM sably_public_review WHERE id IN ({huecos})', ids_viejos)]
    respaldo.write_text(json.dumps({
        'marca': marca, 'moderador': MODERADOR, 'aplicado_en': ahora,
        'insertadas': [f['id'] for f in p['insertar']], 'retiradas': filas_previas,
    }, ensure_ascii=False, indent=1), 'utf-8')
    print(f'Respaldo: {respaldo}')
    with con:
        for f in p['insertar']:
            con.execute('INSERT INTO sably_public_review(id,slug,author_name,rating,body,source_url,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
                        (f['id'], f['slug'], f['author_name'], int(f['rating']), f['body'], f['source_url'], 'approved', epoch(f['review_date'])))
        for v in p['retirar']:
            con.execute("UPDATE sably_public_review SET status='rejected', moderated_at=? WHERE id=?", (ahora, v['id']))
            con.execute('INSERT INTO sably_public_review_log(id,entity,entity_id,from_status,to_status,moderator,reason,created_at) VALUES (?,?,?,?,?,?,?,?)',
                        (f'{MODERADOR}-{marca}-{v["id"]}', 'sably_public_review', v['id'], 'approved', 'rejected', MODERADOR,
                         'Sustituida por el texto completo de la evaluación pública en Hotmart (la captura anterior estaba cortada).', ahora))
    return respaldo


def revertir(con: sqlite3.Connection, ruta: pathlib.Path) -> None:
    r = json.loads(ruta.read_text('utf-8'))
    with con:
        for i in r['insertadas']:
            con.execute('DELETE FROM sably_public_review WHERE id=?', (i,))
        for v in r['retiradas']:
            con.execute('UPDATE sably_public_review SET status=?, moderated_at=? WHERE id=?', (v['status'], v['moderated_at'], v['id']))
        con.execute('DELETE FROM sably_public_review_log WHERE moderator=? AND id LIKE ?', (r['moderador'], f"{r['moderador']}-{r['marca']}-%"))
    print(f"Revertido: {len(r['insertadas'])} extractos quitados, {len(r['retiradas'])} filas devueltas a su estado.")


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--db', required=True)
    a.add_argument('--datos')
    a.add_argument('--aplicar', action='store_true')
    a.add_argument('--respaldo', default='respaldos-opiniones')
    a.add_argument('--revertir')
    o = a.parse_args()
    if o.revertir:
        revertir(conectar(o.db, False), pathlib.Path(o.revertir))
        return
    if not o.datos:
        a.error('--datos es obligatorio salvo con --revertir')
    datos = json.loads(pathlib.Path(o.datos).read_text('utf-8'))
    filas = validar(datos)
    cursos = sorted(set(datos.get('cursos_leidos') or []) | {f['slug'] for f in filas})
    con = conectar(o.db, not o.aplicar)
    p = plan(con, filas, cursos)
    resumen(p, filas, cursos)
    if not o.aplicar:
        print('Modo de prueba: no se escribió nada. Añade --aplicar para cargar.')
        return
    aplicar(con, p, pathlib.Path(o.respaldo))
    aprobadas = con.execute(f"SELECT COUNT(*) FROM sably_public_review WHERE id LIKE '{NUEVO}%' AND status='approved'").fetchone()[0]
    print(f'Hecho. Extractos aprobados de esta fuente en la base: {aprobadas}')


if __name__ == '__main__':
    main()
