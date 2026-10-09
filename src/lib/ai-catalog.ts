import type { Course } from './emdash-content';

/** AI recommendations must lead to published courses with a working checkout URL. */
export function aiCatalogCourses(courses: Course[]): Course[] {
  return courses.filter(course => {
    if (course.isPreview || course.seo?.noIndex || /PENDIENTE/i.test(course.data.hotmartUrl)) return false;
    try {
      const checkout = new URL(course.data.hotmartUrl);
      return checkout.protocol === 'https:' || checkout.protocol === 'http:';
    } catch {
      return false;
    }
  });
}
