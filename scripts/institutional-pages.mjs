import { contactDefaults } from '../src/lib/contact-page.mjs';
const text = block => (block?.children ?? []).map(span => span.text ?? '').join('');
const block = (type, key, data) => ({_type:type,_version:1,_key:key,...data});

/** Restore section structure from the migrated Portable Text; never execute source Astro. */
export function structureInstitutionalPage(slug, data, image) {
  const body = data.body ?? [];
  if(slug === 'contacto') return {
    hero_label: 'Contacto', hero_text: text(body.find(item=>item.style==='normal')),
    layout: [block('sably_contact','contact-channels',contactDefaults)],
  };
  if(slug !== 'nosotros') return {};
  const headings = body.map((item,index)=>item.style==='h2'?index:-1).filter(index=>index>=0);
  if(headings.length!==4) throw new Error('Nosotros: la estructura editorial cambió; revisar antes de migrar.');
  const section = (index) => body.slice(headings[index]+1, headings[index+1] ?? body.length);
  const cards = (items,icons=[]) => {
    const result=[];
    for(const item of items) {
      if(item.style==='h3') result.push({title:text(item),icon:icons[result.length]??'',content:[]});
      else if(result.length) result.at(-1).content.push(item);
    }
    return result.map(({content,...card})=>{
      const links=content.flatMap(item=>(item.markDefs??[]).filter(mark=>mark._type==='link').map(mark=>({url:mark.href,label:(item.children??[]).filter(span=>span.marks?.includes(mark._key)).map(span=>span.text).join('')})));
      return {...card,text:content.map(text).join('\n\n'),...(links[0]?{button_url:links[0].url,button_label:links[0].label}:{})};
    });
  };
  return {
    hero_label:'Sobre nosotros', hero_text:body.slice(0,headings[0]).filter(item=>text(item)!=='Sobre nosotros').map(text).join('\n\n'),
    layout:[
      block('sably_story','about-story',{eyebrow:'Nuestra historia',title:text(body[headings[0]]),content:section(0),image}),
      block('sably_cards','about-principles',{eyebrow:'Lo que nos mueve',title:text(body[headings[1]]),background:'soft',cards:cards(section(1),['🛠️','🤝','💵','📜'])}),
      block('sably_cards','about-ecosystem',{eyebrow:'El ecosistema Sably',title:text(body[headings[2]]),background:'white',cards:cards(section(2))}),
      block('sably_cta','about-catalog',{title:text(body[headings[3]]),text:'',button_label:'Explorar los cursos',button_url:'/co/cursos/'}),
    ],
  };
}
