---
name: implement-feature
description: Follow this whenever implementing or changing a non-trivial feature in Cognita Hub — anything touching more than one file, any change to a shared contract, any new screen, or any change to how data is written. Not needed for a typo, a copy change or a one-line fix.
---

# Implementing a feature in Cognita Hub

The goal is the smallest coherent change that a human can review in one sitting.

## 1. Understand before proposing

Read `docs/PRODUCT.md` if the change affects what the product does, not just
how it does it. It states the intended direction; the code states what is
implemented. If they disagree, report it — do not reconcile them unless that
is the task.

Read the current implementation. Read the whole path, not only the file named
in the request: the page entry in `pages/`, its controller in `js/pages/`, and
the Supabase boundary in `js/data/`.

If the change touches the database, inspect the **live schema**. Never infer it
from frontend code or from `docs/DATABASE.md` alone — that document has been
out of date before. Treat any specific figure or status in documentation as a
lead to verify.

## 2. Identify contracts and consumers

Before changing anything shared, grep for who depends on it. Say out loud what
you found — "no other consumers" is a finding worth stating.

**Child-facing code currently exists in more than one location**
(`apps/mobile/src/` and `js/pages/modo-crianca.js` + `app-crianca.js`).

Do not assume both implementations are active or must remain synchronized.
Before changing child-facing behaviour:

1. identify the actual entrypoint and consumers;
2. determine whether the other implementation is active, compatibility code
   or legacy;
3. report the result.

Do not propagate changes into legacy code merely for consistency.

**Other recurring shared surfaces:** `js/data/moldes-registro.js` (consumed by
more than one screen — verify which), `css/tokens.css` (shared by every page
that links `css/`), and the RPCs in `js/data/`.

**Legacy/v1 RPCs** such as `get_family_sessions` and `save_journey_draft`
remain exposed. Do not remove one only because the current frontend has no
known consumer. Before removal: grep the repository, inspect database grants,
check documentation, consider older or external consumers, and ask the user if
compatibility is uncertain. Unused does not automatically mean safe to delete.

## 3. State assumptions

Write down what you are assuming that you could not verify. If an assumption
would change the design when wrong, ask instead of assuming.

If the task depends on an unresolved pedagogical decision, stop here. Name the
decision. Do not pick one.

## 4. Propose the smallest coherent plan

The plan says which files change and why, in order. It names what is
deliberately **not** being changed — especially adjacent code that looks like
it should be cleaned up.

Wait for approval before editing.

## 5. Implement only the approved scope

No opportunistic refactoring. No renaming for consistency. No tidying imports
in a file you happened to open.

If you discover mid-implementation that the plan was wrong, stop and say so
rather than expanding the change to compensate.

New page? Add its entry to `vite.config.js` — the build uses explicit rollup
inputs and will silently skip a page that has none.

Schema change? Propose the SQL for the user to review and apply. Do not run
DDL against production: the repository has no reproducible baseline and there
is no staging environment to test against.

## 6. Verify

Run `npm run build`.

The repository has no established test suite yet. `package.json` defines
`npm test`, but `tests/` may not exist — check whether test files exist before
running it. If relevant tests exist, run them.

For a risky refactor or the extraction of pure logic, targeted characterization
tests are encouraged when they materially reduce regression risk. Do not build
broad test infrastructure unrelated to the task.

The build is a weak gate on its own. Say plainly which flows you could not
verify and what the user should check by hand.

## 7. Review the diff

Read your own diff before presenting it. Anything in it that was not in the
plan is a defect — either remove it or say why it was unavoidable.

## 8. Update documentation

Behaviour or architecture changed → update `docs/ARCHITECTURE.md`.
Schema changed → update `docs/DATABASE.md`.
A decision was made along the way → propose a file in `docs/decisions/`.

Documentation updated later is documentation that drifts.

## What "done" means

Use the `finish-task` skill.
