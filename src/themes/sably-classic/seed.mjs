import { homeSections } from './home-sections.mjs';
/** Structural EmDash data travels with the template; the importer preserves existing menus before applying this seed. */
export const themeSeed = {
  sections: homeSections,
  menus: [
    {name:'primary',label:'Navegación principal',locale:'es',items:[
      {type:'custom',label:'Cursos',url:'/co/cursos/'},
      {type:'custom',label:'Homologaciones',url:'/homologaciones/'},
      {type:'custom',label:'Blog',url:'/blog/'},
      {type:'custom',label:'Nosotros',url:'/nosotros/'},
      {type:'custom',label:'Contacto',url:'/contacto/'},
    ]},
    {name:'footer',label:'Pie de página',locale:'es',items:[
      {type:'custom',label:'Sobre nosotros',url:'/nosotros/'},
      {type:'custom',label:'Homologaciones',url:'/homologaciones/'},
      {type:'custom',label:'Blog',url:'/blog/'},
      {type:'custom',label:'Contacto',url:'/contacto/'},
      {type:'custom',label:'Mapa del sitio',url:'/sitemap/'},
      {type:'custom',label:'Términos y condiciones',url:'/legal/terminos/'},
      {type:'custom',label:'Política de privacidad',url:'/legal/privacidad/'},
    ]},
    {name:'social',label:'Redes sociales',locale:'es',items:[
      {type:'custom',label:'Instagram',url:'https://www.instagram.com/sably.academy',target:'_blank'},
      {type:'custom',label:'TikTok',url:'https://www.tiktok.com/@sably.academy',target:'_blank'},
      {type:'custom',label:'Facebook',url:'https://www.facebook.com/sably.academy',target:'_blank'},
      {type:'custom',label:'YouTube',url:'https://www.youtube.com/@sably.academy',target:'_blank'},
    ]},
    {name:'ecosystem',label:'Ecosistema Sably',locale:'es',items:[
      {type:'custom',label:'Academia de Belleza',url:'https://academiadebelleza.edu.co',target:'_blank'},
      {type:'custom',label:'Curso de Globos Online',url:'https://cursodeglobosonline.com',target:'_blank'},
    ]},
  ],
  widgetAreas:[
    {name:'header_after',label:'Después de la navegación',description:'Avisos o contenido adicional antes de la página.',widgets:[]},
    {name:'footer_after',label:'Después del pie',description:'Contenido adicional compartido por todo el sitio.',widgets:[]},
  ],
};
