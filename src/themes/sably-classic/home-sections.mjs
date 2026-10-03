/** Native reusable sections: text stays in EmDash when the visual template changes. */
const block=(key,text,style='normal')=>({_type:'block',_key:key,style,markDefs:[],children:[{_type:'span',_key:`${key}-text`,text,marks:[]}]});
const section=(slug,title,content,description='Edita los textos conservando su orden. {pais} y {moneda} se adaptan al mercado de la página.')=>({slug:`sably-home-${slug}`,title:`Inicio · ${title}`,description,source:'theme',keywords:['sably','inicio'],content});
export const homeSections=[
 section('hero','Presentación',[
  block('eyebrow','Cursos online para {pais}'),block('title','Aprende un oficio real.','h2'),block('accent','Emprende tu futuro.','h2'),
  block('description','Habilidades prácticas que la inteligencia artificial no puede reemplazar: panadería, costura, electricidad, barbería y más. Con certificado y acceso de por vida.'),
  block('button','Explorar cursos'),block('secondary','Ver categorías')]),
 section('categories','Categorías',[block('eyebrow','Explora por categoría'),block('title','¿Qué quieres aprender hoy?','h2'),block('description','Oficios y habilidades con demanda real en el mercado.')]),
 section('courses','Cursos destacados',[block('eyebrow','Los favoritos de la comunidad'),block('title','Cursos destacados','h2'),block('description','Precios en {moneda} para {pais}.')]),
 section('benefits-heading','Título de beneficios',[block('eyebrow','¿Por qué Sably?'),block('title','Aprender un oficio nunca fue tan fácil','h2')]),
 section('benefits','Beneficios',[
  block('benefit-1','📜 Certificado incluido','h3'),block('benefit-1-body','Certifica tus habilidades y mejora tu hoja de vida al terminar cada curso.'),
  block('benefit-2','⏰ A tu ritmo','h3'),block('benefit-2-body','Acceso de por vida, 24/7, desde el celular o computador. Sin horarios.'),
  block('benefit-3','💬 Acompañamiento','h3'),block('benefit-3-body','Resuelve tus dudas por WhatsApp con nuestro equipo en tu país.'),
  block('benefit-4','🛡️ Garantía de 7 días','h3'),block('benefit-4-body','Si el curso no es para ti, pides en Hotmart el reembolso del 100 %.')],
  'Cada beneficio tiene un título con icono y uno o más párrafos. Puedes añadir o quitar beneficios.'),
 section('testimonials','Testimonios',[block('eyebrow','Historias reales'),block('title','Estudiantes que ya emprendieron en {pais} y LATAM','h2')]),
 section('cities','Ciudades',[block('eyebrow','Cerca de ti'),block('title','Cursos online en las principales ciudades de {pais}','h2'),block('description','Comunidad local, testimonios de tu región y precios en tu moneda.')]),
 section('blog','Blog',[block('eyebrow','Guías y recursos'),block('title','Aprende gratis en nuestro blog','h2')]),
 section('faq-heading','Título de preguntas',[block('eyebrow','Preguntas frecuentes'),block('title','Resolvemos tus dudas','h2')]),
 section('faq','Preguntas frecuentes',[
  block('q1','¿Los cursos de Sably están disponibles en {pais}?','h3'),block('a1','Sí. Todos nuestros cursos son 100% online y puedes tomarlos desde cualquier ciudad de {pais}, a tu ritmo y con acceso de por vida. Los precios se muestran en {moneda}.'),
  block('q2','¿Recibo un certificado al terminar?','h3'),block('a2','Sí, todos los cursos incluyen certificado digital de finalización que puedes compartir en tu hoja de vida y redes profesionales.'),
  block('q3','¿Cómo se realiza el pago?','h3'),block('a3','El pago se procesa de forma segura a través de Hotmart, la plataforma líder de cursos online en Latinoamérica. Aceptamos tarjetas y métodos de pago locales de {pais}.'),
  block('q4','¿Qué pasa si el curso no me gusta?','h3'),block('a4','Tienes 7 días de garantía: si el curso no cumple tus expectativas, pides en Hotmart el reembolso del 100 % de tu dinero.'),
  block('q5','¿Necesito experiencia previa?','h3'),block('a5','No. La mayoría de nuestros cursos parten desde cero y te llevan paso a paso hasta un nivel profesional.')],
  'Cada pregunta es un encabezado H3, seguido por la respuesta. Puedes añadir o quitar preguntas. {pais} y {moneda} se adaptan al visitante.'),
];
