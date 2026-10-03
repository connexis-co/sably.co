import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const q=value=>value===null?'NULL':typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`;
/** Local public snapshots only. INSERT OR IGNORE never overwrites moderation. */
export function buildPublicSeed(hotmart,social) {
  const captured=Math.floor(Date.parse(hotmart._capturado)/1000);
  if(!Number.isFinite(captured))throw new Error('Missing public snapshot capture date');
  const rows=['-- Initial public snapshots for development SABLY_DB. No leads, purchases, private contacts or outbound actions.'];
  for(const [slug,currencies] of Object.entries(hotmart.precios))for(const [currency,amount] of Object.entries(currencies)) {
    if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0)throw new Error('Invalid public price');
    rows.push(`INSERT OR IGNORE INTO hotmart_precio(slug,moneda,monto,capturado) VALUES (${[slug,currency,amount,captured].map(q).join(',')});`);
  }
  for(const [slug,value] of Object.entries(hotmart.valoraciones))rows.push(`INSERT OR IGNORE INTO hotmart_valoracion(slug,rating,total,capturado) VALUES (${[slug,value.rating,value.total,captured].map(q).join(',')});`);
  for(const [slug,product] of Object.entries(hotmart.productos))if(product.payUrl)rows.push(`INSERT OR IGNORE INTO hotmart_producto(slug,pay_url,hotlink,actualizado) VALUES (${[slug,product.payUrl,product.hotlink??'',captured].map(q).join(',')});`);
  for(const [slug,reviews] of Object.entries(hotmart.resenas))for(const review of reviews) {
    const source=hotmart.productos[slug]?.payUrl;
    if(!source)throw new Error('Public review without source product');
    const id='hotmart-'+createHash('sha256').update(JSON.stringify([slug,review.nombre,review.rating,review.texto??''])).digest('hex').slice(0,32);
    rows.push(`INSERT OR IGNORE INTO sably_public_review(id,slug,author_name,rating,body,source_url,status,created_at) VALUES (${[id,slug,review.nombre,review.rating,review.texto??'',source,'approved',captured].map(q).join(',')});`);
  }
  rows.push(`INSERT OR IGNORE INTO sably_public_dataset(id,payload,source,captured_at) VALUES (${['social-proof',JSON.stringify({avisos:social.avisos,cursos:social.cursos}),social._fuente,Math.floor(Date.parse(social._generado)/1000)||captured].map(q).join(',')});`);
  return rows.join('\n')+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const root=new URL('../../data/',import.meta.url);
  const hotmart=JSON.parse(readFileSync(new URL('hotmart-live.json',root),'utf8'));
  const social=JSON.parse(readFileSync(new URL('prueba-social.json',root),'utf8'));
  writeFileSync(new URL('public-data-seed.sql',import.meta.url),buildPublicSeed(hotmart,social));
  console.log('Public operational seed generated locally. No remote writes.');
}
