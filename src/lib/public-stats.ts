import { getContentRepository } from './emdash-content';
/**
 * Totales públicos del catálogo publicado. Ya no incluye la media de
 * valoraciones de Hotmart: es una nota de un tercero y no se enseña.
 */
export async function publicStats() {
 const cms=await getContentRepository();
 const [courses,countries]=await Promise.all([cms.getCourses(),cms.getCountries()]);
 return {countries:countries.length,courses:courses.length};
}
