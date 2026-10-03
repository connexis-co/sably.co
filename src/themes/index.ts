/** The only application-level design selection. Content and plugins stay independent. */
export { default as Layout } from './sably-classic/layouts/Base.astro';
export { default as PageBlocks } from './sably-classic/components/PageBlocks.astro';
export { default as CourseLanding } from '@/components/CourseLanding.astro';
export { default as CityLanding } from '@/components/CityLanding.astro';
export { default as CourseCard } from '@/components/CourseCard.astro';
export { default as SectionHeading } from '@/components/SectionHeading.astro';
export { default as TestimonialCard } from '@/components/TestimonialCard.astro';
export { SABLY_THEME } from './sably-classic/manifest';
export { default as PageTemplate } from './sably-classic/layouts/Page.astro';

export { default as CountryHomeView } from './sably-classic/pages/country-home.astro';
export { default as CountryCatalogView } from './sably-classic/pages/country-catalog.astro';
export { default as CountryCategoryView } from './sably-classic/pages/country-category.astro';
export { default as CityCatalogView } from './sably-classic/pages/city-catalog.astro';
export { default as CityCategoryView } from './sably-classic/pages/city-category.astro';
export { default as MarketItemView } from './sably-classic/pages/market-item.astro';
export { default as CityCourseView } from './sably-classic/pages/city-course.astro';
export { default as CreatorProfileView } from './sably-classic/pages/creator-profile.astro';
export { default as BlogIndexView } from './sably-classic/pages/blog-index.astro';
export { default as BlogArticleView } from './sably-classic/pages/blog-article.astro';
export { default as HomologacionesIndexView } from './sably-classic/pages/homologaciones-index.astro';
export { default as HomologacionProgramView } from './sably-classic/pages/homologacion-program.astro';
export { default as SiteMapView } from './sably-classic/pages/site-map.astro';

export { default as Comments } from './sably-classic/components/Comments.astro';
export {default as RelatedGuides} from './sably-classic/components/RelatedGuides.astro';
