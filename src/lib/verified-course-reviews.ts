/** Only first-party, approved reviews tied to a purchase of this exact course. */
export interface VerifiedReview { id:string; author:string; rating:number; body:string; createdAt:number }
export interface VerifiedReviews { rating?:{value:number;count:number}; reviews:VerifiedReview[] }
const eligible = `FROM course_review r
 JOIN subject s ON s.id=r.subject_id
 JOIN purchase p ON p.id=r.purchase_id AND p.subject_id=r.subject_id
 WHERE s.slug=? AND s.kind='course' AND s.is_active=1 AND r.status='approved'
 AND r.rating BETWEEN 1 AND 5`;

export async function readVerifiedCourseReviews(db:D1Database,slug:string):Promise<VerifiedReviews> {
 const [aggregate,rows]=await Promise.all([
  db.prepare(`SELECT COUNT(*) AS count,AVG(r.rating) AS value ${eligible}`).bind(slug).first<{count:number;value:number|null}>(),
  db.prepare(`SELECT r.id,r.author_name AS author,r.rating,r.body,r.created_at AS createdAt ${eligible}
   AND length(trim(r.body))>0 AND length(trim(r.author_name)) BETWEEN 1 AND 99
   ORDER BY r.created_at DESC,r.id LIMIT 6`).bind(slug).all<VerifiedReview>(),
 ]);
 return {
  ...(aggregate&&aggregate.count>0&&aggregate.value!==null?{rating:{value:Math.round(aggregate.value*100)/100,count:aggregate.count}}:{}),
  reviews:rows.results,
 };
}

/** This exact dataset is also rendered visibly, with no third-party/cross-course fallback. */
export function verifiedReviewMarkup(data:VerifiedReviews) {
 if(!data.rating||!Number.isInteger(data.rating.count)||data.rating.count<1||!Number.isFinite(data.rating.value)||data.rating.value<1||data.rating.value>5)return {};
 const reviews=data.reviews.filter(r=>r.body.trim()&&r.author.trim()&&r.author.trim().length<100&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5);
 return {
  aggregateRating:{'@type':'AggregateRating',ratingValue:data.rating.value,ratingCount:data.rating.count,bestRating:5,worstRating:1},
  ...(reviews.length?{review:reviews.map(r=>({
   '@type':'Review',author:{'@type':'Person',name:r.author},reviewBody:r.body,
   reviewRating:{'@type':'Rating',ratingValue:r.rating,bestRating:5,worstRating:1},
   ...(Number.isFinite(r.createdAt)&&r.createdAt>0?{datePublished:new Date(r.createdAt*1000).toISOString()}:{}),
  }))}:{}),
 };
}
