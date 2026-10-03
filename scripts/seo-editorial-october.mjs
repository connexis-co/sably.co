/** Reviewed metadata copy. Stored in EmDash's SEO panel, independently of theme/body. */
import {ContentRepository} from 'emdash';
import {sql} from 'kysely';
export const editorialSeo = {
 blog: {
  'como-hacer-sushi-en-casa-paso-a-paso':{title:'Cómo hacer sushi en casa paso a paso | Sably',description:'Prepara sushi en casa: aprende a cocinar el arroz, elegir ingredientes y enrollar makis. Guía paso a paso con consejos para principiantes.'},
  'como-hacer-un-amigurumi-paso-a-paso':{title:'Cómo hacer un amigurumi paso a paso | Sably',description:'Crea tu primer amigurumi: materiales, puntos básicos de crochet y anillo mágico. Una guía para empezar desde cero y preparar tus primeras piezas.'},
  'cuanto-cuesta-aprender-un-oficio-online':{title:'Cuánto cuesta aprender un oficio online en 2026 | Sably'},
  'mejores-oficios-para-aprender-online':{title:'10 oficios para aprender online y emprender | Sably'},
  'que-es-el-drenaje-linfatico-para-que-sirve':{title:'Drenaje linfático: qué es y para qué sirve | Sably',description:'Conoce qué es el drenaje linfático manual, cómo se realiza, sus beneficios y contraindicaciones antes de recibirlo o aprender esta técnica.'},
  'que-es-el-microblading-guia-completa':{title:'Microblading: duración, cuidados y cicatrización | Sably',description:'Conoce qué es el microblading, cuánto dura, cómo cicatriza y qué cuidados necesita. Revisa también sus contraindicaciones y para quién está indicado.'},
  'que-es-la-colorimetria-en-el-cabello':{title:'Colorimetría capilar: niveles, tonos y aplicación | Sably',description:'Aprende las bases de la colorimetría capilar: niveles, tonos, círculo cromático y neutralización. Entiende cómo elegir y corregir el color del cabello.'},
  'que-es-la-energia-solar-como-funciona':{title:'Qué es la energía solar y cómo funciona | Sably'},
  'tipos-de-soldadura-mig-tig-smaw':{title:'Tipos de soldadura: diferencias entre MIG, TIG y SMAW'},
 },
 pages: {
  nosotros:{title:'Sobre Sably: cursos y oficios para Latinoamérica'},
  privacidad:{description:'Conoce cómo Sably recopila, utiliza y protege tus datos personales, las finalidades del tratamiento y los canales para ejercer tus derechos.'},
  terminos:{description:'Consulta las condiciones de uso de Sably, el acceso a los cursos, las responsabilidades de los usuarios y la información sobre compras y pagos.'},
 },
};
export async function applyEditorialSeo(db,{execute=false,backup=async()=>{}}={}){
 const content=new ContentRepository(db),plan=[];
 for(const [collection,entries]of Object.entries(editorialSeo))for(const [slug,desired]of Object.entries(entries)){
  const entry=await content.findBySlug(collection,slug,'es');if(!entry)continue;
  const before=await db.selectFrom('_emdash_seo').selectAll().where('collection','=',collection).where('content_id','=',entry.id).executeTakeFirst()??null;
  const patch=Object.fromEntries(Object.entries(desired).filter(([key])=>!before?.[`seo_${key}`]));
  if(Object.keys(patch).length)plan.push({collection,slug,id:entry.id,before,patch});
 }
 await backup(plan);
 // EmDash 1.1 native SEO table. Only fill empty fields, including at write time;
 // preserve canonical, image, noindex and any concurrent editor override.
 if(execute)for(const item of plan){
  const now=new Date().toISOString(),values={},updates={};
  for(const [key,value]of Object.entries(item.patch)){
   const column=`seo_${key}`;values[column]=value;
   updates[column]=sql`COALESCE(NULLIF(${sql.ref(`_emdash_seo.${column}`)},''),${value})`;
  }
  await db.insertInto('_emdash_seo').values({collection:item.collection,content_id:item.id,...values,created_at:now,updated_at:now})
   .onConflict(conflict=>conflict.columns(['collection','content_id']).doUpdateSet({...updates,updated_at:now})).execute();
 }
 return {execute,updated:execute?plan.length:0,plan};
}
