# Publishing a session, start to finish

How a played session of D&D becomes a page on
[icespire.ghostbloods.net](https://icespire.ghostbloods.net/). The pipeline is:

```
record the table  →  whisperx on the MacBook  →  hand the transcript to a coding agent
                  →  the agent asks clarifying questions  →  the agent writes the recap
                  →  it propagates the session across the whole site  →  build, PR, deploy
                  →  the table reads it and corrections come back
```

Steps 1–2 are the owner's, on their laptop. Steps 3 onward are the agent's, and
the rest of this document is written to be handed to one cold.

Two documents go with this one and are not optional: **[`WRITING-STYLE.md`](WRITING-STYLE.md)**
for the prose, and **[`../AGENTS.md`](../AGENTS.md)** for how the repo works.
**[`TABLE-FACTS.md`](TABLE-FACTS.md)** holds the roster, the DM, the house rules
and the name spellings — read it before the transcript.

Working in a plain chat window instead of an agent with the repo checked out?
**[`TRANSCRIPT-BRIEF.md`](TRANSCRIPT-BRIEF.md)** is all of this packed into one
self-contained prompt you paste with the transcript.

---

## 1. Record the session

Any recorder that produces one audio file for the table. A single room mic is
what this has been built on — the transcript is imperfect and the clarifying
round exists because of that.

Name the file for the session (`session-08.m4a`). Keep the raw audio and the
transcript **out of this repo** — `transcripts/` is gitignored so a file dropped
there by accident cannot be committed. The published recap is the artifact; the
transcript is scaffolding, and it contains hours of table talk nobody agreed to
publish.

## 2. Transcribe with whisperx

On the MacBook. The shape of the command — check it against your installed
version, whisperx's flags move around between releases:

```sh
whisperx session-08.m4a \
  --model large-v3 \
  --language en \
  --diarize \
  --min_speakers 6 --max_speakers 8 \
  --device cpu --compute_type int8 \
  --output_format all \
  --output_dir transcripts/session-08
```

Things that reliably bite:

- **Apple Silicon has no GPU path here.** faster-whisper does not run on MPS,
  so `--device cpu --compute_type int8` is the working configuration. Expect
  roughly real-time-ish on a long session; start it and go do something else.
- **Diarization needs a Hugging Face token** (`--hf_token …`) and acceptance of
  the pyannote model terms on the Hub, once. Without `--diarize` you get one
  undifferentiated wall of text, which makes the whole downstream job much
  harder — it is worth the setup.
- **Diarization labels are `SPEAKER_00`, not names**, and it will merge or split
  people. Skim the first few minutes and write down which label is which player.
  You are also going to need which player runs which character, and the fact
  that **the DM voices every NPC** — so one speaker label covers Harbin, Norbus,
  Adabra, and the narration.
- The `.txt` output is the one to hand over. Keep the `.srt`/`.vtt` around;
  timestamps are useful when a question is "what exactly did they say at 2:14".

The transcript will get names wrong — fantasy names especially. `Abbathor`,
`Dazlyn`, `Gnomengarde`, and `Facktoré` come back mangled every time. Do not
try to clean it up by hand; the agent has the whole site's spellings to correct
against, and asks about the rest.

## 3. Hand it to a coding agent

Open the repo in whatever tool you like and give it the transcript plus a
kickoff. There is a copy-paste prompt at the bottom of this document.

The brief in [`TRANSCRIPT-BRIEF.md`](TRANSCRIPT-BRIEF.md) is the version to
paste into a tool that cannot read this repo. Either way, along with the
transcript the agent needs three things it cannot get from the audio:

1. **The session number and the real-world date** (the `date` frontmatter is the
   date it was played).
2. **Who was at the table**, by player name — this becomes `playersPresent`, and
   an absent player's character usually should not act in the recap.
3. **The speaker map**, if diarization was used: `SPEAKER_00 = Nolan (Thom)`,
   and so on, plus which label is the DM.

## 4. What the agent reads before writing anything

Do not start from the transcript. Start from what the site currently says, or
you will contradict it.

- The previous session's recap (`src/content/sessions/session-N-1.md`) — the
  recap picks up where it left off, sometimes mid-fight.
- `src/pages/campaign.md`, especially **Open threads**. Most of a session is
  threads getting pulled, and the recap should land the ones that resolved.
- The character, NPC, faction, lore, and location files for everyone the
  transcript mentions. Their current `status` values are the state you are about
  to change.
- `git log` for the last session's commits, for the shape of the work.
- **[`TABLE-FACTS.md`](TABLE-FACTS.md)** — the roster, the house rules, and the
  spellings to correct the transcript against.
- **[`WRITING-STYLE.md`](WRITING-STYLE.md)**, in full.

## 5. The clarifying round — the part that matters

A room mic misses things, players talk over each other, and the transcript
cannot tell you whether a line was said in character or across the table. The
job at this stage is not to write; it is to find every place where you are about
to guess, and ask instead.

**Ask in one batch, numbered, before writing.** Not a drip of one question at a
time. Attach your best reading to each one so the answer can be "yes" or a
three-word correction rather than an essay:

> 7. The transcript has the party splitting the chest 36gp each. I read that as
>    255gp across seven — the chest's 150 plus both quest payouts. Right?

**Always ask about:**

- **Names and spellings** the transcript garbled, and any name new to the site.
- **Who did a thing**, when diarization only gives you a voice, or when the
  transcript says "I'll grab it" with no antecedent.
- **In character or at the table?** The single most common error. A DM's aside,
  a player's joke, and a character's line all look identical in a transcript.
  Session 7 shipped with a line the DM said at the table put in Dax's mouth in
  the fiction, and it had to be corrected after publication.
- **Order of events**, when scenes were interleaved or the recording jumps.
  Session 7's dragons-eat-people conversation was published with the wrong
  ordering and the wrong instigator, and needed a correction commit.
- **Anything you inferred.** If the transcript implies a conclusion but nobody
  stated it, ask whether the table actually reached it. Session 7 called a room
  "the sacrifice chamber" because it matched the ledger's description — the
  table never identified it, and the recap had to be retitled.
- **Mechanics that changed the fiction**: who dropped, who stabilised them, what
  a spell actually did, level-ups, what a roll revealed. The numbers stay out of
  the prose (see the style guide) but they determine what happened.
- **Loot**: exact amounts, who is carrying what, whether it was appraised, how
  it was split.
- **What the party believes vs. what is true.** The chronicle is written from
  what the party knows. If the DM revealed something to one player privately, ask
  where it belongs — sometimes the answer is a character page rather than the
  recap.
- **Which threads closed**, and what new ones opened. This is the Open threads
  rewrite in `campaign.md`.

**The four that the correction commits keep catching**, worth a deliberate pass
of their own before you send the questions:

- **Order and count of a repeated action.** Session 8's draft folded three
  attempts at a window into two, which put Hamish stuck on Barnaby's shoulders
  at the moment he was supposed to be watching Dax get caught. Everything after
  a flattened repetition lands on the wrong person. Count them in the
  transcript; do not summarise them from memory of what you just read.
- **Who knew what, and when.** Sage watched Rut turn into a weasel and told Dax,
  which is why a weasel rode on Dax's shoulder all night; the draft had the
  party ignorant of it. Only Thom and Bean heard Thornton say she means to be
  townmaster — Rut, under the door, heard the negotiation and not the speech.
  Track knowledge separately from events, and ask who was told afterwards.
- **Agreed versus paid, offered versus done.** Harbin *agreed* a hundred gold;
  nothing has been brought to him and nothing has been paid. A draft that
  collapses the two closes a thread that is still open.
- **Negotiation order.** Who conceded what, and in which direction, is usually
  the whole character beat. Dax closed his terms before handing anything over,
  and the draft had him volunteering it — the same events, an inverted person.

**Never**: invent dialogue, fill a gap from your knowledge of the published
module, or paper over an unclear passage with vague prose so you do not have to
ask. An honest "I could not tell what happened between the chest and the tunnel
— what did I miss?" is worth more than a smooth paragraph that is wrong.

Expect a second, smaller round after a draft exists. That is normal and it is
how the last several sessions went.

## 6. Write the recap

`src/content/sessions/session-N.md`. Frontmatter per `src/content.config.ts`:
`title`, `sessionNumber`, `date`, `summary`, `playersPresent`, and an
`encounters` list of creatures met (art already exists for all twenty official
creatures under `public/images/creatures/`; add `href` to point at an NPC page
where there is one).

Everything about the prose itself is in **[`WRITING-STYLE.md`](WRITING-STYLE.md)**.
Sessions 6 and 7 are the model.

## 7. Propagate the session across the site

A recap on its own leaves the site contradicting itself. This checklist is drawn
from what the Session 6 and Session 7 commits actually touched — walk it every
time, and skip an item deliberately rather than by forgetting it.

- [ ] **`src/content/sessions/session-N.md`** — the recap.
- [ ] **`src/content/journey/session-N.yaml`** — the ordered `route` of location
      slugs and the `events` pinned to them. Include intermediate stops on a
      return trip so the trail overlaps instead of cutting a new line. Unknown
      slugs fail the build. This feeds both the map and the timeline.
- [ ] **`src/pages/campaign.md`** — three edits: a new
      `### Session N — Title (M/D/YY)` block at the end of *The story so far*;
      the *Last updated* line at the top; and a rewritten **Open threads** list
      — remove what resolved, add what opened, edit what moved. Note the
      campaign summary is compressed narrative, not a copy of the recap.
- [ ] **`src/content/characters/*.md`** — a *Notable deeds* bullet or two per
      character who did something, tagged `(Session N)`. Update `level` on a
      level-up, and `tagline`/`traits` when a character genuinely changes.
      Longer-running character developments get their own section (see the
      "Dax and Rut" section on `dax.md`).
- [ ] **`src/content/npcs/*.md`** — new NPCs met; `status` changes (this recolours
      the relationship graph); `note` rewrites; `firstAppearance` on new entries.
      Splitting or merging entries is fair game when the story does — Session 7
      split one combined dwarf-brothers entry into a live thread and a grave.
- [ ] **`src/content/factions/*.md`** — new factions, changed `status` or
      `alignment`.
- [ ] **`src/content/lore/*.md`** — documents found, items taken, places
      understood. The magic-item haul entry is the running loot list.
- [ ] **`src/content/locations/*.md`** — `status` flips (`unknown` → `rumored` →
      `known` → `visited`), `interiorSeen` when they go inside, `danger`,
      `firstVisited`, and the body write-up. Flipping a location to `visited`
      publishes its local sub-map page, so only do it when they were actually
      there.
- [ ] **`src/components/map/submaps/*.astro`** — reveal rooms and features the
      party has now seen. Keep undiscovered secrets off the map.
- [ ] **`docs/ROADMAP.md`** — if the session's work completed a roadmap item.
- [ ] **Schema and design system**, only when the story demands it. Session 7
      needed a `deceased` NPC status that did not exist: that meant
      `src/content.config.ts`, `StatusPill.astro`, `EntityLinks.astro`, the graph
      legend, colour tokens in both themes, and the README's status ladder —
      all in the same commit as the session. If you add a status value, follow
      that same trail.

Nothing needs doing for the timeline, the relationship graph, search, or the
per-session social card. They are all derived at build time.

## 8. Verify

```sh
npm run check && npm run build
```

The build validates every frontmatter field and every journey slug. Then
`npm run dev` and actually look at: the new recap, `/sessions/`, `/campaign/`,
`/map/` (the new route and pins), `/timeline/`, `/graph/` if a status changed,
and any NPC or location page you touched. Search for a new name in the palette
(`⌘K`) to confirm it indexed.

## 9. Commit, PR, deploy

One commit for the session is the pattern, with the body grouped by area and
written in campaign terms. Branch, push, open a PR, let CI build it. Merging to
`main` deploys to Cloudflare Pages automatically — there is nothing else to run.

## 10. The correction loop

The table reads the recap after it is live, and remembers things the transcript
did not carry. This is expected: Session 7 took four follow-up commits after the
initial write-up. Each correction is its own small commit whose message says
what was wrong and what is now right, and each one propagates the same way the
session did — a fact fixed in the recap usually has to be fixed on a character
page and in the campaign summary too.

When a correction comes in, ask what the table actually said before rewriting.
The corrections that stuck were the ones that replaced a plausible reconstruction
with what really happened.

---

## Kickoff prompt

Paste this into a fresh agent, with the transcript attached or pasted below it.

> You are picking up the Icespire campaign website. Read `AGENTS.md`,
> `docs/TABLE-FACTS.md`, `docs/SESSION-WORKFLOW.md`, and
> `docs/WRITING-STYLE.md` first, then read the previous session's recap and the
> Open threads in `src/pages/campaign.md`.
>
> Attached is the whisperx transcript of **Session N**, played **DATE**.
> Present: **PLAYERS**. Speaker map: SPEAKER_00 = …, SPEAKER_01 = … (the DM is
> SPEAKER_0X and voices every NPC).
>
> Follow the workflow doc. Before writing anything, give me one numbered batch
> of clarifying questions, each with your best guess attached so I can just
> confirm or correct it. Ask about anything you would otherwise be inventing —
> especially names, who did what, whether a line was in character or table talk,
> and any conclusion the transcript implies but nobody actually stated.
>
> Then write the recap and propagate it across the site using the checklist,
> run `npm run check && npm run build`, and open a PR.
