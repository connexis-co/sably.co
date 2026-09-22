# Prompt para Claude Cowork: solicitar indexación en Search Console

Google no ofrece API para «Solicitar indexación» en fichas de curso: la Indexing API
solo admite JobPosting y BroadcastEvent, y la URL Inspection API es de solo lectura.
La solicitud se hace desde la interfaz, que permite unas 10 URLs al día por propiedad.
Este prompt se lanza **una vez al día**, cambiando el número de día, y **solo después
de que el PR SEO esté desplegado**, para que Google rastree la versión con los datos
estructurados nuevos.

Complemento por API, sin la interfaz, que se corre una vez tras cada despliegue:

```bash
node scripts/indexar.mjs --lista docs/seo/urls-prioritarias-indexacion.txt --indexnow --bing --sitemap-google
```

- IndexNow envía las 284 URLs de una vez.
- Bing respeta su cupo de 100/día y sigue al día siguiente donde lo dejó.
- Google recibe el reenvío del sitemap.

---

## Prompt (copiar y pegar en Claude Cowork)

> Hoy toca el **Día N** (cámbialo antes de enviar).
>
> Trabaja en mi navegador, en Google Search Console, con la sesión que ya tengo abierta.
> No escribas contraseñas. Si no hay sesión iniciada, detente y avísame.
>
> **Objetivo:** pedir a Google que vuelva a rastrear 10 páginas de sably.co.
>
> **0. Comprobación previa (obligatoria).** Abre https://sably.co/co/curso-de-unas/ y baja
> hasta el pie de página. Si el pie NO contiene la frase «Sably recomienda cursos como
> afiliado», el despliegue nuevo todavía no está en producción: detente sin solicitar nada
> y avísame.
>
> **1. Abre la propiedad:** https://search.google.com/search-console?resource_id=sc-domain%3Asably.co
>
> **2. Solo lectura, sin tocar nada:** entra en «Seguridad y acciones manuales» → «Acciones
> manuales» (en inglés: «Security & Manual Actions» → «Manual actions»). Copia literalmente
> lo que dice (por ejemplo «No se ha detectado ningún problema» o el detalle de la acción).
>
> **3. Para cada URL del día**, una por una y en orden:
> 1. Haz clic en la barra superior «Inspeccionar cualquier URL de "sably.co"» («Inspect any
>    URL in "sably.co"»), pega la URL exacta y pulsa Enter.
> 2. Espera a que cargue el resultado (puede tardar hasta 2 minutos). Anota el estado
>    («La URL está en Google» / «La URL no está en Google» / otro).
> 3. Haz clic en «SOLICITAR INDEXACIÓN» («REQUEST INDEXING») y espera a que termine la
>    prueba en vivo, que tarda 1-2 minutos.
> 4. Cuando salga «Se ha solicitado la indexación» («Indexing requested»), cierra el aviso
>    y pasa a la siguiente.
> 5. Si aparece «Se ha superado la cuota» («Quota exceeded»), **detente**: no reintentes
>    y apunta hasta dónde llegaste.
>
> **4. Prohibido:** usar «Retiradas» («Removals»), enviar o borrar sitemaps, cambiar
> configuración o usuarios, validar correcciones, aceptar términos nuevos o hacer clic
> en cualquier cosa fuera del flujo de inspección.
>
> **5. Al terminar, devuélveme:**
> - lo que dice «Acciones manuales», literal;
> - una tabla con `URL | estado antes | resultado de la solicitud (OK / cuota / error y texto) | hora`.

---

## Lotes diarios (orden de mayor a menor potencial)

Se omiten 4 fichas que Google ya volvió a rastrear después del 11-sep: /co/curso-de-masajes/,
/us/curso-de-masajes/, /us/curso-de-maquillaje/ y /co/curso-de-unas-acrilicas/.

**Día 1**
- https://sably.co/co/
- https://sably.co/mx/
- https://sably.co/mx/curso-de-unas/
- https://sably.co/co/curso-de-unas/
- https://sably.co/mx/curso-de-reparacion-de-celulares/
- https://sably.co/ar/curso-de-reparacion-de-celulares/
- https://sably.co/co/curso-de-reparacion-de-celulares/
- https://sably.co/co/curso-de-barberia/
- https://sably.co/mx/curso-de-carpinteria-y-muebles/
- https://sably.co/mx/curso-de-extensiones-de-pestanas/

**Día 2**
- https://sably.co/ar/curso-de-unas/
- https://sably.co/co/curso-de-cejas-y-pestanas/
- https://sably.co/mx/curso-de-mecanica-de-motos/
- https://sably.co/mx/curso-de-ingles/
- https://sably.co/mx/curso-de-barberia/
- https://sably.co/co/curso-de-mecanica-de-motos/
- https://sably.co/ar/curso-de-community-manager/
- https://sably.co/mx/curso-de-cejas-y-pestanas/
- https://sably.co/mx/curso-de-maquillaje/
- https://sably.co/mx/curso-de-excel/

**Día 3**
- https://sably.co/mx/curso-de-unas-acrilicas/
- https://sably.co/es/curso-de-unas/
- https://sably.co/ar/curso-de-decoracion-con-globos/
- https://sably.co/co/curso-de-maquillaje/
- https://sably.co/mx/curso-de-reposteria-para-mascotas/
- https://sably.co/ar/curso-de-barista/
- https://sably.co/co/curso-de-limpieza-facial/
- https://sably.co/pe/curso-de-unas/
- https://sably.co/mx/curso-de-soldadura/
- https://sably.co/mx/curso-de-reposteria/

**Día 4**
- https://sably.co/co/curso-de-soldadura/
- https://sably.co/us/curso-de-unas/
- https://sably.co/cl/curso-de-soldadura/
- https://sably.co/co/curso-de-ingles/
- https://sably.co/mx/curso-de-decoracion-con-globos/
- https://sably.co/ar/curso-de-soldadura/
- https://sably.co/es/curso-de-barberia/
- https://sably.co/cl/curso-de-barberia/
- https://sably.co/co/curso-de-excel/
- https://sably.co/ar/curso-de-maquillaje/

**Día 5**
- https://sably.co/ar/curso-de-masajes/
- https://sably.co/ar/curso-de-barberia/
- https://sably.co/es/curso-de-maquillaje/
- https://sably.co/mx/curso-de-masajes/
- https://sably.co/cl/curso-de-unas/
- https://sably.co/es/curso-de-soldadura/
- https://sably.co/co/curso-de-marketing-digital/
- https://sably.co/ar/curso-de-marketing-digital/
- https://sably.co/cl/curso-de-reposteria-para-mascotas/
- https://sably.co/co/curso-de-automaquillaje/

**Día 6**
- https://sably.co/mx/curso-de-pestanas-volumen-ruso/
- https://sably.co/ar/curso-de-extensiones-de-pestanas/
- https://sably.co/mx/curso-de-marketing-digital/
- https://sably.co/cl/curso-de-reparacion-de-celulares/
- https://sably.co/cl/curso-de-maquillaje/
- https://sably.co/ar/curso-de-mecanica-de-motos/
- https://sably.co/ar/curso-de-carpinteria-y-muebles/
- https://sably.co/mx/curso-de-peluqueria/
- https://sably.co/mx/curso-de-primeros-auxilios/
- https://sably.co/cl/curso-de-peluqueria/

Las otras 224 URLs de `urls-prioritarias-indexacion.txt` no hace falta pedirlas a mano:
las cubren IndexNow (Bing y demás), el sitemap y el enlazado interno. Si pasadas dos
semanas alguna sigue en «Descubierta: actualmente sin indexar», se añade a un lote.
