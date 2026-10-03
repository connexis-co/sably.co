import {getSection,type Section} from 'emdash';
type Market={name:string;currency:string};
const text=(block:Section['content'][number])=>Array.isArray(block.children)?block.children.map(c=>typeof c.text==='string'?c.text:'').join(''):'';
export function homeSectionContent(section:Section|null,market:Market){
 if(!section)throw new Error('Missing EmDash home section');
 const interpolate=(value:string)=>value.replace(/\{(pais|moneda)\}/g,(_,key)=>key==='pais'?market.name:market.currency);
 const blocks=section.content.map(b=>({key:b._key,style:b.style,text:interpolate(text(b))}));
 const fields={eyebrow:'',title:'',accent:'',description:'',button:'',secondary:'',...Object.fromEntries(blocks.map(b=>[b.key,b.text]))};
 const groups:Array<{title:string;body:string}>=[];
 for(const b of blocks){if(b.style==='h3')groups.push({title:b.text,body:''});else if(groups.length)groups[groups.length-1]!.body+=(groups.at(-1)!.body?'\n':'')+b.text;}
 return {fields,groups};
}
export async function getHomeEditorial(market:Market){
 const keys=['hero','categories','courses','benefits-heading','benefits','testimonials','cities','blog','faq-heading','faq']as const;
 return Object.fromEntries(await Promise.all(keys.map(async key=>[key,homeSectionContent(await getSection(`sably-home-${key}`),market)])))as Record<typeof keys[number],ReturnType<typeof homeSectionContent>>;
}
