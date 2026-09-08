import { index, pickAny } from './search-rank.ts';
import type { Indexed } from './search-rank.ts';

/** Conservative planning estimate, not the model's tokenizer. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/**
 * Rank overlapping sentence windows within long entries. Neighbouring sentences
 * preserve attribution and consequences; excerpts stay in source order and are
 * explicitly separated so omitted events cannot look like consecutive events.
 * Only accepts documents already admitted by the publication-filtered index.
 */
export function relevantPassages(doc: Indexed, terms: string[], maxChars = 6_000): string {
  if (doc.text.length <= maxChars) return doc.text;
  const sentences = doc.text.match(/[^.!?]+(?:[.!?]+[”"’']*(?:\s+|$)|$)/g) ?? [doc.text];
  const windows: { start: number; end: number; text: string }[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    const start = Math.max(0, i - 1);
    const end = Math.min(sentences.length, i + 5);
    const text = sentences.slice(start, end).join('').trim();
    // Never cut a sentence mid-thought to force it into the model's budget.
    if (text.length <= maxChars) windows.push({ start, end, text });
  }
  const candidates = index(windows.map((w, i) => ({
    title: '', kind: doc.kind, href: String(i), text: w.text,
  })));
  const ranked = pickAny(candidates, terms, candidates.length, 1);
  const chosen = new Set<number>();
  const render = () => {
    const positions = [...chosen].sort((a, b) => a - b);
    return positions.map((position, i) =>
      `${i > 0 && position !== positions[i - 1] + 1 ? '\n[…]\n' : ''}${sentences[position]}`
    ).join('').trim();
  };
  for (const hit of ranked) {
    const window = windows[Number(hit.doc.href)];
    const added: number[] = [];
    for (let i = window.start; i < window.end; i++) {
      if (!chosen.has(i)) { chosen.add(i); added.push(i); }
    }
    if (render().length > maxChars) added.forEach((i) => chosen.delete(i));
  }
  return render();
}

/** Budget includes headings, separators, and excerpt labels, not just prose. */
export function buildAskContext(
  hits: { doc: Indexed }[], terms: string[], budget: number,
) {
  const used: Indexed[] = [];
  const blocks: string[] = [];
  for (const { doc } of hits) {
    const heading = `## ${doc.title} (${doc.kind})\n`;
    const prefix = blocks.length ? '\n\n' : '';
    const remaining = budget * 4 - blocks.join('').length - prefix.length - heading.length;
    const label = '[Excerpts from this entry; omitted passages are marked […].]\n';
    const allowance = Math.min(6_000, remaining - label.length);
    if (allowance <= 0) continue;
    const prose = relevantPassages(doc, terms, allowance);
    if (!prose) continue;
    const block = prefix + heading + (prose === doc.text ? '' : label) + prose;
    if (estimateTokens(blocks.join('') + block) > budget) continue;
    blocks.push(block);
    used.push(doc);
  }
  const text = blocks.join('');
  return { text, used, tokens: estimateTokens(text) };
}
