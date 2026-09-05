const WORDS_PER_MINUTE = 225;
const MINIMUM_WORDS = 500;

/**
 * Estimate a recap's reading time, omitting the label on short entries where
 * a one-minute estimate would add more noise than useful information.
 */
export function readingTime(markdown: string): string | undefined {
  const words = markdown.match(/[\p{L}\p{N}](?:[\p{L}\p{N}'’—-]*[\p{L}\p{N}])?/gu)?.length ?? 0;

  if (words < MINIMUM_WORDS) return undefined;

  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}
