---
name: finish-task
description: Run this before declaring any Cognita Hub task complete, and before preparing any commit. It is the Definition of Done — build, tests if they exist, scope, docs, diff, and an honest statement of what was not verified.
---

# Definition of Done — Cognita Hub

A task is done when every line below is either true or explicitly reported as
not true. Reporting honestly is passing. Claiming a green check you did not
earn is the only way to fail this skill.

## 1. Build and tests

Always:

```
npm run build
```

If relevant tests exist:

```
npm test
```

`package.json` defines `npm test`, but the `tests/` folder may not exist.
**Check first.** If no relevant tests exist, say so explicitly rather than
silently skipping the step.

If the build fails because of this change, the task is not done.

## 2. The diff matches the scope

Read the full diff. Every hunk must trace back to the request.

Anything else — a renamed variable, a reformatted block, a tidied import, a
"while I was in there" fix — comes out, or gets named explicitly with a reason.

Look hardest at `js/pages/tutor.js`: it is historically a high-coupling area
and scope leaks there first.

## 3. Nothing forbidden happened

- no DDL ran against production
- no RLS policy was weakened to make something work
- no `service_role` key reached frontend code
- no legacy/v1 RPC was deleted without the removal checks
- no change was propagated into a second child-facing implementation merely
  for consistency
- `css/` and inline `<style>` were not consolidated as a side task
- no new framework or parallel architecture appeared

## 4. Documentation is in step

- behaviour or architecture changed → `docs/ARCHITECTURE.md`
- schema changed → `docs/DATABASE.md`
- priorities or debt changed → `docs/ROADMAP.md`
- a product rule was decided → `docs/PRODUCT.md`
- a decision has context worth keeping → a file in `docs/decisions/`

If you found a divergence between documentation and the code, report it. Do
not fix the code to match the document unless that was the task.

## 5. What was NOT verified is stated

A passing build proves the bundle compiles. It proves nothing about whether
the feature works.

List, in plain words, what a human still needs to check: which screen, which
role, which flow. If the change touches pairing, the child experience, or
anything behind RLS, assume it is unverified until someone opens it.

"Testar manualmente" is useless. "Abrir o painel do tutor como tutor pareado e
registrar uma sessão com execução pendente" is useful.

## 6. The commit

**Do not create commits unless the user asked for them.**

If the user asked for commits: one commit per coherent phase, message in
Portuguese, matching the repository's existing style.

Otherwise: leave the working tree ready, and suggest the commit message for
the user to use.

Never `git push` — that is denied in `.claude/settings.json` by design.

## The report

Close with a short summary in this shape:

- **Feito:** what changed, in one or two sentences
- **Verificado:** build, and tests if they existed
- **Não verificado:** what a human needs to open and check
- **Ficou de fora:** anything noticed but deliberately not touched, so it is
  not lost
- **Divergência encontrada:** any place where docs and code disagree
- **Decisão pendente:** any question that came up and was not answered
