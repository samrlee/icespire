# The chronicle's voice

How campaign prose is written on this site. Sessions 6 and 7
(`src/content/sessions/session-6.md`, `session-7.md`) are the model — read one
before writing. Earlier sessions are shorter and rougher and predate some of
these conventions; do not copy Session 5's bulleted mechanics.

This guide covers recaps first, because they are the hardest, and then the
other content types, which are all compressions of the same material.

## The register

**It is a chronicle, not a session report.** Past tense, third person, told
straight and close to the table. It records what people did, in the order they
did it, without commentary and without a narrator who is impressed by anything.
Understatement does the work:

> Dax went to the leader. The armor was the thing that had bothered him since
> the fight: chain mail, well made, nothing orcish about it.

**Short declarative sentences carry the weight; the long ones earn their
length.** A paragraph is usually one beat.

**No meta.** No "the party then decided to", no "in this session", no "the DM
described". The reader is watching it happen, not being briefed. The one
exception is the rare aside about the table itself when the table *is* the story
("Nobody at the table could say what the note beside the map meant"), used
sparingly.

**Comedy is reported deadpan, never signposted.** The panther, the orc eye,
Rut's squirrels — all of it lands because it is written down exactly as
seriously as the deaths are. Never explain a joke, never tell the reader
something was funny.

**No emoji, ever.** Anywhere on the site.

## Dialogue

This is a real convention and it is load-bearing, because the DM voices every
NPC and the distinction would otherwise be lost:

- **Player-character speech goes in double quotes.**

  > "You did run off," Thom said.

- **NPC speech — anyone the DM voices — is italicised, unquoted.**

  > *Well, of course. What are we going to do against a bunch of heavily armed
  > adventurers? We're just miners.*

- **So is anything else arriving from outside the room**: a sending-stone
  message, an animal answering *Speak with Animals*, a written note read aloud.

Attribute where it matters and let it stand bare where it does not. Do not
invent dialogue to smooth a scene: if you do not know the words, narrate the
beat instead.

## Structure

- **Scene breaks are `---` on its own line.** A recap is a sequence of scenes,
  each a few paragraphs. The break does the transition work, so paragraphs never
  need "meanwhile" or "later that day".
- **Open in the middle of something.** "They woke on the floor of the temple
  where they had fallen, among seven dead orcs going stiff in the cold." Not a
  summary of what is about to happen.
- **End on the beat the session ended on**, hard, with no wrap-up. Session 7
  ends on three lines and stops.
- **Length follows the session**, roughly 200–400 lines for a full one.

## Pull quotes and callouts

A Markdown blockquote renders as a gold-bordered pull quote automatically. Give
it an attribution with a `<footer>` inside:

```markdown
> May all offerings to Abbathor forever cease. If you have found this room and
> you have survived, take what remains.
>
> <footer>— the note left in the last offering chest</footer>
```

Use them for the line the session will be remembered for, or for a document the
party found. One or two per recap; a page of pull quotes is a page with no
emphasis at all.

**Game mechanics live in callouts, not in narrative prose** — that rule comes
from the design system. `loot`, `magic-item`, and `house-rule`:

```html
<div class="callout loot">
  <div class="callout-label">Loot</div>
  <div class="callout-title">The Great Emerald &amp; the Last Offering</div>
  <div class="callout-body">150 gold and 70 tarnished silver, left with written
  permission to take it.</div>
</div>
```

## What never appears in narrative prose

- **Dice, DCs, modifiers, spell slots, action economy.** The fiction is what
  happened; the mechanics that produced it belong in a callout, on a character
  page's *Notable deeds*, or nowhere. "Bean checked for traps twice and was
  confident there were none" — not the roll.
- **Rules language.** "Spent a spell" and "burned an Action Surge" are as close
  as it gets, and both read as fiction.
- **Anything from the published module the party has not discovered.** You may
  know what is in the next dungeon. The chronicle does not. This holds for lore
  entries and maps as much as for recaps.
- **Real-world names of players**, in the prose. Players appear in
  `playersPresent` frontmatter and in the `player` field on a character; the
  prose says Thom, not Nolan.

## Record what happened, not what it meant

The recurring failure mode, and the one that has needed the most correcting.

The transcript gives you a room with two pedestals; the ledger describes a
sacrifice chamber; it is tempting to call the room the sacrifice chamber.
Nothing in the room named itself, and the party never identified it — so the
recap said as fact something that was only inference, and had to be retitled
after publication. The same instinct put a DM's table-talk line into a
character's mouth, and gave a sending-stone message words the 25-word limit had
actually cut off.

The rules that came out of it:

- **If nobody at the table said it, do not assert it.** Describe what was seen
  and let the reader draw the line.
- **Where a connection is worth making, mark it as one** — "which is what the
  ledger describes" rather than "the sacrifice chamber".
- **Write from what the party knows.** If they are wrong about something, the
  chronicle is wrong with them, and the truth arrives when they learn it.
- **When you cannot tell, ask.** See the clarifying round in
  [`SESSION-WORKFLOW.md`](SESSION-WORKFLOW.md).

## Names and links

Write names plainly and do not hand-write links to site pages inside recap
prose. `EntityLinks.astro` turns the first mention of any character, NPC,
faction, or known location into a link with a hover card. Full name on first
mention in a scene; the linker also matches distinctive single-word aliases
("Thornton", "Dazlyn"). Bold is for emphasis the sentence cannot carry on its
own, not for names.

## The other content types

Each compresses the same material for a different reader:

- **Session `summary` frontmatter** — one sentence, the card excerpt, present the
  three things that happened. Same deadpan register: "The last room in the temple
  gives up an emerald and a written blessing to rob the place, a dead dwarf is
  carried home to his brother — and the dragon stops being a rumor."
- **Session title** — usually a rhythm of three, no colon, no session number:
  *The Hidden Chamber, a Debt Paid, and a Dragon*.
- **Campaign summary** (`src/pages/campaign.md`) — tighter and more informational
  than a recap; a reader catching up in five minutes. Bold the load-bearing
  nouns. **Open threads** are one bullet each, written as an unanswered question
  or an unpaid debt, and they get *rewritten* every session rather than appended
  to.
- **Character pages** — the roster bio, then *Notable deeds* as bullets tagged
  `(Session N)`, then any standing arrangements or running bits that need their
  own section. Mechanics are allowed here.
- **NPC pages** — who they are, what happened with the party, and what is
  unsettled. The `note` field is the one-line directory blurb and should have a
  point: "Means well. Is in over his head."
- **Lore entries** — written as what the party has learned about a thing, not as
  an encyclopedia entry about the thing.
- **Location bodies** — what the place is like now, in the party's experience of
  it. A destroyed place says so.
- **Journey event notes** — one or two sentences, factual, present tense of the
  moment. They appear on the map and the timeline, so they read on their own,
  away from the recap.
