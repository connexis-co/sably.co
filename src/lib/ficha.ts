/**
 * Datos de la ficha de curso, comunes a los dos temas (`sably-classic` y
 * `sably-v2`). Es el frontmatter que vivía en `CourseLanding.astro`, movido
 * tal cual: precio, cupón, atribución, FAQ, títulos y JSON-LD salen de un solo
 * sitio, así un tema nunca puede afirmar algo distinto que el otro.
 */
import {readVerifiedCourseReviews} from '@/lib/verified-course-reviews';
import {courseWatch} from '@/lib/course-watch';
import {videoServido} from '@/lib/course-videos';
import {clusterDeCurso,relatedGuides} from '@/lib/related-guides';
import {urlCreador} from '@/lib/creadores';
import {courseSeo,indexableAtPath} from '@/lib/cms-indexability';
import { cmsImageUrl } from '@/lib/cms-media';
import { getContentRepository } from '@/lib/emdash-content';
import { renderMarkdown } from '@/lib/markdown';
import type { ResolvedCourseContent } from '@/lib/emdash-content';
import { cotizarCurso } from '@/lib/precio-hoy';
import { enlaceDeCompra } from '@/lib/enlace-compra';
import type { Country, City } from '@/lib/countries';
import { courseCover } from '@/lib/categories';
import { readOperationalRating } from '@/plugins/sably-operations/public';
import { faqsHonestas } from '@/lib/faq-honestas';
import { requisitosDeFicha } from '@/lib/requisitos';
import { DESCRIPCION_SIN_PRODUCTO, sinPromesas } from '@/lib/sin-producto';
import { faqPagoPais } from '@/lib/medios-de-pago';
import { buildHotmartUrl } from '@/lib/hotmart';
import { aceptaCupon, proveedorDe } from '@/lib/proveedores';
import { finDelTramo, promocionSiguiente } from '@/lib/promo';
import { readUpcomingPromos } from '@/plugins/sably-operations/public';
import { env } from 'virtual:sably-runtime';
import { countryAlternates, breadcrumbSchema, conMarca, faqSchema, courseSchema } from '@/lib/seo';
import { SITE, CDN_URL } from '@/lib/site';
import { conciseTitle } from '@/lib/seo-title';

export interface FichaProps {
  content: ResolvedCourseContent;
  country: Country;
  city?: City;
}

/** Lo que la ficha necesita de la petición: URL, `locals` y las cabeceras de la respuesta. */
export interface FichaContexto {
  url: URL;
  locals: App.Locals;
  headers: Headers;
}

export async function cargarFicha({ country, city, content }: FichaProps, ctx: FichaContexto) {
  const cms = await getContentRepository();
  const COUNTRIES = await cms.getCountries();
  const { course, locale } = content;
  ctx.headers.set('X-Sably-Content-Source', content.source);
  ctx.headers.set('X-Sably-Locale-Source', content.localeSource);
  const category = (await cms.getCategory(course.data.category))!;
  const base = `/${country.code}`;
  const coursePath = city ? `${base}/${city.slug}/${course.id}/` : `${base}/${course.id}/`;


  /* Variante por país generada y validada (scripts/generar-catalogo.py). Si
     existe, la página usa su meta, descripción, FAQs y listas; si no, cae al
     contenido genérico del MDX. Opcional por diseño: el build nunca depende
     del lote completo. */
  /* renderMarkdown baja los encabezados un nivel para que cuelguen del h2 de la
     sección, de ahí que el tamaño de prosa se defina sobre h3 y h4. Las listas
     numeradas llevan su propio marcador porque el list-disc de los elementos
     alcanzaba también a los de las listas ordenadas. */
  const localeHtml = locale ? renderMarkdown(locale.data.descripcion) : null;
  // CMS source_body stays plain Markdown: it never enters Astro's MDX compiler.
  const courseHtml = content.sourceBody === null ? null : renderMarkdown(content.sourceBody);
  const learnings = locale?.data.beneficios ?? course.data.learnings;
  const audience = locale?.data.para_quien ?? course.data.audience;
  const requisitos = requisitosDeFicha(locale?.data.requisitos, course.data.level);

  /* El título de país colisiona por dos vías: sin variante todos los países
     comparten el metaTitle del MDX, y con variante el modelo a veces repite el
     mismo título en varios mercados. Se añade el país solo cuando hay colisión
     real: la mediana ya está en 55 caracteres y añadirlo siempre pasaría de 60. */
  const localesDelCurso = (await cms.getCourseLocales(course.id)).filter(
    (l) => l.data.course === course.id,
  );
  const tituloColisiona = locale
    ? localesDelCurso.filter((l) => l.data.meta_title === locale.data.meta_title).length > 1
    : localesDelCurso.length < COUNTRIES.length - 1;

  /* Política del creador: hay quien no acepta el cupón del sitio porque su
     acortador ya trae dentro la oferta elegida. Ver src/lib/proveedores.ts. */
  const conCupon = aceptaCupon(course.data.proveedor);

  /* Id del proveedor (normalizado al defecto si falta). Va al <body> para que el
     banner y el repintado de precio apliquen solo las promociones dirigidas a él. */
  const proveedor = proveedorDe(course.data.proveedor);

  const ctaUrl = buildHotmartUrl({
    baseUrl: course.data.hotmartUrl,
    aceptaCupon: conCupon,
    courseSlug: course.id,
    countryCode: country.code,
    citySlug: city?.slug,
  });

  const allCourses = await cms.getCourses();
  const creators = (await cms.getCreators()).filter(creator => creator.cursos.includes(course.id));

  /* Jerarquía pilar/satélite: el pilar es el único que apunta al head term.
     El satélite enlaza hacia arriba y el pilar lista sus especializaciones, de
     modo que la señal se concentra en una sola página en vez de repartirse. */
  const pillar = course.data.pillar
    ? (allCourses.find((c) => c.id === course.data.pillar) ?? null)
    : null;
  const satellites = allCourses.filter((c) => c.data.pillar === course.id);

  /* Guías del blog: primero las que enlazan a este curso; si no llegan a tres,
     las que enlazan a su clúster (pilar y especializaciones), que el editor
     definió con `pillar`. Nunca por palabra clave ni por categoría. */
  const guides = relatedGuides(await cms.getBlogPosts(), course.id, SITE.url, clusterDeCurso(course, allCourses));

  const related = allCourses
    .filter(
      (c) =>
        c.data.category === course.data.category &&
        c.id !== course.id &&
        c.id !== pillar?.id &&
        !satellites.some((s) => s.id === c.id),
    )
    .slice(0, 4);

  /* Aquí vivía «Lo que dicen los estudiantes» con la colección editorial de
     testimonios: 40 personas y ciudades inventadas por un workflow multiagente
     (docs/CHANGELOG_FRONTEND.md). El 11 de agosto (#67) se retiraron, el 13 una
     sobrescritura de esta plantilla las devolvió y la migración las llevó a
     EmDash. La única prueba social pública es VerifiedReviews: compras reales. */

  /* Aquí vivía `cityStudents`, que pintaba «N estudiantes lo están tomando en
     <ciudad>» a partir de `40 + ((city.slug.length * 31 + course.id.length * 7)
     % 180)`. Era aritmética sobre la longitud del slug presentada como alumnos
     reales: no había fuente de datos detrás, y su propio comentario lo admitía
     («Fase 2: datos reales de Hotmart»).

     No es un dato optimista, es una afirmación de hecho falsa, y salía en las
     landings de ciudad de TODOS los cursos, tuvieran producto o no. Se retira
     hasta que haya matrículas reales por ciudad que contar. */

  const discountPct = Math.round((1 - course.data.priceUSD / course.data.originalPriceUSD) * 100);

  /**
   * ¿Este curso existe como producto de verdad?
   *
   * Los que siguen con `PENDIENTE` no tienen checkout: nadie los ha comprado
   * nunca. Publicar en ellos «4,9 · 183 valoraciones · 1.043 estudiantes» es
   * inventar prueba social de un producto inexistente, y son reseñas fabricadas
   * a ojos de la SIC en Colombia. El dato del frontmatter es de catálogo, no de
   * compradores, así que en estas fichas no se pinta ninguno.
   *
   * La ficha sigue publicándose: conserva el SEO y capta el lead. Lo que se cae
   * es la cifra que afirma algo falso.
   */
  /* Precio, cupón y producto salen de `cotizarCurso` (src/lib/precio-hoy.ts),
     la misma función que usan las tarjetas de portada, listados y relacionados:
     una tarjeta nunca puede enseñar otra cifra que su ficha. */
  const cotizacion = await cotizarCurso(course, country, ctx);
  const { sinProducto } = cotizacion;

  /* Creador real del curso: la relación del CMS o, si falta, el autor que Hotmart
     publica en la página del producto (src/lib/creadores.ts). Sin creador no se
     pinta nada. Sin producto tampoco: al afiliarse al producto real el creador
     puede ser otro, y la ficha contradiría al checkout. */
  const creadoresVisibles = sinProducto ? [] : creators;

  const operationalDb = (env as unknown as {SABLY_DB:D1Database}).SABLY_DB;
  const verifiedReviews = await readVerifiedCourseReviews(operationalDb,course.id).catch(()=>({reviews:[]}));
  /* Valoración PÚBLICA REAL de Hotmart (o null). Solo se pinta en el hero; no va
     al aggregateRating del schema porque es de un tercero (ver courseSchema más
     abajo). Nunca la del frontmatter, que era de catálogo/inventada. */
  const valoracion = await readOperationalRating(operationalDb, course.id, ctx.locals).catch(() => null);
  /* Importe base sobre el que se aplica el cupón (`montoBase`): el real de Hotmart
     o, sin él, el de catálogo. Va al DOM en crudo para que el controlador de
     promoción pueda recalcular en cliente sin volver a pedirlo. */
  const { real, montoBase, monedaBase, activePromos, promoCtx, promoRow, coupon, quote, freshUntil, currency, baseAmount, saving, conPrecio, cuponEnEnlace } = cotizacion;
  /* Qué campaña sigue al terminar la vigente (Black Friday → Cyber Monday → Navidad):
     la caja no promete «después vuelve a…» si a la misma hora empieza otra con
     descuento, y el precio rebajado no se retira en el relevo si sigue el mismo cupón. */
  const proximas = promoRow?.hasta != null
    ? await readUpcomingPromos((env as unknown as {SABLY_DB:D1Database}).SABLY_DB).catch(() => [])
    : [];
  const promoSiguiente = promoRow ? promocionSiguiente(proximas, promoRow, promoCtx) : null;
  const finPrecioRebajado = promoRow ? (proximas.length ? finDelTramo(proximas, promoRow, promoCtx) : promoRow.hasta) : null;
  const displayMoney = (value: number) => new Intl.NumberFormat(country.hreflang, {style:'currency', currency, currencyDisplay:'narrowSymbol', minimumFractionDigits:Number.isInteger(value) ? 0 : 2, maximumFractionDigits:2}).format(value) + ' ' + currency;
  const offer = cotizacion.conOferta && quote?.reduced && promoRow && coupon
    ? {price:displayMoney(quote.reduced), saving, coupon, name:promoRow.nombre, end:promoRow.hasta, hastaPrecio:finPrecioRebajado}
    : null;
  /* Precio de lista para la pregunta «¿Cuánto cuesta?»: siempre el importe sin
     cupón. El rebajado va aparte, con su cupón y su fecha (ver faq-honestas). */
  const precioTexto = conPrecio ? displayMoney(baseAmount) : null;
  const marketQuery = new URLSearchParams(ctx.url.search);
  const marketLinks = COUNTRIES.filter(item => item.code !== country.code).map(item => ({
    label: item.name,
    href: '/' + item.code + '/' + course.id + '/' + (marketQuery.size ? '?' + marketQuery : '') + '#compra'
  }));
  /* Atribución completa siempre, aunque falle la cotización: país del checkout y, si la campaña
     aplica a este creador y no está confirmada como rebaja visible, su cupón (cotizarCurso). */
  const localCheckout = enlaceDeCompra(ctaUrl, country.code, offer ? null : cuponEnEnlace);

  /* Video de presentación: vive en R2 (cdn.sably.co). Sin CDN configurado no se
     pinta el reproductor, así el entorno local no queda con un <video> roto. */
  const videoKey = videoServido(course.id, course.data.videoKey);
  const videoSrc = videoKey && CDN_URL ? `${CDN_URL}/videos/${videoKey}` : null;
  const watch = courseWatch(course,SITE.url,CDN_URL);

  /* FAQs: las del curso + banco estándar (garantiza ≥8 por página, con FAQPage schema). */
  const FAQ_PAGO = faqPagoPais(country);
  const STANDARD_FAQS = [
    FAQ_PAGO,
    {
      q: '¿Puedo estudiar desde el celular?',
      a: 'Sí. La plataforma funciona en celular, tablet y computador, con las clases disponibles 24/7 para que avances donde estés.',
    },
    {
      q: '¿Cuándo empiezo el curso?',
      a: 'El acceso es inmediato: al confirmarse el pago recibes un correo con tu ingreso a la plataforma y puedes empezar en minutos.',
    },
    {
      q: '¿Qué pasa si tengo dudas durante el curso?',
      a: 'Cuentas con soporte por WhatsApp de nuestro equipo y el área de preguntas del curso para resolver lo que se te atasque.',
    },
  ];

  /* Con variante país, sus 8 FAQs (que ya cubren pagos locales) sustituyen al
     banco genérico: mezclar ambos duplicaría la pregunta de pago. */
  const baseFaqsRaw = locale ? locale.data.faqs : [...course.data.faqs, ...STANDARD_FAQS];
  /* En cursos sin checkout (PENDIENTE) las FAQ que prometen pago, garantía o
     acceso inmediato describen algo que todavía no existe. Se filtran y se
     sustituyen por una honesta de disponibilidad, igual que ya se ocultan la
     oferta y el instructor: el FAQPage no debe afirmar lo que la ficha no cumple. */
  const baseFaqs = sinProducto
    ? [
        ...baseFaqsRaw.filter(
          (f) => !/(pago|hotmart|garant|reembolso|inscrib|inscríb|se procesa|confirmarse|precio|certific|constancia|diploma)/i.test(`${f.q} ${f.a}`),
        ),
        {
          q: '¿Cuándo puedo inscribirme?',
          a: 'Estamos habilitando las inscripciones de este curso. Déjanos tus datos y te avisamos apenas esté disponible, sin compromiso.',
        },
      ]
    : /* Las variantes de país traen precios, descuentos y medios de pago que no
         coinciden con el checkout: se quitan, el precio sale de esta ficha y los
         medios de pago de la lista verificada del país. */
      faqsHonestas(baseFaqsRaw, { precioTexto, oferta: offer && { precio: offer.price, cupon: offer.coupon, hasta: offer.end }, faqPago: FAQ_PAGO });
  const faqs = city
    ? [
        {
          q: `¿Puedo tomar este curso desde ${city.name}?`,
          a: `Sí. El curso es 100% online: estudia desde ${city.name} a tu ritmo, con acceso de por vida y precios en ${country.currency}. Solo necesitas internet.`,
        },
        ...baseFaqs,
        {
          q: `¿La constancia sirve en ${city.name}?`,
          a: `La constancia de finalización la emite Hotmart al completar el curso y acredita que lo terminaste, en ${city.name} o en cualquier otro lugar. No es un título oficial ni una certificación profesional.`,
        },
      ]
    : baseFaqs;

  const pageUrl = `${SITE.url}${coursePath}`;
  /* La URL de la ficha de país, que es el canonical también de las de ciudad. El
     nodo Product/Course se construye con ella en las dos variantes: si la de
     ciudad declarase su propia URL, Google vería 37 entidades distintas para un
     solo curso, cada una en una página que él mismo descarta por duplicada. */
  const canonicalUrl = `${SITE.url}${base}/${course.id}/`;
  const h1 = city ? `${course.data.title} en ${city.name}` : (locale?.data.h1 ?? course.data.title);
  /* Los H2 de plantilla («Qué aprenderás», «Programa del curso», «Preguntas
     frecuentes») eran idénticos en todas las fichas. Con el nombre del curso
     cada ficha describe su propio contenido. «Curso de X» pide artículo. */
  const esCurso = /^curso\b/i.test(course.data.title);
  const nombreEnFrase = esCurso ? `el ${course.data.title}` : course.data.title;
  const deNombre = esCurso ? `del ${course.data.title}` : `de ${course.data.title}`;
  const tituloPais =
    locale?.data.meta_title ??
    course.data.metaTitle ??
    `${course.data.title} | Curso Online con Certificado | Sably`;
  /* Ficha de país: la regla de colisión no cambia; después se asegura la marca
     cuando cabe en 60 caracteres (ver conMarca) y la mayúscula inicial, porque
     diez meta_title generados empiezan en minúscula («curso de barbería…»). */
  const mayusculaInicial = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const generatedTitle = city
    ? `${course.data.title} en ${city.name}, ${country.name} | Online | Sably`
    : conMarca(
        mayusculaInicial(
          tituloColisiona
            ? `${tituloPais.replace(/\s*\|\s*Sably\s*$/, '')} | ${country.name}`
            : tituloPais,
        ),
      );
  const title = conciseTitle(generatedTitle, [
    `${course.data.title} en ${city?.name ?? country.name}`,
    `${course.data.title.replace(/^Curso de /i, '')} | ${city?.name ?? country.name}`,
  ]);

  /* Recorta a un límite de palabra con elipsis. Antes se hacía `.slice(0, 158)`
     crudo, que cortaba a media palabra («…cobra más por cad») porque el texto
     compuesto casi siempre pasa de 158. Corta en el último espacio si el recorte
     no deja la frase demasiado mocha. */
  const recortarDesc = (s: string, max = 158): string => {
    if (s.length <= max) return s;
    const corte = s.slice(0, max - 1);
    const sp = corte.lastIndexOf(' ');
    return `${(sp > max * 0.6 ? corte.slice(0, sp) : corte).trimEnd()}…`;
  };

  const descPais = locale?.data.meta_description ?? course.data.shortDescription;
  const descColisiona = locale
    ? localesDelCurso.filter((l) => l.data.meta_description === locale.data.meta_description).length > 1
    : localesDelCurso.length < COUNTRIES.length - 1;
  /* Sin producto, la descripción y el subtítulo no pueden prometer constancia,
     garantía ni acceso: no hay nada que comprar (ver src/lib/sin-producto.ts). */
  const sinPromesa = (texto: string): string => (sinProducto ? sinPromesas(texto) : texto);
  const descripcionCurso = sinPromesa(course.data.shortDescription);
  const description = sinProducto
    ? recortarDesc(sinPromesa(descPais) || DESCRIPCION_SIN_PRODUCTO)
    : city
      ? recortarDesc(`Estudia desde ${city.name}: ${course.data.shortDescription}`)
      : descColisiona
        ? recortarDesc(`Desde ${country.name}: ${descPais}`)
        : recortarDesc(descPais);
  const subtitulo = sinPromesa(locale?.data.subtitulo ?? course.data.shortDescription);

  const breadcrumb = [
        { name: 'Inicio', url: `${SITE.url}${base}/` },
        { name: category.name, url: `${SITE.url}${base}/cursos/${category.slug}/` },
        { name: course.data.title, url: canonicalUrl },
      ];

  const schemas = [
    breadcrumbSchema(breadcrumb),
    courseSchema({
      title: course.data.title,
      description: descripcionCurso || course.data.title,
      url: canonicalUrl,
      image: new URL(cmsImageUrl(course.coverImage) ?? courseCover(course.id, category.slug), SITE.url).href,
      /* El mismo importe que ve el visitante. Si el schema declarase el precio de
         catálogo mientras la página enseña el real de Hotmart, el snippet de
         Google anunciaría una cifra que no se cobra. Número crudo, nunca el texto
         ya formateado. */
      price: !conPrecio ? null : offer && quote?.reduced ? quote.reduced : baseAmount,
      priceCurrency: currency,
      /* El precio rebajado tiene fecha: sin ella el Offer anuncia el importe con
         cupón como si fuera el precio permanente del curso. */
      priceValidUntil: offer?.end ?? null,
      creators: creadoresVisibles.map((c) => ({ slug: c.slug, nombre: c.nombre, bio: c.bio, url: urlCreador(SITE.url, country.code, c.slug) })),
      comprable: !sinProducto,
      category: category.name,
      workloadHours: course.data.durationHours,
      teaches: course.data.learnings,
      level: course.data.level,
      syllabus: course.data.modules.map((m) => m.title),
      datePublished: course.data.publishedAt.toISOString(),
      // Same first-party data as the visible VerifiedReviews section below.
      verifiedReviews,
    }),
    faqSchema(faqs),
    // Video discovery belongs to the dedicated watch page, not a sales page.
  ];
  /* Alternativas hreflang: solo en la ficha de país con producto, y solo hacia
     los países donde la variante es indexable. */
  const alternates = city || sinProducto ? [] : (await countryAlternates(`/${course.id}/`)).filter(alt=>{
    const code=new URL(alt.href).pathname.split('/')[1];
    const variant=localesDelCurso.find(locale=>locale.data.country===code);
    return indexableAtPath(courseSeo(course.seo,variant?.seo),alt.href,SITE.url);
  });

  return { cms, COUNTRIES, course, locale, category, base, coursePath, localeHtml, courseHtml, learnings, audience, requisitos, localesDelCurso, tituloColisiona, conCupon, proveedor, ctaUrl, allCourses, creators, pillar, satellites, guides, related, discountPct, sinProducto, creadoresVisibles, operationalDb, verifiedReviews, real, valoracion, montoBase, monedaBase, activePromos, promoRow, promoSiguiente, coupon, quote, freshUntil, currency, displayMoney, baseAmount, saving, offer, precioTexto, marketQuery, marketLinks, localCheckout, videoSrc, watch, FAQ_PAGO, baseFaqs, faqs, pageUrl, canonicalUrl, h1, esCurso, nombreEnFrase, deNombre, title, description, descripcionCurso, subtitulo, breadcrumb, schemas, alternates };
}

export type Ficha = Awaited<ReturnType<typeof cargarFicha>>;
