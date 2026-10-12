import type { CollectionEntry } from 'astro:content';
import { recapScenes } from './recap-scenes.ts';
import { isSessionPublished } from './session-publication.ts';

export type TableCitation = { label: string; href: string };
export type TableRule = { text: string; source: TableCitation };
export type TableReminder = { title: string; text: string; sources: TableCitation[] };

/** Extract the standing table facts from their existing authoritative document. */
export function readTableFacts(markdown: string) {
  function section(heading: string) {
    const start = markdown.indexOf(`## ${heading}\n`);
    if (start < 0) throw new Error(`TABLE-FACTS: missing ${heading} section`);
    const bodyStart = start + heading.length + 4;
    const end = markdown.indexOf('\n## ', bodyStart);
    return markdown.slice(bodyStart, end < 0 ? undefined : end);
  }
  function requireMatch(value: string, pattern: RegExp, field: string) {
    const result = value.match(pattern)?.[1];
    if (!result) throw new Error(`TABLE-FACTS: cannot read ${field}`);
    return result;
  }
  const game = section('The game');
  const rules = [...section('House rules').matchAll(/^\| (.+) \| Session (\d+) \|$/gm)]
    .map((match) => ({ text: match[1].replace(/\*\*/g, ''), sessionNumber: Number(match[2]) }));
  if (!rules.length) throw new Error('TABLE-FACTS: no house rules found');
  return {
    dm: requireMatch(section('The DM'), /^\*\*([^*]+)\*\*/m, 'DM').replace(/\.$/, ''),
    edition: requireMatch(game, /D&D 5e on the \*\*([^*]+)\*\*/, 'rules edition'),
    levelCap: Number(requireMatch(game, /\*\*Level cap (\d+)\*\*/, 'level cap')),
    rules,
  };
}

/** Every reminder has explicit sources; a draft source suppresses its reminder. */
export function buildTableReference(
  markdown: string,
  sessions: CollectionEntry<'sessions'>[],
  characters: CollectionEntry<'characters'>[],
  npcs: CollectionEntry<'npcs'>[],
) {
  const facts = readTableFacts(markdown);
  function publishedSession(number: number) {
    const session = sessions.find((entry) => entry.data.sessionNumber === number);
    if (!session) throw new Error(`Table reference: missing source Session ${number}`);
    return isSessionPublished(session) ? session : undefined;
  }
  function recap(number: number, scene?: string): TableCitation | undefined {
    const session = publishedSession(number);
    if (!session) return;
    if (scene && !recapScenes(session.body ?? '').some((part) => part.id === scene)) {
      throw new Error(`Table reference: missing source scene ${session.id}#${scene}`);
    }
    return { label: `Session ${number}`, href: `/sessions/${session.id}/${scene ? `#${scene}` : ''}` };
  }
  function character(id: string): TableCitation {
    const entry = characters.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`Table reference: missing character source ${id}`);
    return { label: entry.data.name, href: `/characters/${entry.id}/` };
  }
  function npc(id: string): TableCitation {
    const entry = npcs.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`Table reference: missing NPC source ${id}`);
    return { label: entry.data.name, href: `/npcs/${entry.id}/` };
  }

  const gameSource = recap(0, 'scene-s9767c43460');
  const rules: TableRule[] = facts.rules.flatMap((rule) => {
    if (rule.text === `Level cap ${facts.levelCap}` || !publishedSession(rule.sessionNumber)) return [];
    const source = rule.text.includes('appraise')
      ? { ...character('bean-hootwhistle'), label: `Bean · ruled in Session ${rule.sessionNumber}` }
      : recap(rule.sessionNumber, rule.sessionNumber === 0 ? 'scene-s9767c43460' : undefined)!;
    return [{ text: rule.text, source }];
  });

  // These are recorded capabilities, not a full spell or companion ruleset.
  // Keep the establishing sessions alongside profile citations so unpublished
  // play never reaches this page through a current profile.
  const reminders: TableReminder[] = [];
  const messageSource = recap(8, 'scene-s2afd62fe4b');
  const watchSource = recap(8, 'scene-s689dc0dbb5');
  if (messageSource && watchSource) reminders.push({
    title: 'Thom’s Message',
    text: '120-foot range. Recipients can reply to Thom, but cannot initiate contact through his cantrip.',
    sources: [messageSource, watchSource, character('thom')],
  });
  const stoneSource = recap(7, 'scene-s177f7214f4');
  if (stoneSource && watchSource) reminders.push({
    title: 'Sending stones',
    text: '25 words per message, one message a day, any distance. Thom’s first message was cut off at the word limit; Dax’s later attempt could not work again until the next day.',
    sources: [stoneSource, watchSource],
  });
  const companionSource = recap(7, 'scene-sec840c7d26');
  const namingSource = recap(8, 'scene-s2afd62fe4b');
  if (companionSource && namingSource) reminders.push({
    title: 'Sage and Phantom',
    text: 'Phantom understands Sage without a spell. She needs Speak with Animals to understand his answers, spending a spell slot. In combat, she spends her action to command him.',
    sources: [npc('phantom'), character('sage')],
  });

  return {
    game: gameSource ? { dm: facts.dm, edition: facts.edition, levelCap: facts.levelCap, source: gameSource } : undefined,
    rules,
    reminders,
  };
}
