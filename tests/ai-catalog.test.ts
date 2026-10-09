import assert from 'node:assert/strict';
import test from 'node:test';
import { aiCatalogCourses } from '../src/lib/ai-catalog';
import type { Course } from '../src/lib/emdash-content';

const course = (id: string, hotmartUrl: string) => ({ id, data: { hotmartUrl } }) as Course;

test('AI catalog preserves live checkout and shortlink destinations in their original order', () => {
  const courses = [course('direct', 'https://pay.hotmart.com/P123?ref=affiliate'),
    course('short', 'https://hotm.io/course'), course('go', 'https://go.hotmart.com/A123')];
  assert.deepEqual(aiCatalogCourses(courses), courses);
});

test('AI catalog excludes unavailable, unpublished, noindex and invalid checkout courses without changing their records', () => {
  const available = course('available', 'https://hotm.art/course');
  const courses = [available, course('pending', 'PENDIENTE'), course('pending-url', 'https://pay.hotmart.com/PENDIENTE'),
    course('empty', ''), course('invalid', 'https://'), course('unsafe', 'javascript:alert(1)'),
    { ...available, id: 'draft', isPreview: true }, { ...available, id: 'hidden', seo: { noIndex: true } }];
  const original = structuredClone(courses);
  assert.deepEqual(aiCatalogCourses(courses), [available]);
  assert.deepEqual(courses, original);
});
