# The paste-in brief

For turning a session transcript into a recap **in an ordinary AI chat** — one
with no access to this repo. Claude Code, ChatGPT, Gemini, whatever is open.

The rest of the pipeline assumes an agent with the repo checked out, and
[`SESSION-WORKFLOW.md`](SESSION-WORKFLOW.md) is written for that. This file
exists for the other case: you have a transcript on your laptop and you want the
writing done now. The brief below carries everything a cold chat needs — the
table, the voice, the questions it must ask — so it can produce a recap that
lands in the repo with no rewriting.

**How to use it:** copy everything below the rule, fill in the four bracketed
fields at the top, paste the transcript under it, and send. Expect a batch of
numbered questions back before any prose. That is the brief working.

What comes back is the recap file and a list of the other pages the session
touches. Paste both into a repo-capable agent — or apply them by hand against
the checklist in [`SESSION-WORKFLOW.md`](SESSION-WORKFLOW.md), which is what
actually keeps the site from contradicting itself.

If the chat *does* have the repo, don't use this. Point it at
[`../AGENTS.md`](../AGENTS.md) and use the kickoff prompt at the bottom of
[`SESSION-WORKFLOW.md`](SESSION-WORKFLOW.md) instead; reading the actual files
beats any summary of them.

---

You are writing the session recap for a *Dragon of Icespire Peak* D&D campaign
chronicle. Below this brief is the raw transcript of the session, produced by
whisperx from a single room mic. It is imperfect: names are mangled, people talk
over each other, and nothing in it marks whether a line was said in character or
across the table.

**Session:** [N] · **Played:** [DATE] · **Present:** [PLAYER NAMES]
**Speaker map:** [SPEAKER_00 = …, SPEAKER_01 = …, or "none — not diarized"]

## The table

The DM is **Owen**. He voices every NPC and narrates, so one speaker label
covers every non-player voice in the room. The players and their characters:

| Player | Character | Ancestry & class |
| --- | --- | --- |
| Nolan | Rut ("Friend") | Forest Gnome Druid |
| Nate | Thom | Half-Elf Sorcerer |
| Jay | Hamish | Wood Elf Ranger |
| Christa | Bean Hootwhistle | Halfling Rogue |
| Joseph | Barnaby | Dragonborn Paladin |
| Brittany | Sage | Wood Elf Ranger |
| Samuel | Dax | Human Fighter |

D&D 5e, 2014 rules, level cap 6, party at level 3. House rules: Neverwinter is
not used; ammunition and weight are not tracked unless special or ridiculous;
Bean can appraise valuables on an Intelligence check at disadvantage.

Hamish and Sage are both wood elf rangers who scout together — "the ranger" is
never unambiguous. "Friend" is Rut, whose real name the party does not know.
"The weasel" is usually Rut wild-shaped; "the panther" is Phantom, Sage's
companion. The guildmaster is **Holia Thornton** (Zhentarim, hostile); the
townmaster is **Harbin Wester** (nervous, an ally). They are opposites and
swapping them inverts the plot.

Correct every proper noun against these spellings: Abbathor · Adabra Gwynn ·
Axeholm · Barnaby · Bean Hootwhistle · Conyberry · Dax · Dazlyn Grayshard ·
Facktoré · Gnomengarde · Hamish · Harbin Wester · Holia Thornton · Icespire Peak
· King Korboz · Leilon · Miner's Exchange · Norbus Ithermel · Phandalin ·
Phantom · Queen Gnerkli · Rut · Sage · Savras · Thom · Umbrage Hill · The
Zhentarim. A name that isn't on this list and sounds like one is a question, not
a guess.

## Ask before you write

**This is the part that matters, and it is not optional.** Do not produce prose
in your first reply. Read the transcript, find every place you are about to
guess, and ask instead — **one numbered batch, best guess attached to each
question** so the answer can be "yes" or a three-word correction:

> 7. The party splits the chest 36gp each. I read that as 255gp across seven —
>    the chest's 150 plus both quest payouts. Right?

Ask about, at minimum:

- **Every name** the transcript garbled, and every name new to the campaign.
- **Who did a thing**, wherever the transcript says "I'll grab it" with no
  antecedent, or the speaker map is ambiguous.
- **In character, or at the table?** A DM's aside, a player's joke, and a
  character's line look identical in a transcript. This is the most common error
  by a distance.
- **The order and the count** of anything that happened more than once. Three
  attempts at a window get flattened into two by a careless reading, and every
  beat after that lands on the wrong person.
- **Who knew what, and when.** Who was in the room, who was told afterwards, who
  still has not been told. A recap that gets the events right and the knowledge
  wrong is still wrong.
- **Agreed versus done.** Money offered is not money paid; a deal struck is not
  a deal honoured. Say which it was.
- **Anything you inferred.** If the transcript implies a conclusion and nobody
  stated it, ask whether the table actually reached it.
- **Mechanics that changed the fiction** — who dropped, who stabilised them,
  what a spell did, level-ups, what a roll revealed. The numbers stay out of the
  prose but they decide what happened.
- **Loot:** exact amounts, who carries what, whether it was appraised, how it
  was split.
- **What the party believes versus what is true.** The chronicle is written from
  what the party knows, and it is wrong wherever they are wrong.

**Never** invent dialogue, fill a gap from your knowledge of the published
module, or smooth over an unclear passage with vague prose to avoid asking. "I
could not tell what happened between the chest and the tunnel — what did I
miss?" is worth more than a paragraph that reads well and is false.

Expect to ask a second, smaller round once a draft exists. That is normal.

## The voice

Past tense, third person, close to the table. A chronicle, not a session report:
it records what people did, in order, without commentary and without a narrator
who is impressed by anything. Short declarative sentences; a paragraph is
usually one beat. Understatement does the work.

- **Player-character speech is in double quotes.** *"You did run off," Thom
  said.*
- **NPC speech — anything Owen voices — is italicised and unquoted.** So is
  anything else arriving from outside the room: a sending-stone message, an
  animal answering *Speak with Animals*, a note read aloud. This convention is
  load-bearing; getting it backwards puts a player's line in the DM's mouth.
- **Scene breaks are `---` on its own line.** Open in the middle of something.
  End on the beat the session ended on, hard, with no wrap-up.
- **No meta.** Never "the party decided to", "in this session", "the DM
  described".
- **Comedy is reported deadpan.** Never explain a joke or signpost one.
- **No dice, DCs, modifiers, or spell slots in the prose.** "Bean checked for
  traps twice and was confident there were none" — not the roll. Mechanics go in
  a callout or nowhere.
- **Nothing from the published module the party has not discovered.** You may
  know what is in the next dungeon. The chronicle does not.
- **No player real names in the prose**, no emoji, anywhere.
- **Write names plainly and do not add Markdown links.** The site links them
  automatically from the name itself.
- **A blockquote renders as a pull quote.** One or two per recap, for the line
  the session will be remembered for, with `> <footer>— attribution</footer>`
  inside it.

**Record what happened, not what it meant.** The recurring failure. A room with
two pedestals is a room with two pedestals, even when a ledger you have read
describes a sacrifice chamber — the party never named it, so neither does the
recap. Where a connection is worth making, mark it as one: "which is what the
ledger describes", never "the sacrifice chamber". If nobody at the table said
it, do not assert it.

**Do not let a phrase hide a fact the reader has to follow.** Two characters
turning invisible is a plain event the next three scenes depend on; write that
they vanished where they stood, not that they went out of the world. Style never
costs the reader a mechanic they need.

## What to hand back

First the recap, as one Markdown file in a fenced block, frontmatter included:

```markdown
---
title: 'The Town Finds Out, a Deal in the Dark, and a Trap Door'
sessionNumber: 8
date: 2026-09-04
summary: 'One sentence, the same deadpan register, naming the three things that happened.'
playersPresent: ['Nolan', 'Nate', 'Jay', 'Christa', 'Joseph', 'Brittany', 'Samuel']
encounters:
  - name: 'Seven Orcs'
    image: '/images/creatures/orc.webp'
    note: 'A raiding band scouting the ruin as a fort.'
---
```

The title is usually a rhythm of three, no colon and no session number. A full
session runs roughly 200–400 lines.

Then, as a plain list, what else the session changes — because a recap on its
own leaves the site contradicting itself:

- **Where the party went**, as an ordered list of places, plus the two or three
  events worth pinning to a place on a map and a timeline (one factual sentence
  each, readable away from the recap).
- **Each character** who did something: a *Notable deeds* bullet tagged
  `(Session N)`, and any level-up.
- **Each NPC**: who is new, and whose standing with the party changed. The bar
  for calling someone an ally is real material aid, not politeness.
- **Places**: newly heard of, seen, entered, or destroyed.
- **Documents, items, and loot** the party took or learned about.
- **Threads**: which closed, which opened, which moved — written as unanswered
  questions or unpaid debts.
