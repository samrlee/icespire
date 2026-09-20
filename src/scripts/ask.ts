import { corpusVersion, safeSourceHref } from '../lib/ask-safety';
import type { SearchDoc } from '../lib/search-rank';

type Source = { title: string; kind: string; href: string };
type Answer = { answer: string; sources: Source[]; corpusVersion?: string };
type Saved = Answer & { question: string; version: string };
export type Ask = { offer(query: string): void; clear(): void; prepare(): void; setCorpus(docs: SearchDoc[]): Promise<void> };

export function createAsk(container: HTMLElement, endpoint: string, restoreQuery: (query: string) => void): Ask {
  let current = '';
  let inFlight: AbortController | null = null;
  let version = '';
  let known = new Map<string, SearchDoc>();
  let saved: Saved | null = null;
  const key = 'icespire-saved-answer';
  const retention = document.createElement('div');
  retention.className = 'search-status';
  container.after(retention);
  const say = (className: string, text: string, tag: 'p' | 'span' = 'p') => {
    const p = document.createElement(tag); p.className = className; p.textContent = text; return p;
  };
  const button = (text: string, action: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ask-trigger';
    b.textContent = text; b.addEventListener('click', action); return b;
  };
  const sources = (value: unknown): Source[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((s): s is Source => {
      if (!s || !safeSourceHref(s.href)) return false;
      const doc = known.get(s.href);
      return !!doc && doc.title === s.title && doc.kind === s.kind;
    }).slice(0, 5);
  };
  const savedControls = () => {
    retention.replaceChildren();
    if (!saved) return;
    retention.append(say('', `Saved in this tab: “${saved.question}”`),
      button('Restore saved answer', () => {
        if (!saved) return;
        inFlight?.abort(); inFlight = null;
        const record = saved;
        restoreQuery(record.question);
        current = record.question;
        showAnswer(record.question, record);
      }),
      button('Forget saved answer', () => {
        saved = null;
        try { sessionStorage.removeItem(key); retention.replaceChildren(say('', 'Saved answer forgotten.')); }
        catch { retention.replaceChildren(say('', 'Storage is unavailable; the saved answer could not be removed.')); }
        container.closest('form')?.querySelector<HTMLInputElement>('input')?.focus();
      }));
  };
  const clear = () => {
    inFlight?.abort(); inFlight = null; current = '';
    container.replaceChildren(); container.hidden = true;
  };
  const showAnswer = (query: string, data: Answer) => {
    container.hidden = false;
    container.replaceChildren(say('ask-answer', data.answer));
    const valid = sources(data.sources);
    if (valid.length) {
      const cite = say('ask-sources', 'Sources consulted: ');
      valid.forEach((source, i) => {
        if (i) cite.append(', ');
        const a = document.createElement('a'); a.href = source.href; a.textContent = source.title; cite.append(a);
      });
      container.append(cite, say('ask-status', 'These passages were supplied to the chronicler; they do not independently verify every claim.'));
    }
    if (data.corpusVersion === version && version) container.append(button('Save answer in this tab', () => {
      const record: Saved = { question: query, answer: data.answer, sources: valid, corpusVersion: version, version };
      try { sessionStorage.setItem(key, JSON.stringify(record)); saved = record; savedControls(); }
      catch { retention.replaceChildren(say('', 'This browser cannot save answers in this tab.')); }
    }));
  };
  async function run(query: string) {
    inFlight?.abort();
    const controller = new AbortController(); inFlight = controller;
    container.replaceChildren(say('ask-status', 'Consulting the chronicle…'), button('Cancel question', () => {
      controller.abort(); inFlight = null; current = ''; offer(query);
      container.querySelector('button')?.focus();
    }));
    const timer = setTimeout(() => {
      controller.abort();
      if (inFlight === controller) { inFlight = null; container.replaceChildren(say('ask-status', 'The chronicler took too long. Search still works.'), button('Try question again', () => void run(query))); }
    }, 25_000);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: query }), signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted || current !== query) return;
      if (!res.ok || typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 8000) {
        container.replaceChildren(say('ask-status', typeof data.error === 'string' ? data.error : 'The chronicler could not answer just now.'), button('Try question again', () => void run(query))); return;
      }
      showAnswer(query, { answer: data.answer, sources: sources(data.sources), corpusVersion: data.corpusVersion });
    } catch {
      if (controller.signal.aborted) return;
      container.replaceChildren(say('ask-status', 'The chronicler could not be reached.'), button('Try question again', () => void run(query)));
    } finally { clearTimeout(timer); if (inFlight === controller) inFlight = null; }
  }
  const offer = (query: string) => {
    if (query === current) return;
    inFlight?.abort(); inFlight = null; current = query; container.hidden = false;
    const trigger = button('', () => void run(query));
    trigger.append(say('ask-trigger-label', 'Ask the chronicle', 'span'), say('ask-trigger-query', `“${query}”`, 'span'));
    container.replaceChildren(trigger);
  };
  return { offer, clear, prepare() { retention.hidden = true; }, async setCorpus(docs) {
    known = new Map(docs.map(doc => [doc.href, doc]));
    version = await corpusVersion(docs);
    retention.hidden = false;
    saved = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        let record; try { record = JSON.parse(raw); } catch { record = null; }
        if (record?.version === version && record.corpusVersion === version && typeof record.question === 'string' && record.question.trim() && record.question.length <= 400 && typeof record.answer === 'string' && record.answer.trim() && record.answer.length <= 8000 && Array.isArray(record.sources) && record.sources.length <= 5 && sources(record.sources).length === record.sources.length) saved = record;
        else { sessionStorage.removeItem(key); retention.replaceChildren(say('', 'The saved answer was cleared because the chronicle changed or the record was invalid.')); return; }
      }
      savedControls();
    } catch { retention.replaceChildren(); }
  } };
}
