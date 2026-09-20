import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

const blocks = new Set(['p', 'div', 'li', 'br', 'hr', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'td', 'th']);
const excluded = new Set(['script', 'style', 'template', 'pre', 'code']);

/** Estimate from rendered recap prose, excluding markup, code and hidden text.
 * 200 words/minute is a display convention, not a promise about a reader. */
export function readingMinutes(html: string): number | null {
  const textOf = (node: DefaultTreeAdapterMap['node']): string => {
    if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value;
    if ('tagName' in node && (excluded.has(node.tagName) || node.attrs.some(attr => attr.name === 'hidden'))) return '';
    const text = 'childNodes' in node ? node.childNodes.map(textOf).join('') : '';
    return 'tagName' in node && blocks.has(node.tagName) ? ` ${text} ` : text;
  };
  const words = textOf(parseFragment(html)).match(/[\p{L}\p{N}]+(?:['’‑-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return words >= 500 ? Math.ceil(words / 200) : null;
}
