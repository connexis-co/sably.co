import assert from 'node:assert/strict';
import test from 'node:test';
import {courseWatch} from '../src/lib/course-watch';
import {videoServido} from '../src/lib/course-videos';
import type {Course} from '../src/lib/emdash-content';
const fixture={id:'curso-de-barberia',updatedAt:'2026-10-03T00:00:00Z',coverImage:{url:'/_emdash/api/media/file/native.webp'},data:{title:'Curso de Barbería',category:'belleza-online',videoKey:'hd/curso-de-barberia.mp4',hotmartUrl:'https://hotmart.com/product'}} as Course;
test('watch metadata uses the actual asset manifest and CMS thumbnail',()=>{
 const video=courseWatch(fixture,'https://sably.co','https://cdn.sably.co')!;
 assert.equal(video.url,'https://sably.co/videos/curso-de-barberia/');
 assert.equal(video.contentUrl,'https://cdn.sably.co/videos/web/curso-de-barberia.mp4');
 assert.equal(video.duration,'PT25S');
 assert.equal(video.thumbnail,'https://sably.co/_emdash/api/media/file/native.webp');
});
test('unpublished, excluded, pending or mismatched videos cannot create watch pages',()=>{
 for(const course of [{...fixture,isPreview:true},{...fixture,seo:{noIndex:true}},{...fixture,data:{...fixture.data,videoKey:'changed.mp4'}},{...fixture,data:{...fixture.data,hotmartUrl:'PENDIENTE'}}])assert.equal(courseWatch(course as Course,'https://sably.co','https://cdn.sably.co'),null);
 assert.equal(courseWatch(fixture,'https://sably.co',''),null);
});
test('the long-cache copy is served whether the CMS keeps the old or the new key',()=>{
 assert.equal(videoServido('curso-de-barberia','hd/curso-de-barberia.mp4'),'web/curso-de-barberia.mp4');
 assert.equal(videoServido('curso-de-barberia','web/curso-de-barberia.mp4'),'web/curso-de-barberia.mp4');
 assert.equal(videoServido('curso-de-barberia','otro.mp4'),'otro.mp4');
 assert.equal(videoServido('curso-sin-manifiesto','hd/x.mp4'),'hd/x.mp4');
 assert.equal(videoServido('curso-de-barberia',undefined),null);
 const nueva={...fixture,data:{...fixture.data,videoKey:'web/curso-de-barberia.mp4'}} as Course;
 assert.equal(courseWatch(nueva,'https://sably.co','https://cdn.sably.co')?.contentUrl,'https://cdn.sably.co/videos/web/curso-de-barberia.mp4');
});
