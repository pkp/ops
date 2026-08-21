---
name: ops-playwright-tests
description: OPS Playwright e2e suite — entry point. Loads the shared harness docs (lib/pkp/docs/e2e/dev/) and carries the OPS-specific deltas. Use when writing or debugging Playwright specs, POMs, fixtures, or scenario seeds in OPS.
---

# OPS Playwright Tests

Entry point for Playwright e2e work in OPS. The knowledge lives in the
**shared docs inside the lib/pkp submodule** — read them on demand, they are
the single home (OJS and OMP point at the same files):

- `lib/pkp/docs/e2e/dev/harness.md` — layout, fleets, config contract, env
  vars, running the suite, quick start. **Start here.**
- `lib/pkp/docs/e2e/dev/patterns.md` — locators, waits, parallel-load
  lessons, tag conventions, POMs, probe cookbook.
- `lib/pkp/docs/e2e/dev/scenarios.md` — seeding API (live + recorded
  designs), decision quirks, Mailpit.
- `lib/pkp/docs/e2e/dev/users.md` — role vocabularies, the 18-user roster,
  passwords, login internals.
- `lib/pkp/docs/e2e/PRINCIPLES.md` — the test-authoring contract.

Skip this skill for Cypress work (legacy, out of scope) and general OPS
development unrelated to testing.

## OPS-specific facts

- **Fleet**: port 8200, DB `ops_test`, project name `ops`. Context is a
  *preprint server*; cross-app vocabulary in
  `lib/pkp/docs/product/APP-GLOSSARY.md`.
- **Single stage**: Production only — there is NO review stage; the
  submission scenario REJECTS `reviewRounds`. Decisions: Post the preprint /
  Decline / Revert Decline.
- **Roster subset**: `sectioneditor.*` are Moderators (`ana`/`ravi` assigned
  to section `PRE`, `omar` deliberately unassigned as a visibility control);
  `assistant.rita` is Editorial Board Member (assistant slot, NO stage
  access); no editor/reviewer/copyeditor/layout/proofreader accounts —
  `seed.actors` maps those archetypes to null (gate shared code on
  capabilities, never app names — PRINCIPLES M2).
- **Scenario role keys**: only `manager`, `sectionEditor`, `author`,
  `reader`, `editorialBoardMember` (dev/users.md).
- Specs import `require('../support/fixtures.js')` for the app fixture,
  `require('../support/base-test.js')` in shared specs.

## Escalations

Same as everywhere: spec-contradicting results → the feature's Findings
register; security-shaped observations → RUNBOOK "What goes where" (never
public artifacts); commit discipline → RUNBOOK (single home).
