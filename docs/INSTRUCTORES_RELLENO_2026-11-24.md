# Instructores de relleno en el contenido · casos encontrados (24-nov-2026)

Medido sobre `src/content` con `node scripts/instructores-relleno.mjs` en modo simulación: no se ha escrito nada, ni aquí ni en el CMS.
El contenido de producción vive en el CMS y puede diferir de estos archivos; antes de aplicar hay que repetir la medición sobre un volcado.

## Resumen

- **106 nombres** de relleno, uno por curso; cinco se repiten en varios cursos (lista en `src/data/instructores-relleno.json`).
- **84** de ellos aparecen dentro de la prosa de las variantes de país: **1142 menciones** en **610 de 726** variantes (95 cursos).
- **117 MDX** de curso llevan el bloque `instructor:` con nombre, cargo y biografía inventados (los otros 2 dicen «MasterClasses.La · Seminarios Online» y no se tocan). Ninguna mención en el cuerpo de los MDX.

## Qué haría el script

| Regla | Casos | Qué hace |
|---|---|---|
| `agente` | 768 | Quita el complemento («impartidas por N», «de la mano de N», «el método de N») y deja la frase |
| `sujeto` | 219 | Cambia el nombre por «el curso» («N te guía…» → «El curso te guía…») |
| `rol` | 99 | Deja el rol sin nombre («la instructora N evalúa» → «la instructora evalúa») |
| `frase` | 56 | Quita la frase entera: habla de la persona (biografía, «quien…») o se queda sin verbo |
| `faq-eliminada` | 35 | Elimina la pregunta frecuente: su pregunta o su respuesta eran solo sobre el instructor |

| Campo | Casos |
|---|---|
| `descripcion` | 549 |
| `faqs[].a` | 348 |
| `faqs[].q` | 82 |
| `certificado` | 51 |
| `meta_description` | 38 |
| `garantia` | 38 |
| `faqs[]` | 35 |
| `requisitos[]` | 16 |
| `subtitulo` | 9 |
| `beneficios[]` | 9 |
| `para_quien[]` | 1 |
| `meta_title` | 1 |

## Los 106 nombres

| Nombre | Curso(s) | Menciones | Variantes |
|---|---|---|---|
| Adriana Bustamante | curso-de-contabilidad-basica | 12 | 7 |
| Adriana Peñaloza | curso-de-bartending-y-cocteleria-profesional | 12 | 7 |
| Alejandra Montoya | curso-de-defensa-personal-para-mujeres | 10 | 7 |
| Andrés Bermúdez | curso-de-carpinteria-y-muebles | 12 | 6 |
| Andrés Caballero | curso-de-bartender | 12 | 7 |
| Andrés Camacho | curso-de-resina-epoxica | 0 | 0 |
| Andrés Felipe Solano | curso-de-reposteria | 0 | 0 |
| Andrés Pineda | curso-de-adiestramiento-canino-en-positivo | 10 | 6 |
| Andrés Villamil | curso-de-masaje-descontracturante, curso-de-masaje-reductor, curso-de-masajes | 33 | 19 |
| Andrés Zambrano | curso-de-guitarra | 15 | 8 |
| Andrés Zapata | curso-de-barberia | 16 | 8 |
| Bernardo Iriarte | curso-de-diseno-de-cejas-con-hilo-y-henna | 11 | 6 |
| Camila Duarte | curso-de-maquillaje-profesional-de-novias | 9 | 6 |
| Camila Herrera | curso-de-instructor-de-yoga-desde-cero | 10 | 5 |
| Camila Zuluaga | curso-de-fondant | 15 | 8 |
| Camilo Arteaga | curso-de-fotografia-con-celular | 14 | 7 |
| Camilo Herrera | curso-de-mecanica-de-bicicletas | 13 | 8 |
| Carolina Restrepo | curso-de-panaderia, curso-de-peinados, curso-de-peluqueria | 33 | 18 |
| Damián Rojas | curso-de-hamburguesas-gourmet | 5 | 4 |
| Daniela Corredor | curso-de-confeccion-de-trajes-de-bano | 20 | 8 |
| Daniela Escobar | curso-de-pestanas-volumen-ruso | 4 | 1 |
| Daniela Montenegro | curso-de-reposteria-para-mascotas | 0 | 0 |
| Daniela Osorio | curso-de-unas-acrilicas | 1 | 1 |
| Daniela Pardo | curso-de-frances | 15 | 7 |
| Daniela Pareja | curso-de-community-manager | 11 | 7 |
| Daniela Poveda | curso-de-coreano | 10 | 5 |
| Diana Marcela Torres | curso-de-alisados-y-keratina | 8 | 5 |
| Diana Zambrano | curso-de-decoracion-con-globos | 17 | 8 |
| Diego Cárdenas | curso-de-instalacion-de-camaras-de-seguridad | 15 | 7 |
| Diego Matsuda | curso-de-sushi | 0 | 0 |
| Diego Salcedo | curso-de-ventas-por-whatsapp-y-redes | 0 | 0 |
| Édgar Huamán | curso-de-pollo-broaster | 0 | 0 |
| Elena Barrios | curso-de-joyeria-artesanal | 22 | 8 |
| Enjoy Digital | curso-de-marketing-digital | 0 | 0 |
| Fabián Montoya | curso-de-serigrafia | 0 | 0 |
| Fabio Mendoza | curso-de-masajes-terapeuticos-y-relajantes | 7 | 4 |
| Felipe Cardoso | curso-de-portugues | 0 | 0 |
| Felipe Zambrano | curso-de-excel | 10 | 7 |
| Fisioparallevar | curso-de-drenaje-linfatico | 0 | 0 |
| Gabriela Toro | curso-de-microblading | 18 | 8 |
| Gloria Betancur | curso-de-porcelana-fria | 0 | 0 |
| Héctor Salazar | curso-de-reparacion-de-lavadoras | 0 | 0 |
| Héctor Salcedo | curso-de-sublimacion | 0 | 0 |
| Héctor Villamizar | curso-de-costura-industrial | 13 | 8 |
| Hernán Salguero | curso-de-nutricion-practica-para-la-familia | 17 | 8 |
| Isabel Munévar | curso-de-pasteleria | 14 | 7 |
| Jhon Rentería | curso-de-barberia-como-negocio, curso-de-barberia-infantil | 21 | 15 |
| Joaquín Berrío | curso-de-patronaje-profesional-de-ropa | 16 | 6 |
| Jorge Cárdenas | curso-de-electricidad-residencial-certificado | 15 | 7 |
| Julián Cárdenas | curso-de-cocina | 18 | 8 |
| Julián Mendoza | curso-de-reparacion-de-computadoras | 0 | 0 |
| Karen Julieth Mora | curso-de-extensiones-de-cabello | 16 | 7 |
| Karina Lozada | curso-de-piano | 0 | 0 |
| Laura Benítez | curso-de-extensiones-de-pestanas | 11 | 7 |
| Laura Betancur | curso-de-cejas-y-pestanas | 11 | 8 |
| Laura Cifuentes | curso-de-ingles-para-ninos | 6 | 5 |
| Leonardo Pardo | curso-de-primeros-auxilios-para-mascotas | 3 | 1 |
| Lina Betancur | curso-de-desayunos-sorpresa | 4 | 2 |
| Lucía Pardo | curso-de-maderoterapia | 10 | 7 |
| Luisa Cárdenas | curso-de-decoracion-de-unas | 7 | 3 |
| Manuela Ocampo | curso-de-reparacion-de-celulares | 0 | 0 |
| Marcela Duarte | curso-de-corte-y-confeccion | 11 | 7 |
| Marcela Quintero | curso-de-colorimetria | 9 | 6 |
| Marcela Quiroga | curso-de-crochet | 11 | 7 |
| Mariana Quiceno | curso-de-tortas-decoradas-desde-cero | 0 | 0 |
| Mariana Quintero | curso-de-barista | 16 | 8 |
| Mariano Bianchi | curso-de-pizza-artesanal | 0 | 0 |
| Mauricio Salgado | curso-de-bouquets-con-globos, curso-de-flores-con-globos, curso-de-globoflexia, curso-de-globos-burbuja | 55 | 27 |
| Olga Bermúdez | curso-de-velas-artesanales-y-aromaticas | 4 | 1 |
| Óscar Benavides | curso-de-primeros-auxilios | 0 | 0 |
| Óscar Valencia | curso-de-remodelacion-de-banos-y-cocinas | 0 | 0 |
| Óscar Villalba | curso-de-aire-acondicionado | 11 | 7 |
| Paola Andrade | curso-de-maquillaje-permanente | 13 | 8 |
| Paola Andrea Cifuentes | curso-de-limpieza-facial | 10 | 7 |
| Paola Cárdenas | curso-de-finanzas-para-tu-negocio | 12 | 6 |
| Paola Guerrero | curso-de-depilacion | 12 | 7 |
| Paola Gutiérrez | curso-de-comidas-rapidas | 14 | 7 |
| Paola Sarmiento | curso-de-manicure-y-pedicure | 10 | 4 |
| Paola Sifuentes | curso-de-amigurumi | 8 | 7 |
| Renzo Valdivia | curso-de-ceviche-peruano | 11 | 6 |
| Ricardo Fonseca | curso-de-electricista | 11 | 5 |
| Ricardo Peña | curso-de-mecanica-de-motos | 12 | 8 |
| Ricardo Salazar | curso-de-energia-solar | 17 | 7 |
| Ricardo Salcedo | curso-de-airbnb | 8 | 6 |
| Rocío Betancourt | curso-de-confeccion-de-ropa-interior | 11 | 6 |
| Rosalba Mendoza | curso-de-modisteria | 14 | 7 |
| Sandra Villamizar | curso-de-galletas-decoradas | 12 | 8 |
| Santiago Rueda | curso-de-barberia-artistica | 20 | 7 |
| Santiago Vélez | curso-de-fotografia | 14 | 6 |
| Sebastián Aristizábal | curso-de-dj | 15 | 8 |
| Sebastián Funes | curso-de-parrilla-y-asados-como-un-maestro | 11 | 7 |
| Sebastián Higa | curso-de-japones | 10 | 6 |
| Silvia Etcheverry | curso-de-molderia-y-confeccion | 14 | 8 |
| Tatiana Osorio | curso-de-peluqueria-canina-profesional | 4 | 1 |
| Tomás Riquelme | curso-de-cerveza-artesanal | 14 | 7 |
| Valentina Cárdenas | curso-de-automaquillaje, curso-de-cupcakes, curso-de-maquillaje-de-fantasia, curso-de-maquillaje | 66 | 32 |
| Valentina Ocampo | curso-de-macrame | 13 | 8 |
| Valentina Ordóñez | curso-de-ingles | 14 | 7 |
| Valentina Osorio | curso-de-canto | 13 | 8 |
| Valentina Ríos | curso-de-barismo-y-cafe-de-especialidad | 21 | 7 |
| Valentina Suárez | curso-de-balayage | 9 | 6 |
| Valeria Cardona | curso-de-chocolateria | 14 | 8 |
| Valeria Ospina | curso-de-lenceria-y-ropa-interior-a-medida | 8 | 6 |
| Valeria Ríos | curso-de-tatuaje | 0 | 0 |
| Ximena Aristizábal | curso-de-estetica-canina | 8 | 4 |
| Yesenia Palacios | curso-de-trenzas-y-peinados | 0 | 0 |

## Preguntas frecuentes que se eliminarían (35)

Son preguntas sobre quién imparte el curso o cómo consultarle: sin el instructor inventado no tienen respuesta.

- `curso-de-airbnb--ar.json` · ¿Quién dicta el curso y cómo resuelvo mis dudas?
- `curso-de-airbnb--us.json` · ¿Quién dicta las lecciones del curso?
- `curso-de-automaquillaje--co.json` · ¿Quién imparte la capacitación?
- `curso-de-barberia-artistica--co.json` · ¿Quién dicta el curso y en qué formato se entregan las clases?
- `curso-de-barberia-artistica--es.json` · ¿Quién impartirá las clases?
- `curso-de-barismo-y-cafe-de-especialidad--ec.json` · ¿Quién imparte el curso de barismo?
- `curso-de-barismo-y-cafe-de-especialidad--pe.json` · ¿Puedo hacer consultas a Valentina Ríos durante las clases?
- `curso-de-barista--cl.json` · ¿Quién imparte el curso?
- `curso-de-bartending-y-cocteleria-profesional--us.json` · ¿Quién dicta este programa de formación?
- `curso-de-cerveza-artesanal--cl.json` · ¿Puedo hacer preguntas a Tomás Riquelme durante el curso?
- `curso-de-cerveza-artesanal--ec.json` · ¿Quién imparte la capacitación?
- `curso-de-cerveza-artesanal--es.json` · ¿Quién imparte la formación técnica?
- `curso-de-cerveza-artesanal--pe.json` · ¿Quién imparte la capacitación?
- `curso-de-comidas-rapidas--ec.json` · ¿Quién imparte la capacitación?
- `curso-de-confeccion-de-trajes-de-bano--es.json` · ¿Quién es la profesora del curso?
- `curso-de-contabilidad-basica--ar.json` · ¿Quién dicta la formación?
- `curso-de-contabilidad-basica--pe.json` · ¿Quién dicta el curso de contabilidad?
- `curso-de-coreano--ec.json` · ¿Quién imparte la capacitación?
- `curso-de-corte-y-confeccion--ec.json` · ¿Quién dicta las clases del programa?
- `curso-de-costura-industrial--pe.json` · ¿Quién es el instructor de las clases?
- `curso-de-cupcakes--us.json` · ¿Quién dicta el contenido de las clases?
- `curso-de-decoracion-con-globos--es.json` · ¿Quién imparte la formación?
- `curso-de-extensiones-de-pestanas--ec.json` · ¿Quién imparte la capacitación?
- `curso-de-flores-con-globos--ec.json` · ¿Quién dicta el taller?
- `curso-de-fondant--cl.json` · ¿Quién imparte las clases del curso?
- `curso-de-galletas-decoradas--co.json` · ¿Quién imparte la capacitación?
- `curso-de-hamburguesas-gourmet--cl.json` · ¿Quién imparte el curso?
- `curso-de-ingles--co.json` · ¿Qué pasa si tengo dudas durante las lecciones de Valentina Ordóñez?
- `curso-de-instalacion-de-camaras-de-seguridad--us.json` · ¿Quién imparte la capacitación?
- `curso-de-joyeria-artesanal--es.json` · ¿Quién es la instructora de las lecciones?
- `curso-de-nutricion-practica-para-la-familia--ar.json` · ¿Quién dicta las lecciones del programa?
- `curso-de-nutricion-practica-para-la-familia--ec.json` · ¿Quién dicta las clases de este curso?
- `curso-de-patronaje-profesional-de-ropa--ec.json` · ¿Quién imparte la capacitación?
- `curso-de-peluqueria-canina-profesional--es.json` · ¿Quién imparte la formación?
- `curso-de-velas-artesanales-y-aromaticas--ec.json` · ¿Quién imparte el curso de velas artesanales y aromáticas?

## Cómo se aplica (pendiente del sí de JP)

1. Exportar del CMS las colecciones `course_locales` y `courses` a JSON.
2. `node scripts/instructores-relleno.mjs --entrada variantes.json --salida limpias.json --json cambios.json` y revisar `cambios.json` por muestreo.
3. Cargar `limpias.json` en el CMS y vaciar `instructor_name`, `instructor_title` e `instructor_bio` de los 117 cursos.
4. `npm run seo:test -- --muestra 5`: la regla `instructor-relleno` tiene que quedar en cero.
