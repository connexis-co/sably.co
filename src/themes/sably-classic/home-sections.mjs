/** Native reusable sections: text stays in EmDash when the visual template changes. */
const block=(key,text,style='normal')=>({_type:'block',_key:key,style,markDefs:[],children:[{_type:'span',_key:`${key}-text`,text,marks:[]}]});
const section=(slug,title,content,description='Edita los textos conservando su orden. {pais} y {moneda} se adaptan al mercado de la página.')=>({slug:`sably-home-${slug}`,title:`Inicio · ${title}`,description,source:'theme',keywords:['sably','inicio'],content});
export const homeSections=[
 section('hero','Presentación',[
  block('eyebrow','Cursos online para {pais}'),block('title','Aprende un oficio real.','h2'),block('accent','Emprende tu futuro.','h2'),
  block('description','Habilidades prácticas que la inteligencia artificial no puede reemplazar: panadería, costura, electricidad, barbería y más. Con certificado de finalización y acceso de por vida.'),
  block('button','Explorar cursos'),block('secondary','Ver categorías')]),
 section('categories','Categorías',[block('eyebrow','Explora por categoría'),block('title','¿Qué quieres aprender hoy?','h2'),block('description','Oficios y habilidades con demanda real en el mercado.')]),
 section('courses','Cursos destacados',[block('eyebrow','Selección de Sably'),block('title','Cursos destacados','h2'),block('description','Precios en {moneda} para {pais}.')]),
 section('escenas','Scroll narrativo (De la primera clase a tu primer encargo)',[
  block('eyebrow','Paso a paso'),block('title','De la primera clase a tu primer encargo','h2'),block('description','Así se ve aprender un oficio en línea, desde que eliges el curso hasta que lo ofreces a otros.'),
  block('c1','Eliges un oficio que puedas practicar','h3'),block('c1-texto','Cada curso dice qué materiales necesitas y cuánto dura. Empieza por lo que ya te llama: la cocina, el cabello, la electricidad de tu casa.'),
  block('c2','Aprendes en vídeo, a tu ritmo','h3'),block('c2-texto','Las lecciones se ven en el celular o en el computador, las veces que quieras. Pausas, repites y sigues cuando puedas.'),
  block('c3','Practicas con tus manos','h3'),block('c3-texto','Repites cada técnica en casa o en el taller, con la clase abierta al lado.'),
  block('c4','Ofreces tu trabajo','h3'),block('c4-texto','Con la técnica dominada, la ofreces a vecinos, familia o clientes. El temario de cada curso dice si enseña a poner precio a tu trabajo.')],
  'Portada V2. Antetítulo, título y entradilla; después, cada capítulo es un H3 seguido de su párrafo (hasta cuatro: la foto y el enlace van por posición). {pais} y {moneda} se adaptan al visitante.'),
 section('benefits-heading','Título de beneficios',[block('eyebrow','¿Por qué Sably?'),block('title','Aprender un oficio nunca fue tan fácil','h2')]),
 section('benefits','Beneficios',[
  block('benefit-1','📜 Certificado al terminar','h3'),block('benefit-1-body','Al completar un curso, Hotmart emite un certificado digital de finalización con tu nombre.'),
  block('benefit-2','⏰ A tu ritmo','h3'),block('benefit-2-body','Acceso de por vida, 24/7, desde el celular o computador. Sin horarios.'),
  block('benefit-3','💬 Acompañamiento','h3'),block('benefit-3-body','Resuelve tus dudas por WhatsApp con el equipo de Sably.'),
  block('benefit-4','🛡️ Garantía de 7 días','h3'),block('benefit-4-body','Si el curso no es para ti, pides en Hotmart el reembolso del 100 %.')],
  'Cada beneficio tiene un título con icono y uno o más párrafos. Puedes añadir o quitar beneficios.'),
 section('testimonials','Testimonios',[block('eyebrow','Historias reales'),block('title','Estudiantes que ya emprendieron en {pais} y LATAM','h2')]),
 section('cities','Ciudades',[block('eyebrow','Cerca de ti'),block('title','Cursos online en las principales ciudades de {pais}','h2'),block('description','Comunidad local, testimonios de tu región y precios en tu moneda.')]),
 section('blog','Blog',[block('eyebrow','Guías y recursos'),block('title','Aprende gratis en nuestro blog','h2')]),
 section('faq-heading','Título de preguntas',[block('eyebrow','Preguntas frecuentes'),block('title','Resolvemos tus dudas','h2')]),
 section('faq','Preguntas frecuentes',[
  block('q1','¿Los cursos de Sably están disponibles en {pais}?','h3'),block('a1','Sí. Todos nuestros cursos son 100% online y puedes tomarlos desde cualquier ciudad de {pais}, a tu ritmo y con acceso de por vida. Los precios se muestran en {moneda}.'),
  block('q2','¿Recibo un certificado al terminar?','h3'),block('a2','Sí. Al completar un curso, Hotmart emite un certificado digital de finalización con tu nombre y el del curso.'),
  block('q3','¿Cómo se realiza el pago?','h3'),block('a3','El pago lo procesa Hotmart, que acepta tarjetas y métodos de pago locales de {pais}.'),
  block('q4','¿Qué pasa si el curso no me gusta?','h3'),block('a4','Tienes 7 días de garantía: si el curso no cumple tus expectativas, pides en Hotmart el reembolso del 100 % de tu dinero.'),
  block('q5','¿Necesito experiencia previa?','h3'),block('a5','No. La mayoría de nuestros cursos parten desde cero y te llevan paso a paso hasta un nivel profesional.')],
  'Cada pregunta es un encabezado H3, seguido por la respuesta. Puedes añadir o quitar preguntas. {pais} y {moneda} se adaptan al visitante.'),
];
