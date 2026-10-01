# Cognita Hub — product direction

This document records what has already been **decided** about the product
direction.

It is not a place for open thinking — that lives in the "Central" vault.
It is not a place for decisions with context and alternatives — those live in
`docs/decisions/`.

## How to read this document alongside the code

`docs/PRODUCT.md` is the source of truth for the **intent** of the product.
The code is the source of truth for the **behavior implemented today**.

When the two disagree, **report the divergence**. Do not rewrite the
implementation to match this document, unless that reconciliation is the
approved task.

A divergence is information. Silencing one by choosing the more convenient side
is the only serious mistake here.

Last revised: September 19, 2026. English translation: October 1, 2026 —
wording only; no decision was changed.

---

## What Cognita is

A digital infrastructure that supports the **human mediation** of early math
learning for children with ASD (autism spectrum disorder, *TEA* in Portuguese),
initially ages 5 to 9.

Cognita helps adults get to know the child, choose or adapt experiences,
mediate, observe, record, and use that history to improve the next experience.

The core cycle:

```
KNOW → ADAPT → MEDIATE → OBSERVE → LEARN ↺
```

Technology organizes this cycle. It does not lead the pedagogical process and
does not replace those who know, accompany or teach the child.

### The central question of the product

> How do we create a platform that helps adults adapt math teaching to each
> child, without pretending that software can replace the pedagogical eye of
> those who know that child?

---

## Who takes part

**Child** — the center of the process. The experience adapts to the child, not
the other way around. The child can use digital resources directly, but **the
child experience is not self-teaching**: human mediation remains present.

**Guardian** (*responsável*) — has the everyday knowledge that no platform can
replace. Contributes context and observations.

**Mediator** — conducts the experience. May be a tutor, a teacher, a guardian
or another education professional. The architecture **must not assume** that
only a generalist volunteer tutor mediates. Cognita does not presume that this
adult is a clinical specialist.

**Cognita team (C-FORCE)** — maintains the platform and prevents a technical
decision from being made without considering its pedagogical implications.

**Specialists and institutions** — validate the proposal. They exist so that
Cognita is not built only from the assumptions of its own team.

---

## Decided principles

**Person before diagnosis.** ASD, age and support level provide context. They
never determine the activity, difficulty, format, accessibility, strategy or
progression. No logic of the type `ASD level 2 → activity X`.

**The pedagogical decision stays human.** The system does not know the child
better than those who live and work with them.

**An activity is a proposal, not a recipe.** It carries a skill/objective,
materials, a suggested way to conduct it, possible adaptations and what to
observe — and the mediator adapts it.

**A template answers "how can this skill be worked on?"** — never "how should a
child with profile X learn?".

**Two distinct interfaces.** Instructions for the adult and instructions for
the child are not the same thing.

**Progress is not correct answers over total.** Progress tracks skill + context
+ level of support + observation + evolution over time. Avoid false pedagogical
precision.

**Accessibility is configurable and individual.** A feature that helps one
child can hinder another. More features ≠ more accessibility.

**Human feedback is structural data**, not a decorative comment field.

**A three-level session record is a safety requirement**: structured data,
guided feedback for the family, and an internal tutor note that the family never
sees. Without this separation, the tutor's raw note would reach the family.

**Language never generalizes.** Prefer "this child responded better to X in this
experience" over "autistic children learn better with X". Prefer "you can try…"
over "this child must…".

**Brand identity ≠ experience personalization.** The maracajá (margay wildcat)
mascot represents the project, never characteristics of children with ASD.
Whether it works for a specific child is a design hypothesis.

---

## What Cognita is NOT

- does not replace school, teachers or educational institutions;
- does not replace specialized professionals;
- does not perform clinical assessment or issue diagnoses;
- is not an autonomous pedagogical authority;
- does not treat children with ASD as a homogeneous group;
- does not reduce learning to correct answers;
- does not offer a universal accessibility solution;
- does not automatically turn human observation into a pedagogical decision.

Out of technical scope: marketplace, public ranking, competitive gamification.

---

## Retired premises

These shaped code that still exists. **Code consistent with them is legacy, not
intent.** Do not extend it and do not rewrite it on your own — flag it.

**"The activity library is the embedded expert that knows what is safe for each
child."**
It died because growing the number of templates does not solve personalization —
it is still an attempt to anticipate every way a child may learn, and software
alone cannot do that. The library remains important, with a different role: a
starting point for the mediator.

**Progress as a percentage of correct answers.**
It died because `8/10` does not say whether the child did it alone, after a
demonstration, with verbal support, with a physical object, or only in that
context.

**A single "accessible mode".**
It died because narration, sound, animation and visual density help one child
and hinder another.

**The autonomous-flow vision** (`child → ready-made activity → answer →
right/wrong → progress → next`).
Replaced by the mediation cycle described at the top.

---

## Open questions — they do not become code

These do not yet have a validated answer. If a task depends on one of them,
**stop and name the decision** instead of silently choosing.

- What is the best way to represent a skill? Who may mark a skill as acquired?
- How do we record the level of support without creating false precision? The
  hypothetical scale (not observed / with support / partial / independent / in
  another context) has **not** yet been validated by professionals.
- How do we distinguish observation from formal assessment?
- Which profile fields really help the mediator? How do we represent verbal and
  non-verbal communication, reading and comprehension, without oversimplifying?
- How much feedback should we ask for without making the session bureaucratic?
  Does the mediator's feedback stay in the history, generate a suggestion,
  change the profile, influence a recommendation, or require review?
  **Automation is the highest-risk option and is not decided.**
- How do we configure accessibility without creating an unusable interface?
- Should Cognita have an activity editor? Can activities be shared among
  educators? How do we curate them?
- How do we work with regulation/self-regulation responsibly?
- What information can each role see? Which data should **never** be used for
  automatic inference?
- **How does contact between the mediator and the family work?** The previous
  rule was "tutor–family contact is always mediated by the team". It comes from
  the pre-Ruaké vision and came into tension with the current definition of
  mediator — if the guardian can be the mediator, the rule no longer describes
  the same world. It needs an explicit decision before it applies again as a
  principle.

---

## Development rule

```
REPORT / EVIDENCE → LEARNING → HYPOTHESIS → VALIDATION
→ REQUIREMENT → DESIGN → IMPLEMENTATION
```

Nothing heard from a researcher, teacher, user or reference becomes code
directly. **The technical ability to implement a feature is not evidence that it
should exist.**

References under study (AFIRM, "Um olhar sobre mim", JClic, Numberblocks,
geoboard, CrossMath) are references. They are not requirements or an
implementation checklist.

---

## How this document changes

A line enters here when the decision is made. While it is under discussion, it
lives in the vault. While it is in tension with another decision, it lives in
the open questions section.

A decision with context, alternatives considered and consequences gets a file in
`docs/decisions/` — and only the resulting rule stays here.

When a premise is retired, it **is not erased**: it goes to the retired premises
section with the reason. The reason is what prevents someone from reintroducing
it six months later.
