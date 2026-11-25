/** The only application-level design selection. Content and plugins stay independent. */
export { default as Layout } from './sably-classic/layouts/Base.astro';
export { default as PageBlocks } from './sably-classic/components/PageBlocks.astro';
export { default as CourseLanding } from '@/components/CourseLanding.astro';
export { default as CourseCard } from '@/components/CourseCard.astro';
export { default as SectionHeading } from '@/components/SectionHeading.astro';
export { SABLY_THEME } from './sably-classic/manifest';
export { default as PageTemplate } from './vistas/Page.astro';

/** Las vistas de src/themes/vistas/ eligen entre el clásico y V2 según el tema de la petición. */
export { default as CountryHomeView } from './vistas/CountryHome.astro';
export { default as CountryCatalogView } from './vistas/CountryCatalog.astro';
export { default as CountryCategoryView } from './vistas/CountryCategory.astro';
export { default as MarketItemView } from './sably-classic/pages/market-item.astro';
/** Ficha de curso del tema V2; la elige la página según `temaDeLaPeticion` (src/lib/ajustes-tema.ts). */
export { default as MarketItemViewV2 } from './sably-v2/pages/market-item.astro';
export { SABLY_V2_THEME } from './sably-v2/manifest';
export { default as CreatorProfileView } from './vistas/CreatorProfile.astro';
export { default as BlogIndexView } from './vistas/BlogIndex.astro';
export { default as BlogArticleView } from './vistas/BlogArticle.astro';
export { default as HomologacionesIndexView } from './vistas/HomologacionesIndex.astro';
export { default as HomologacionProgramView } from './vistas/HomologacionProgram.astro';
export { default as SiteMapView } from './vistas/SiteMap.astro';

export { default as Comments } from './sably-classic/components/Comments.astro';
export {default as RelatedGuides} from './sably-classic/components/RelatedGuides.astro';
export {default as VerifiedReviews} from './sably-classic/components/VerifiedReviews.astro';
export {default as CourseWatchView} from './vistas/CourseWatch.astro';
export {default as VideoLibraryView} from './vistas/VideoLibrary.astro';
