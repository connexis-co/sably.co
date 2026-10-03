import { env } from 'cloudflare:workers';
import { getContentRepository } from './emdash-content';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
/** Only published catalog products contribute to the visible operational totals. */
export async function publicStats(scope:object) {
 const cms=await getContentRepository();
 const [courses,countries,ratings]=await Promise.all([cms.getCourses(),cms.getCountries(),readOperationalRatings((env as unknown as {SABLY_DB:D1Database}).SABLY_DB,scope).catch(()=>({} as Awaited<ReturnType<typeof readOperationalRatings>>))]);
 const values=courses.map(c=>ratings[c.id]).filter((v):v is NonNullable<typeof v>=>!!v&&v.total>0&&v.rating>=1&&v.rating<=5);
 return {countries:countries.length,courses:courses.length,reviews:values.reduce((sum,v)=>sum+v.total,0),rating:values.length?Math.round(values.reduce((sum,v)=>sum+v.rating,0)/values.length*10)/10:null};
}
