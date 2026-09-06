# The table

Facts about the game itself that the repo either never states or states once, in
passing, inside a session recap. A tool can read every collection here and still
not know who the DM is, what the house rules are, or which two characters a
transcript line about "the ranger" might mean.

This is the ground truth. It changes slowly. Everything that changes weekly —
who is where, who knows what, what is unresolved — lives in
[`../src/pages/campaign.md`](../src/pages/campaign.md) under **Open threads**,
and that is the file to read for current state.

## The game

*Dragon of Icespire Peak*, D&D 5e on the **2014 rules**, Forgotten Realms, the
Phandalin region. **Level cap 6**; the party hit level 3 before Session 8.

Sessions 0 through 8 were played between 27 April and 4 September 2026 —
roughly monthly, occasionally twice in a month, and Session 0 and Session 1 ran
the same evening. A session's `date` frontmatter is the **real-world date it was
played**, never an in-fiction date. The chronicle does not track a calendar.

## The DM

**Owen.** He is named in `src/content/sessions/session-0.md` and at the top of
`campaign.md`, and nowhere else. He has no character file, never appears in
`playersPresent`, and is deliberately absent from `src/lib/entities.ts` — so his
name never auto-links and he never turns up in a recap's cast strip.

**He voices every NPC and narrates.** In a diarized transcript one speaker label
covers Harbin, Thornton, Norbus, King Korboz, the dragon, and every line of
description. This is the single most important fact about reading a transcript
of this table, and it is why the prose distinguishes quoted player speech from
italicised NPC speech — the distinction is carrying information the audio does
not.

## House rules

| Rule | Set in |
| --- | --- |
| The Neverwinter location is not used | Session 0 |
| No tracking of ammunition or weight, unless it is special ammunition or a ridiculous weight | Session 0 |
| Level cap 6 | Session 0 |
| Bean can **appraise** valuables — an Intelligence check, always at disadvantage, because she is a thief with an eye for it and not an expert | Session 7 |

New ones arrive mid-campaign. When one does, it gets a `callout house-rule` in
the recap of the session it was ruled in, a line on the character page if it
belongs to one character (see `bean-hootwhistle.md`), and a row here.

## The table, by player

Seven players. `playersPresent` takes these real first names; the prose never
does — it says Thom, not Nate.

| Player | Character | Ancestry & class | Joined |
| --- | --- | --- | --- |
| Nolan | Rut ("Friend") | Forest Gnome Druid | Session 1 |
| Nate | Thom | Half-Elf Sorcerer | Session 1 |
| Jay | Hamish | Wood Elf Ranger | Session 1 |
| Christa | Bean Hootwhistle | Halfling Rogue | Session 1 |
| Joseph | Barnaby | Dragonborn Paladin | Session 1 |
| Brittany | Sage | Wood Elf Ranger | Session 1 |
| Samuel | Dax | Human Fighter | Session 2 |

An absent player's character usually should not act in the recap. If the
transcript has them acting anyway — a player phoning in a decision, or the table
running someone's character for a fight — that is worth a question rather than
an assumption.

**The pairs that get confused.** Hamish and Sage are both wood elf rangers and
they scout together, so "the ranger" in a transcript is genuinely ambiguous —
ask every time. Rut and Thom met on the road and are usually in the same place.
Bean and Thom were the pair who went invisible in Session 8, which makes "the
two of them" ambiguous for that whole stretch.

## Names the transcript will mangle

Fantasy names come back wrong from whisperx every time, and a room mic makes it
worse. Correct every proper noun against this list before writing; anything not
on it that sounds like a name is a question for the clarifying round, not a
guess.

**People:** Abbathor · Adabra Gwynn · Barnaby · Bean Hootwhistle · Dax · Dazlyn
Grayshard · Facktoré (with the é) · Hamish · Harbin Wester · Holia Thornton ·
King Korboz · Norbus Ithermel · Phantom · Queen Gnerkli · Rut · Sage · Savras ·
Thom

**Places and groups:** Axeholm · Conyberry · Gnomengarde · Icespire Peak ·
Leilon · Miner's Exchange · Phandalin · Umbrage Hill · The Zhentarim

## Table shorthand

What the table says out loud, and what it means on the site:

- **"Friend"** is what the party calls Rut, because that is how he introduced
  himself. They have never learned his real name. The site knows it and the
  prose uses it.
- **"The weasel"** is almost always Rut wild-shaped. **"The panther"** is
  Phantom, who had no name until Sage used it in Session 8 — in Session 7 he is
  only the panther, and the recap keeps him that way.
- **"The guildmaster"** is Holia Thornton, of the Miner's Exchange and the
  Zhentarim. **"The townmaster"** is Harbin Wester. Both run something in
  Phandalin, they are on opposite sides, and swapping them inverts the plot.
- **The two dwarf prospectors** are brothers: Dazlyn, who is dead, and Norbus,
  who is not.
