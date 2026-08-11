# Prompt para Claude Cowork — Afiliación y acortadores de Hotmart

> Versión corregida del prompt original. Los cambios y el porqué están al final,
> en «Qué se corrigió del prompt original». Todo lo que aquí se afirma sobre el
> comportamiento de Hotmart se verificó en vivo el 2026-08-10.

---

## El prompt (pégalo tal cual en Cowork)

````markdown
Necesito que afilies mi cuenta de Hotmart a una lista de cursos y que crees dos
acortadores por cada uno, con una nomenclatura exacta. Trabaja en mi Chrome, donde
ya tengo la sesión abierta.

## Reglas que no se negocian

1. **No me pidas credenciales ni inicies sesión.** Si la sesión se cae, detente y avísame.
2. **Un acortador mal formado me hace perder la comisión.** Ante cualquier duda, no
   inventes: anota la fila como PENDIENTE y sigue con la siguiente.
3. **Guarda el avance después de CADA curso**, no al final. Son ~86 cursos; si algo
   se corta a mitad no puedo perder lo hecho.
4. No borres ni reordenes filas del archivo de entrada.

## Contexto: qué es cada enlace

Cada producto de Hotmart expone cuatro «hotlinks» en la página
`app.hotmart.com/hotlinks/<idProducto>`, SIEMPRE en este orden:

| # | Rótulo en pantalla | A dónde va de verdad | ¿Se usa? |
|---|---|---|---|
| 1 | Página de Ventas | `universidad.online/mauricioduque` | ❌ NO. Es la landing genérica del productor, no la del curso. |
| 2 | Página de Producto | marketplace de Hotmart (`?dp=1`) | ❌ No para esto |
| 3 | **checkout limpio para crashing** | `pay.hotmart.com/<ID>?ref=<HOTLINK>` | ✅ SÍ → acortador `-curso-crashing` |
| 4 | **checkout creado por Seminarios Online®** | `pay.hotmart.com/<ID>?checkoutMode=10&ref=<HOTLINK>` | ✅ SÍ → acortador `-curso-venta-SO` |

El sufijo `?ap=XXXX` cambia en cada producto, así que identifica los bloques por su
**rótulo**, no por el sufijo.

**El `ref=` es lo que acredita mi comisión.** Un enlace a `pay.hotmart.com/<ID>` sin
`ref` funciona igual de cara al comprador, pero la venta se le acredita al productor
y yo no cobro nada. Por eso la verificación final es comprobar que el `ref` sigue ahí.

## Entrada

El archivo `docs/data/afiliacion-seminarios.tsv` de la carpeta conectada. Tres columnas
separadas por tabulador:

```
slug_sably                     codigo_afiliacion   nombre_en_el_club
curso-de-ingles                1946I42584758       ⚫ Ingles para Principiantes
curso-de-sushi                 5180S46888712       ⚫ Sushi en Casa
```

Procesa **solo las filas que tengan código**. Las que digan `VARIOS_CANDIDATOS` o
`NO_EXISTE_EN_CATALOGO` se saltan: esas las resuelvo yo.

## Nomenclatura de los acortadores (exacta, sin excepciones)

El slug del acortador se construye con el **slug del producto en el club**, NO con el
slug de sably:

- Checkout limpio: `<slug-producto>-curso-crashing`
- Checkout Seminarios: `<slug-producto>-curso-venta-SO`

Ejemplos reales ya creados:
```
sushi-en-casa-curso-crashing
aprende-piano-curso-crashing
barberia-artistica-paso-a-paso-curso-venta-SO
```

Reglas del slug: minúsculas, sin tildes, sin `ñ` (escribe `unas`, no `uñas`), sin
espacios, palabras separadas por guiones. El sufijo `-curso-crashing` va en minúscula;
en `-curso-venta-SO` las letras `SO` van en MAYÚSCULA.

Si Hotmart rechaza el slug porque ya existe, **anota el que quedó realmente**, no el
que pediste.

## Procedimiento por curso

1. **Afiliarse.** Abre `https://app-vlc.hotmart.com/affiliate-recruiting/view/<codigo_afiliacion>`
   - Si dice «Ya eres Afiliado(a)», salta al paso 2.
   - Si no, pulsa **«Afiliarse Ahora»**. Hotmart te llevará solo a
     `app.hotmart.com/hotlinks/<idProducto>`. Anota ese id.

2. **Copiar los dos hotlinks** de esa página: el del bloque «checkout limpio para
   crashing» y el del bloque «checkout creado por Seminarios Online®». Ambos tienen
   forma `https://go.hotmart.com/XXXXXXX?ap=YYYY`.

3. **Acortar.** Para cada uno de los dos, abre:
   `https://app.hotmart.com/shortener/form?link=<hotlink_url_encoded>`
   El asistente ya viene con el enlace puesto. Entonces:
   - Paso 1: escribe un título descriptivo → **Next**
   - Paso 2: Hotmart precarga un slug aleatorio (tipo `G6mfpUf`). **Bórralo** y escribe
     el slug de la nomenclatura → **Next**
   - Resumen: **End**

4. **Verificar.** Abre el acortador `https://hotm.io/<slug>` y comprueba que termina en
   `pay.hotmart.com/...` **y que la URL final contiene `ref=`**. Si no lo contiene, marca
   la fila como `SIN_ATRIBUCION` y avísame: ese enlace no se puede publicar.

## Salida

Crea `docs/data/acortadores-resultado.json` en la carpeta conectada, y **reescríbelo
después de cada curso**. Una entrada por curso:

```json
{
  "slugSably": "curso-de-sushi",
  "codigo": "5180S46888712",
  "idProducto": "1259120",
  "hotlink": "https://go.hotmart.com/N107094409E",
  "crashing": "https://hotm.io/sushi-en-casa-curso-crashing",
  "ventaSO": "https://hotm.io/sushi-en-casa-curso-venta-SO",
  "checkoutFinal": "https://pay.hotmart.com/G46888691K?ref=N107094409E",
  "estado": "OK",
  "nota": ""
}
```

Estados posibles: `OK` (creado y verificado con `ref`), `SIN_ATRIBUCION` (creado pero
la redirección pierde el `ref`), `YA_EXISTIA` (el acortador ya estaba), `PENDIENTE`
(no se pudo, explica por qué en `nota`).

## Al terminar

Dame tres cosas:

1. Cuántos quedaron `OK` sobre el total.
2. La lista de los que NO quedaron OK, con el motivo de cada uno.
3. Cualquier caso donde el slug que quedó difiere del que pedí.
````

---

## Qué se corrigió del prompt original

### 1. Un error que habría roto el resultado

El prompt original pedía acortar el **«Link — Ventas»** apuntando a *«página de ventas
de Seminarios Online»*. Ese primer hotlink **no lleva al curso**: redirige a
`universidad.online/mauricioduque`, la landing genérica del productor. Acortarlo
habría producido enlaces que mandan al visitante a un sitio donde no puede comprar el
curso que vio en sably.

Lo que en la nomenclatura se llama `-curso-venta-SO` es en realidad el **cuarto**
hotlink, que no es una página de ventas sino **otro checkout** (`checkoutMode=10`).

### 2. Faltaba la nomenclatura, que es el núcleo del encargo

El original decía «obtén o genera 4 links» sin especificar cómo nombrarlos. Hotmart
precarga un slug aleatorio (`G6mfpUf`) en el paso 2 del asistente: sin la regla
explícita, el resultado habrían sido 172 acortadores con nombres ininteligibles.

### 3. Faltaba el criterio de verificación real

«Los enlaces funcionan correctamente» es demasiado vago: un enlace sin `ref` funciona
perfectamente y aun así no paga comisión. La comprobación tiene que ser explícita:
la URL final debe contener `ref=`.

### 4. El flujo estaba incompleto

El original solo *clasificaba* los cursos en afiliados / no afiliados. Pero el trabajo
real incluye **afiliarse**, que es el paso que desbloquea los hotlinks: sin afiliación
aprobada no existe hotlink y por tanto no hay nada que acortar.

### 5. Faltaban las rutas concretas

Se añadieron las tres URLs del flujo, verificadas en vivo. Sin ellas el agente pierde
mucho tiempo navegando el panel a ciegas:

- `app-vlc.hotmart.com/affiliate-recruiting/view/<codigo>` — afiliarse
- `app.hotmart.com/hotlinks/<idProducto>` — los cuatro hotlinks
- `app.hotmart.com/shortener/form?link=<url>` — el asistente con el enlace ya puesto

### 6. Guardado incremental

Con ~86 cursos y ~172 acortadores, un fallo de sesión a mitad tiraba todo el trabajo.
Ahora se exige reescribir el JSON después de cada curso.

### 7. Entrada y salida concretas

El original hablaba de «el archivo Excel adjunto» y «la tabla conglomerada». Se sustituyó
por rutas reales (`docs/data/afiliacion-seminarios.tsv` de entrada,
`docs/data/acortadores-resultado.json` de salida) y por un esquema JSON explícito, que
es lo que después consume `scripts/aplicar-acortadores.py` para volcarlo al catálogo.

### 8. Seguridad

Se añadió la instrucción de no pedir credenciales y de detenerse si la sesión expira.

---

## Alternativa: el script

Este mismo flujo está automatizado en `scripts/hotmart-acortadores.mjs`, que hace lo
mismo sin depender de que un agente conduzca la interfaz:

```bash
# Con Chrome cerrado del todo:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"

# Inicia sesión en Hotmart en esa ventana, y luego:
node scripts/hotmart-acortadores.mjs --dry --limit 3   # comprobación
node scripts/hotmart-acortadores.mjs                    # los 86
python3 scripts/aplicar-acortadores.py                  # volcar al catálogo
```

El script tarda minutos en lugar de horas y no se cansa a mitad. Cowork tiene sentido si
prefieres delegarlo sin ocupar tu terminal, asumiendo que el Mac debe quedar despierto
con la sesión de Hotmart abierta todo el rato.
