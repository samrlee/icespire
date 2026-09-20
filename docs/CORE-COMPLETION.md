# Core roadmap completion

This branch collects the remaining core work from issue #75 in one PR for final
review. Signed checkpoints do not require intermediate merges.

- [x] Stable recap scene records and jump navigation, preserving prose and breaks.
- [x] Reuse scene records for profile mentions, timeline navigation and search/Ask sources.
- [x] Optional per-tab Q&A retention with explicit restore/forget, cancellation and corpus invalidation.
- [x] Ask timeouts, safe source links and clear reported/intended/known-by evidence rules.
- [x] Required checks, browser accessibility regressions and live read-only deployment smoke checks.
- [x] Reconcile roadmap into completed core work and explicit follow-ups; mirror in issue #75 when opening the PR.

Scene labels initially use neutral part numbers at existing narrative breaks;
the committed IDs remain stable if labels or prose change. Descriptive editorial
labels, quick summaries, character-specific knowledge briefings and map redraws
awaiting exploration are not prerequisites for this core completion.

Physical iPhone/assistive-technology testing and account-level Cloudflare budget
controls require their respective device/account access; do not claim them tested
or configured from browser emulation or source inspection.

## Verification record

- Type/template check and production build pass: 54 pages, with internal links,
  fragments and assets validated. Production dependency audit: zero vulnerabilities.
- Integrity 20, review-report 5, map 7, Ask 14 and publication 17 tests pass.
- Full browser suite: 191 passed. After final control styling, all 20 targeted
  completion tests passed again. WebKit phone screenshots in both themes were
  inspected; no horizontal overflow. Required remote CI remains a PR gate.
- All ten recaps compared against the merged base: prose and frontmatter unchanged
  after removing scene markers and normalizing whitespace. Existing breaks remain.
- Publication fixtures cover published/nested/draft part records and links.
- Mocked Ask evidence fixture preserves attribution, an unpaid agreement and
  explicitly limited knowledge in the supplied context; this is not a live-model
  correctness evaluation.
- Live production smoke check (2026-09-20): homepage 200 with CSP, nosniff and
  strict-origin-when-cross-origin; Ask GET 405/no-store; empty-question POST 400.
  No model calls were made. The completion branch is not deployed by this check.
- Core implementation retains the existing one-job required CI gate and adds
  regressions to it, without expanding workflow permissions.
