// "Ask the Chronicle" — the model half of the search palette.
//
// Deliberately second: the ranked results are already on screen, and most
// questions ("who was that priest?") are answered by them for free. This only
// runs when the reader decides the list didn't answer them and asks, so a
// model call is always a choice rather than a side effect of typing.

type AskResponse = {
  answer?: string;
  error?: string;
  sources?: { title: string; kind: string; href: string }[];
};

export type Ask = {
  /** Offer to ask about `query`, discarding any answer already shown. */
  offer(query: string): void;
  clear(): void;
};

export function createAsk(container: HTMLElement, endpoint: string): Ask {
  let current = '';
  let inFlight: AbortController | null = null;

  const clear = () => {
    inFlight?.abort();
    inFlight = null;
    current = '';
    container.replaceChildren();
    container.hidden = true;
  };

  const say = (className: string, text: string) => {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    return p;
  };

  async function run(query: string) {
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;

    container.replaceChildren(say('ask-status', 'Consulting the chronicle…'));

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
        signal: controller.signal,
      });
      const data = (await res.json()) as AskResponse;
      if (controller.signal.aborted) return;

      if (!res.ok || !data.answer) {
        container.replaceChildren(
          say('ask-status', data.error ?? 'The chronicler could not answer just now.')
        );
        return;
      }

      const wrap = document.createDocumentFragment();
      wrap.append(say('ask-answer', data.answer));

      if (data.sources && data.sources.length > 0) {
        const cite = document.createElement('p');
        cite.className = 'ask-sources';
        cite.append('Drawn from ');
        data.sources.forEach((s, i) => {
          if (i > 0) cite.append(i === data.sources!.length - 1 ? ' and ' : ', ');
          const a = document.createElement('a');
          a.href = s.href;
          a.textContent = s.title;
          cite.append(a);
        });
        cite.append('.');
        wrap.append(cite);
      }

      container.replaceChildren(wrap);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      container.replaceChildren(say('ask-status', 'The chronicler could not be reached.'));
    } finally {
      if (inFlight === controller) inFlight = null;
    }
  }

  return {
    offer(query: string) {
      if (query === current) return; // same question, keep whatever is shown
      inFlight?.abort();
      inFlight = null;
      current = query;
      container.hidden = false;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ask-trigger';
      const label = document.createElement('span');
      label.className = 'ask-trigger-label';
      label.textContent = 'Ask the chronicle';
      const echo = document.createElement('span');
      echo.className = 'ask-trigger-query';
      echo.textContent = `“${query}”`;
      button.append(label, echo);
      button.addEventListener('click', () => void run(query));

      container.replaceChildren(button);
    },
    clear,
  };
}
