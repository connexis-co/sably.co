import GithubSlugger from 'github-slugger';
import type { RichBlock } from './emdash-content';

export function richText(value: RichBlock[] | null): string {
  return (value ?? []).map(block => Array.isArray(block.children)
    ? block.children.map(child => typeof child?.text === 'string' ? child.text : '').join('') : '').join('\n\n');
}

/** Match the previous MDX/rehype-slug anchors, including duplicate headings. */
export function prepareRichContent(value: RichBlock[]) {
  const slugger = new GithubSlugger();
  const headings: Array<{depth:number;slug:string;text:string}> = [];
  const blocks = value.map(block => {
    if (block._type !== 'block' || !/^h[1-6]$/.test(String(block.style))) return block;
    const text = richText([block]);
    const explicit = typeof block.anchor === 'string' && /^[\p{L}\p{N}_:.-]+$/u.test(block.anchor) ? block.anchor : undefined;
    const slug = explicit ?? slugger.slug(text);
    headings.push({depth:Number(String(block.style).slice(1)),slug,text});
    return {...block, sablyHeadingId:slug};
  });
  // EmDash attaches inline editing metadata to the field array through a Symbol.
  for (const key of Object.getOwnPropertySymbols(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value,key);
    if (descriptor) Object.defineProperty(blocks,key,descriptor);
  }
  return {blocks,headings};
}
