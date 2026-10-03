# Paridad de rutas y navegación

Auditoría de solo lectura del sitemap público de producción, realizada el 3 de octubre de 2026. No modifica producción ni importa datos privados. El resultado compara rutas; no afirma equivalencia visual, editorial ni funcional de todas las páginas.

## Resultado

**Las 964 URL únicas del sitemap actual de producción están representadas en el generador de rutas de la migración completa. No faltan cursos, artículos ni slugs publicados en ese inventario.**

El índice público [sitemap-index.xml](https://sably.co/sitemap-index.xml) enumera once archivos. Se descargaron el índice y sus once hijos, se analizaron los elementos `<loc>` del espacio de nombres de sitemaps y se compararon sus rutas sin sustituir slugs ni quitar segmentos. Las URL de video no se contaron como páginas. La diferencia de origen `sably.co` → `dev.sably.co` se excluye deliberadamente de la comparación de rutas.

La captura reproducible de rutas públicas está en [parity-sitemap-snapshot.json](./parity-sitemap-snapshot.json). Los XML originales descargados permanecen localmente en `.emdash/parity-public/`.

| Grupo | Producción | CMS completo | Faltantes |
| --- | ---: | ---: | ---: |
| Páginas | 25 | 42 | 0 |
| Categorías | 96 | 96 | 0 |
| Blog, incluida su portada | 11 | 11 | 0 |
| Cursos Colombia | 104 | 104 | 0 |
| Cursos México | 104 | 104 | 0 |
| Cursos Perú | 104 | 104 | 0 |
| Cursos Ecuador | 104 | 104 | 0 |
| Cursos Chile | 104 | 104 | 0 |
| Cursos Argentina | 104 | 104 | 0 |
| Cursos España | 104 | 104 | 0 |
| Cursos Estados Unidos | 104 | 104 | 0 |
| **Total** | **964** | **981** | **0** |

No se detectaron duplicados en las 981 rutas propuestas. Los 104 slugs de cursos de cada país coinciden exactamente con producción; también coinciden los diez slugs de artículos. Las 726 variantes editoriales por país conservan su relación con el slug del curso y no son 726 rutas adicionales independientes del catálogo.

## Diferencias identificadas

El generador CMS incorpora **17 rutas que no figuran en el sitemap capturado**, aunque algunas puedan existir ya fuera de ese índice:

- `/contacto/`.
- `/<país>/creadores/masterclasses-la/` y `/<país>/creadores/mauricio-duque/`, para `co`, `mx`, `pe`, `ec`, `cl`, `ar`, `es` y `us`.

La fuente completa contiene 121 cursos, de los que 17 tienen un checkout `PENDIENTE`; estos conservan la exclusión del sitemap y no se contaron como cursos perdidos:

```text
curso-de-adiestramiento-canino-en-positivo
curso-de-aire-acondicionado
curso-de-bartending-y-cocteleria-profesional
curso-de-confeccion-de-trajes-de-bano
curso-de-corte-y-confeccion
curso-de-electricidad-residencial-certificado
curso-de-finanzas-para-tu-negocio
curso-de-instructor-de-yoga-desde-cero
curso-de-lenceria-y-ropa-interior-a-medida
curso-de-nutricion-practica-para-la-familia
curso-de-parrilla-y-asados-como-un-maestro
curso-de-patronaje-profesional-de-ropa
curso-de-peluqueria-canina-profesional
curso-de-resina-epoxica
curso-de-tatuaje
curso-de-tortas-decoradas-desde-cero
curso-de-ventas-por-whatsapp-y-redes
```

Las páginas por ciudad están fuera del índice principal según la política anterior de canonical al país y `noindex`. Esta auditoría no las reclasifica como rutas indexables ni demuestra paridad individual de todas sus variantes.

## Navegación corregida

`Header.astro` tenía los enlaces móviles principales escritos en la plantilla, mientras el escritorio leía el menú `primary` de EmDash. Ahora ambos usan la misma lista resuelta, con el orden, etiqueta, destino y apertura de pestaña definidos en el CMS. Las rutas neutrales `/co/…` se adaptan al país seleccionado. La exploración de categorías continúa basada en la colección de categorías.

`Footer.astro` elegía el icono social a partir de la etiqueta editable. Renombrar «Instagram» a «Síguenos» dejaba el icono sin dibujo. Ahora identifica las redes conocidas por su dominio y muestra el texto de la etiqueta para destinos sin icono disponible. También filtra enlaces no válidos y conserva las opciones de destino de los menús nativos; los enlaces del pie con prefijo `/co/` se adaptan al mercado actual.

## Verificación y límites

Ejecutar `node --import tsx --test tests/parity-audit.test.ts`. Sus cuatro casos:

1. Ejecutan el módulo real `src/lib/sitemap.ts` contra el repositorio CMS alimentado por la semilla completa, y verifican la cobertura de las 964 URL capturadas.
2. Comparan exactamente los conjuntos de slugs de cursos y blog, y excluyen los 17 cursos sin checkout.
3. Eliminan un curso publicado de una copia en memoria y comprueban que la comparación detecta sus ocho rutas perdidas.
4. Verifican que un artículo marcado `noindex` no reaparece en las rutas generadas.

Las dependencias de consulta se sustituyen únicamente en la prueba; no se mantiene una segunda implementación del algoritmo del sitemap. Header y Footer también pasaron la compilación de Astro. No hubo prueba autenticada en navegador en esta subtarea.

El origen local es el clon de `main` en `0f7679a`, con los cambios de migración actuales. La referencia del despliegue anterior de producción era `759a40d` con cambios sin confirmar; la coincidencia de URL no convierte esas dos versiones en equivalentes. Antes de promover desarrollo se debe repetir la comprobación contra la base CMS ya importada y revisar HTTP, canonical, robots, contenido y medios renderizados. El gate de desarrollo continúa imponiendo `noindex` y acceso restringido.
