# Cognita Hub

Brazilian social/educational project supporting early mathematics learning for
children with ASD, initially ages 5–9.

The product supports **human mediation**, not autonomous teaching:
KNOW → ADAPT → MEDIATE → OBSERVE → LEARN → repeat.
Technology organizes the cycle. It does not replace teachers, families,
educators or specialists.

## Product direction

The direction changed significantly after the Ruaké/UFPA discussions in
September 2026. Do not assume an old feature or decision is still correct just
because it exists in the code.

- person before diagnosis;
- human mediation is part of the product;
- activities are adaptable proposals, not prescriptions;
- observe skills, context and support, not only correct answers;
- accessibility is configurable, not universal;
- human feedback is meaningful product data;
- pedagogical hypotheses require validation before becoming requirements.

Never implement `ASD level X → activity Y`. Diagnosis, age and support level
are context; they do not define how a child learns.

`docs/PRODUCT.md` is the source of truth for **intended** direction. The code
is the source of truth for **implemented** behaviour. When they disagree,
report the divergence — do not rewrite the code to match the document unless
that reconciliation is the approved task.

If a task depends on an unresolved pedagogical decision, stop and name the
decision instead of choosing one. The ability to implement something is not
evidence that it should exist.

## Retired premises

These shaped existing code. That code is legacy, not intent — do not extend it
and do not re-derive these ideas from reading it:

- "the activity library is the embedded pedagogical expert that knows what is
  safe for each child" — an activity is now a proposal the mediator adapts;
- progress as correct answers over total;
- a single "accessible mode" toggle.

Found code built on one? Say so. Do not silently extend it, and do not
silently rewrite it either.

## Domain vocabulary

Code, comments and schema are in Portuguese.

- `ciclo` — support cycle between tutor and child; anchors sessions
- `trilha` / `jornada` — the child's learning path; `módulo`, `missão` are parts
- `molde` — activity template (`contar`, `identificar` exist; `comparar`,
  `associar` declared but not built)
- `casca` — the child-mode shell that renders an activity
- `atividade_execucao` — record of a child running an activity
- `responsável` — the child's guardian
- `pareamento` — pairing a device to a child
- `mediador` — the adult conducting the experience: tutor, teacher, guardian
  or other education professional

## Stack and layout

Vanilla JS with ES Modules, HTML/CSS, Vite, Supabase (PostgreSQL, Auth, RLS,
RPCs, Storage). The web is multi-page; the Android app uses Capacitor with
Vanilla JS, not React. Confirm the branch and package before using a command
or treating code as legacy. The Capacitor bootstrap is active on
`feat/mobile-app`; observations about inactive code on `main` do not apply
automatically to that branch.

For work under `apps/mobile/`, read `apps/mobile/CLAUDE.md` and
`docs/MOBILE.md`. Read `.claude/CURRENT.md` for the current task and its
status. A planned flow in documentation is not implemented behaviour.

- `pages/` — HTML entry points; each needs an entry in `vite.config.js`
- `js/pages/` — page orchestration, state, events
- `js/components/` — reusable UI
- `js/data/` — the boundary to Supabase
- `js/lib/` — auth, client, shared utilities
- `apps/mobile/` — independent Vite/Capacitor package; entry at `index.html`
- `apps/mobile/src/` — mobile screens, activities, services and assets
- `apps/mobile/src/services/` — the mobile boundary to Supabase

Do not bypass these boundaries or introduce a parallel architecture without
approval.

## Traps

**Child-facing code exists in more than one location** — `apps/mobile/src/` and
`js/pages/modo-crianca.js` + `app-crianca.js`. Do not assume both are active or
must stay synchronized. Before changing child-facing behaviour: identify the
actual entrypoint and consumers, determine whether the other location is
active, compatibility code or legacy, and report what you found. Do not
propagate a change into legacy code for consistency.

**Legacy/v1 RPCs remain exposed** (`get_family_sessions`,
`save_journey_draft`). Do not remove one just because the frontend has no known
consumer. Before removal: grep the repository, inspect grants, check
documentation, consider older or external consumers, ask if uncertain. Unused
does not mean safe to delete.

**`js/data/moldes-registro.js` is a single source of truth** consumed by more
than one screen. Verify current consumers before changing it.

**Two CSS patterns coexist** — files under `css/` and inline `<style>`. Check
which a page uses. Do not consolidate them as a side task.

**Mixing them breaks the cascade in production.** Vite injects the bundled
`<link>` CSS at the end of `<head>`, *after* any inline `<style>`, so a page that
has both gets the opposite cascade in `npm run build` than in `npm run dev`
(the tutor panel was unusable on phones in the published build for this
reason). `tutor.html` (`css/tutor/*.css`, link order = cascade order) and
`perfil-crianca.html` (`css/perfil-crianca.css`) now use files only;
`responsavel`, `atividades`, `admin`, `app-crianca`, `trilha` and
`builder-jornada` still mix both. Compare dev and build before trusting a
layout change on those pages.

**The tutor panel was historically a high-coupling area.** `js/pages/tutor.js`
is now a thin entry point; the logic lives in `js/pages/tutor/`, one module per
behaviour, composed by `tutor/index.js` (shared state only in `tutor/state.js`).
Put new behaviour in its own module, do not grow `index.js`, and never refactor
outside the requested scope. Propose extraction separately.

## Authorization

The frontend is never the source of authority. Authorization lives in the
database: RLS, `profiles.role` and `profiles.status`, ownership and
relationships, `paired_devices`, and validated RPCs.

Roles: `guardian`, `tutor`, `admin`, `child_device`.

The child app uses Supabase anonymous auth, so a child device holds the
Postgres role `authenticated` exactly like a tutor does — that role proves
nothing on its own.

Never expose `service_role` to frontend code, use editable user metadata as
authorization, weaken RLS to make a feature work, or treat production as a
development environment. Child data is sensitive.

## Database

Inspect the live schema before planning any database change. Never infer it
from frontend code or documentation alone.

The repository does not demonstrate a reproducible baseline for the full
schema; historical SQL assumes an existing database. No isolated database
has been verified for this task. Confirm the environment before planning a
structural change; do not assume that old SQL reconstructs production.

Therefore: propose schema changes as SQL for the user to review and apply.
**Do not run DDL against production.** Agent access to production is read-only
unless explicitly authorized for that task.

## Commands

Run these from the repository root:

- `npm run dev` / `npm run build` / `npm run preview` — web package
- `npm --prefix apps/mobile run dev` — mobile browser development
- `npm --prefix apps/mobile run build` — mobile web bundle
- `npm --prefix apps/mobile run preview` — serve that bundle

A root build does not validate the mobile package. A Vite build does not
validate an Android APK or native navigation. Check `apps/mobile/CLAUDE.md`
for native checks.

The root `package.json` defines `npm test`, but `tests/` may not exist.
The mobile package currently has no test script. **Check the relevant package
and files before running tests**, and run relevant tests when they exist.

For a risky refactor or the extraction of pure logic, targeted characterization
tests are encouraged when they materially reduce regression risk; do not build
broad test infrastructure unrelated to the task.

A task is not complete while the build fails because of the change.

## Documentation

- `docs/PRODUCT.md` — shared product principles, brought from main
- `docs/MOBILE.md` — observed mobile architecture, planned immediate entry,
  acceptance criteria and future hypotheses
- `docs/DATABASE.md` — database reference; verify against the live schema
- `.claude/CURRENT.md` — current work and honest completion status

Web documents such as `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` may exist
only on another branch. Check before reading or updating them; do not create
empty substitutes. Historical mobile documents do not override PRODUCT.

Documentation here has been out of date before. Treat a specific figure, count
or status in any document as a lead to verify, not a fact.

When documentation and code disagree, say so explicitly rather than quietly
choosing the convenient one. If a document or skill referenced here is empty or
missing, say so and ask — do not improvise its content from its name.

Follow skills under `.claude/skills/` only when they have content.
The `mcp__Supabase__*` tool names in the agents/settings must match the server
configured in the local Claude Code session; do not silently replace a denied
operation with another tool.

## How to work

Non-trivial change? Use the `implement-feature` skill. Finishing? Use
`finish-task`. Judging whether an existing feature still belongs? Use
`review-cognita`.

Prefer understanding existing behaviour before replacing it. Prefer a small
reversible change over a broad rewrite. Do not refactor unrelated code
opportunistically.

Stop and ask when the choice affects pedagogy, sensitive child data,
authorization, production, irreversible schema design or major architecture.

Do not create commits unless asked — otherwise leave a commit-ready diff and
suggest the message.

Optimize for a coherent, understandable, safely evolvable Cognita. Not for
feature count.

## Arquivos lidos

Me diga rapidamente após uma retomada de contexto quais arquivos e pastas
foram lidos no processo.