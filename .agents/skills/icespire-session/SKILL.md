---
name: icespire-session
description: Process, fact-check, implement, verify, or publish a newly played Icespire D&D campaign session from a transcript, approved recap, or repository-change brief. Use for new-session transcript review, recap work, campaign continuity updates, or propagating a session across the Icespire website.
---

# Icespire Session

Use the repository's current documents as the workflow and source of truth. This
skill sequences them; it does not replace them.

## Establish the current state

Before interpreting a transcript or editing campaign content:

1. Read `AGENTS.md`, then follow its required reading order. For this workflow,
   read the current versions of `docs/TABLE-FACTS.md`, `README.md`,
   `docs/SESSION-WORKFLOW.md`, `docs/WRITING-STYLE.md`, and
   `docs/CAMPAIGN-CANON.md` in full. Use `docs/TRANSCRIPT-BRIEF.md` to understand
   an approved package produced in an ordinary chat, not as a substitute for
   repository sources.
2. Read the previous session recap, `src/pages/campaign.md` (especially Open
   threads), recent session recaps, relevant entity records, and recent session
   commits. If maps, schemas, design, or roadmap work may be needed, read the
   corresponding guides named by `AGENTS.md` before touching them.
3. Inventory the supplied inputs: transcript files, session number, played date,
   attendance, observers, speaker mapping, Samuel's clarifications, approved
   recap, and approved repository-change brief. Do not assume missing inputs.

Keep raw audio and raw transcripts out of the repository unless the repository's
current instructions explicitly change that policy.

## Interpret evidence carefully

Treat WhisperX output as evidence, not truth. Correct recognizable transcription
errors against repository spellings and established canon, but flag a new or
uncertain name. Owen is the DM and voices every NPC and narration.

For each material beat, distinguish table events, in-character statements,
out-of-character talk, player knowledge, character knowledge, and speculation.
Preserve who witnessed, heard, learned, believed, promised, offered, paid, or
completed something. Never promote brainstorming, jokes, theories, inferred
motives, or reader knowledge into canon. Never fill a gap from the published
*Dragon of Icespire Peak* module.

Samuel's explicit clarifications override automated transcription. They do not
silently override an unresolved contradiction with established repository
canon: report any material conflict or ambiguity and stop before publishing the
affected claim.

## Choose the operating mode

### Mode A: transcript review before editorial approval

Use the transcript and repository to inspect facts, continuity, entity state,
knowledge boundaries, and possible inconsistencies. If clarification is needed,
follow `docs/SESSION-WORKFLOW.md`: ask one numbered batch with the best reading
attached to each question.

When ChatGPT is the primary editorial workflow, do not independently publish a
competing recap. Return useful factual checks, contradictions, ambiguities, and
questions for Samuel or ChatGPT. Draft prose only when the user explicitly asks
this Codex task to own that editorial step.

### Mode B: approved package implementation

Treat Samuel's clarifications, the approved recap, and the approved change brief
as editorial inputs, then cross-check them against the transcript, canon,
campaign state, relevant entity records, and current schemas. Do not copy them
blindly. Stop and report any remaining material contradiction instead of choosing
a convenient version.

Once consistent, follow `docs/SESSION-WORKFLOW.md` completely. Propagate the
session across every relevant area it names: recap, campaign canon, campaign
summary and Open threads, journey/map data, characters, NPCs, locations,
factions, lore, creatures, items and loot, statuses, map/submap visibility, and
roadmap/schema/design work when genuinely required. Deliberately mark an area as
unchanged when it was considered and nothing changed; do not omit it by accident.

Honor all publication gates and knowledge boundaries. Derived pages remain
derived. Never expose undiscovered module material through prose, metadata,
maps, search, or the Ask index.

## Verify and deliver

Follow `AGENTS.md` for branch, review, commit, push, and pull-request workflow;
never implement or commit on `main`. Run the required checks from the current
repository instructions, including `npm run check && npm run build`, and inspect
the affected pages listed in `docs/SESSION-WORKFLOW.md`. Review the staged diff
for accidental transcript/audio inclusion and spoiler leakage before committing.

Report the selected mode, inputs used and missing, clarifications or conflicts,
areas updated or deliberately unchanged, verification results, and branch/commit/
PR status.
