import assert from 'node:assert/strict';
import test from 'node:test';
import {readVerifiedCourseReviews,verifiedReviewMarkup} from '../src/lib/verified-course-reviews';

test('omits stars without real reviews and rejects invalid aggregates',()=>{
 assert.deepEqual(verifiedReviewMarkup({reviews:[]}),{});
 for(const rating of [{value:5,count:0},{value:6,count:2},{value:NaN,count:1}])assert.deepEqual(verifiedReviewMarkup({rating,reviews:[]}),{});
});
test('uses the same visible reviews and exact score, preserving original wording',()=>{
 const data={rating:{value:4.5,count:2},reviews:[{id:'1',author:'Ana',body:'Mi experiencia real.',rating:4,createdAt:1785758400},{id:'2',author:'Luis',body:'Me ayudó a practicar.',rating:5,createdAt:1785758500}]};
 const markup=verifiedReviewMarkup(data);
 assert.equal(markup.aggregateRating?.ratingCount,2);
 assert.equal(markup.aggregateRating?.ratingValue,4.5);
 assert.deepEqual(markup.review?.map(r=>r.reviewBody),data.reviews.map(r=>r.body));
 assert.ok(markup.review?.every(r=>r.author['@type']==='Person'&&r.datePublished));
});
test('queries only approved first-party reviews with a purchase of the same active course; aggregate is not capped',async()=>{
 const queries:{sql:string;slug:string}[]=[];
 const db={prepare(sql:string){return{bind(slug:string){queries.push({sql,slug});return{async first(){return{count:12,value:4.666666}},async all(){return{results:[{id:'1',author:'Ana',body:'Una opinión.',rating:5,createdAt:1785758400}]}}};}};}} as unknown as D1Database;
 const result=await readVerifiedCourseReviews(db,'curso-real');
 assert.deepEqual(result.rating,{value:4.67,count:12});
 assert.equal(result.reviews.length,1);
 for(const q of queries){assert.equal(q.slug,'curso-real');assert.match(q.sql,/p\.subject_id=r\.subject_id/);assert.match(q.sql,/r\.status='approved'/);assert.match(q.sql,/s\.is_active=1/);assert.match(q.sql,/s\.kind='course'/);assert.doesNotMatch(q.sql,/hotmart|visitor|sably_public_review/);}
 assert.doesNotMatch(queries[0]!.sql,/LIMIT/);
});
