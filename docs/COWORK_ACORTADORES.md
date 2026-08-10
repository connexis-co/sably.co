# Crear los acortadores de Hotmart con Claude Cowork

Guía para delegar a Cowork la creación de los ~140 acortadores (70 cursos × 2).

> **Por qué Cowork y no Claude Code:** el trabajo es UI repetitiva en el panel de
> Hotmart, sin API. Cowork corre en la nube y puede insistir durante horas sin que
> estés encima. Su contra: el navegador es tu Chrome **local**, así que el Mac tiene
> que estar despierto y con sesión de Hotmart abierta todo el rato.
>
> Si prefieres que termine en minutos y no en horas, usa el script:
> `node scripts/hotmart-acortadores.mjs --dry --limit 3`. Hace lo mismo sin round-trips.

---

## 1. Antes de abrir Cowork

- [ ] Claude Desktop (macOS) con Cowork disponible — planes Pro, Max, Team o Enterprise.
- [ ] Extensión **Claude in Chrome** instalada y conectada. Sin ella Cowork no puede
      conducir el panel de Hotmart.
- [ ] Sesión iniciada en `https://app.hotmart.com` con la cuenta de **Rodrigo Javier Misat**
      (es la que tiene la afiliación y a la que se le acredita la comisión).
- [ ] Carpeta conectada en Cowork: `~/Documents/JP Projects/sably.co`
      (o el worktree, si trabajas ahí). Necesita leer `docs/data/acortadores-plan.json`
      y escribir `docs/data/acortadores-resultado.json`.
- [ ] El Mac configurado para **no suspenderse**: Ajustes → Bloqueo de pantalla →
      "Apagar pantalla estando inactivo: Nunca" mientras dure el proceso.

---

## 2. El prompt para Cowork

Pégalo tal cual.

```
Necesito que crees acortadores de enlaces en el panel de Hotmart, uno por uno, y
que anotes el resultado. Trabaja en mi Chrome, donde ya tengo la sesión abierta.
No me pidas credenciales ni inicies sesión: si la sesión se cae, párate y avísame.

## Entrada

Lee el archivo docs/data/acortadores-plan.json de la carpeta conectada. Tiene ~70
entradas con esta forma:

{
  "slugSably": "curso-de-piano",
  "titulo": "Curso de Piano",
  "nombreProducto": "Aprende Piano",
  "slugCrashing": "aprende-piano-curso-crashing",
  "slugVentaSO": "aprende-piano-curso-venta-SO"
}

## Qué hacer por cada entrada

1. Ve a https://app.hotmart.com/products/affiliations (Productos → Soy Afiliado(a),
   pestaña "Afiliaciones confirmadas").
2. Busca por `nombreProducto`. Anota el ID que muestra la tarjeta (ej.: "ID 1186548").
   - Si NO aparece ningún producto que corresponda, marca la entrada como
     SIN_PRODUCTO y pasa a la siguiente. No inventes un producto parecido.
3. Entra al producto y abre "Links de divulgación (HotLinks)".
4. Copia la URL del bloque titulado exactamente:
   "Hotlink que lleva a sus prospectos al checkout limpio para crashing"
   Tiene la forma https://go.hotmart.com/XXXXXXXXX?ap=XXXX
   - Copia también la de "Hotlink que lleva a tus prospectos al checkout creado por
     Seminarios Online®" (esa es la de página de ventas, para el -venta-SO).
5. Pulsa "Acortar link" en ESE bloque y sigue el asistente:
   - Paso 1: deja el hotlink que ya viene y pon como título `<titulo> crashing`.
   - Paso 2: en el campo de después de "hotm.io/" escribe EXACTAMENTE el valor de
     `slugCrashing`. Ni más ni menos: ni mayúsculas, ni tildes, ni espacios.
   - Paso 3 (Summary): confirma con "End".
6. Repite el paso 5 para el hotlink de Seminarios Online, con título
   `<titulo> venta SO` y el slug `slugVentaSO`.
7. VERIFICA cada acortador creado: ábrelo en una pestaña y comprueba que la URL
   final cumple LAS DOS condiciones:
      - empieza por https://pay.hotmart.com/
      - contiene `?ref=` o `&ref=`
   Si falta el `ref`, la comisión se pierde: márcalo como CREADO_SIN_VERIFICAR y
   dime cuál fue.

## Si un producto no existe en mi cuenta

No lo fuerces. Búscalo en el Mercado de Afiliación por el nombre del curso y
propón un sustituto SOLO si cumple todo esto:
  - comisión mayor al 20% del precio,
  - tiene valoraciones reales (no 0 estrellas / 0 reseñas),
  - el tema corresponde de verdad al curso, no un parecido lejano.
Reúne los candidatos en una lista y ESPERA MI APROBACIÓN antes de afiliarte a
ninguno. Afiliarse modifica mi cuenta: no lo hagas por tu cuenta.

## Salida

Escribe docs/data/acortadores-resultado.json con un array de objetos así:

{
  "slugSably": "curso-de-piano",
  "idProducto": "1186548",
  "crashing": "https://hotm.io/aprende-piano-curso-crashing",
  "ventaSO": "https://hotm.io/aprende-piano-curso-venta-SO",
  "estado": "OK",
  "nota": "https://pay.hotmart.com/O44743118Q?ref=X107094071K"
}

Valores de `estado`: OK | SIN_PRODUCTO | SIN_HOTLINK | CREADO_SIN_VERIFICAR | ERROR
En `nota` pon la URL final verificada, o el motivo del fallo.

IMPORTANTE: guarda el archivo cada 10 entradas, no al final. Si la sesión se cae
a mitad no quiero perder lo hecho.

## Reglas

- Un acortador mal escrito manda al usuario a un enlace roto o sin comisión. Ante
  la duda, marca ERROR y sigue: prefiero un hueco a un enlace equivocado.
- Si Hotmart dice que el slug ya está tomado, NO inventes otro: anótalo como
  ERROR con el mensaje exacto y sigue.
- No borres ni edites acortadores que ya existan.
- Ve informándome del avance cada 10 cursos.
```

---

## 3. Cuando termine

1. Comprueba que existe `docs/data/acortadores-resultado.json`.
2. Regenera el Excel, que pinta en **rojo** todo lo que no quedó creado y verificado:

   ```bash
   python3 scripts/build-acortadores-xlsx.py
   ```

3. Vuelve a Claude Code y pídeme aplicar los enlaces en el sitio. Yo me encargo de
   escribir `hotmartUrl` y `hotmartRef` en cada curso, con sus variantes de país y
   ciudad, y de verificar que ninguno queda roto antes de desplegar.

---

## 4. Qué vigilar

| Señal | Qué significa |
|---|---|
| Muchos `SIN_PRODUCTO` | Los nombres del plan vienen del archivo de masterclasses.la, que ya no existe. Toca emparejarlos contra el catálogo vivo. |
| `CREADO_SIN_VERIFICAR` | El acortador existe pero no conserva `ref`. **No publicar**: esa venta no cobra comisión. |
| Slug ya tomado | Puede que el acortador ya existiera. Compruébalo en el Link Manager antes de crear otro. |

Referencia de la convención, verificada en vivo:

```
hotm.io/aprende-piano-curso-crashing  →  pay.hotmart.com/O44743118Q?ref=X107094071K
```
