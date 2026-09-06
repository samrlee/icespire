# CLAUDE.md

The handoff for this repo lives in **[`AGENTS.md`](AGENTS.md)** — read it first.
It is written for any AI coding tool, not just Claude Code, so there is one copy
of the conventions rather than two that drift apart.

The short version:

- **[`AGENTS.md`](AGENTS.md)** — how the repo works, what is generated, what
  must never be published, and the git conventions.
- **[`docs/TABLE-FACTS.md`](docs/TABLE-FACTS.md)** — who is at the table, who
  the DM is, the house rules, and the spellings the transcript mangles. The one
  thing the repo cannot tell you itself.
- **[`docs/SESSION-WORKFLOW.md`](docs/SESSION-WORKFLOW.md)** — the recording →
  whisperx → transcript → clarifying questions → published recap pipeline. This
  is the job most of the time.
- **[`docs/TRANSCRIPT-BRIEF.md`](docs/TRANSCRIPT-BRIEF.md)** — the same job as
  one self-contained prompt, for a chat with no access to this repo.
- **[`docs/WRITING-STYLE.md`](docs/WRITING-STYLE.md)** — the chronicle's voice.
  Read before writing campaign prose.
- **[`README.md`](README.md)** — the reference manual for every collection,
  field, and subsystem.
- **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — planned work.

Before committing: `npm run check && npm run build`.
