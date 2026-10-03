import type {Course} from './emdash-content';
import {COURSE_VIDEOS,duracionIso} from './course-videos';
import {cmsImageUrl} from './cms-media';

/** One watch URL per actual asset, independent of the eight commercial markets. */
export function courseWatch(course:Course,siteUrl:string,cdnUrl:string) {
 const video=COURSE_VIDEOS[course.id];
 const thumbnail=cmsImageUrl(course.coverImage);
 if(!thumbnail||!cdnUrl||!video||course.data.videoKey!==video.key||course.isPreview||course.seo?.noIndex||course.seo?.canonical||/PENDIENTE/i.test(course.data.hotmartUrl))return null;
 const path=`/videos/${course.id}/`;
 return {course,path,url:new URL(path,siteUrl).href,title:`Vídeo: ${course.data.title}`,
  description:`Mira la presentación de ${course.data.title.replace(/^Curso de /,'').toLowerCase()} y conoce su enfoque antes de consultar el temario y las opciones de inscripción.`,
  thumbnail:new URL(thumbnail,siteUrl).href,
  contentUrl:`${cdnUrl.replace(/\/$/,'')}/videos/${video.key}`,duration:duracionIso(video.segundos),seconds:video.segundos,uploadedAt:video.subido};
}
export type CourseWatch=NonNullable<ReturnType<typeof courseWatch>>;
