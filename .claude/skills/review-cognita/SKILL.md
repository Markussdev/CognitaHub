---
name: review-cognita
description: Check whether an existing feature, screen, table or module still belongs to Cognita's current product direction. Use before extending, redesigning or removing anything built before September 2026, when a feature seems to assume the child learns alone or that a profile field determines an activity, or whenever it is unclear if code reflects a retired premise.
---

# Product coherence review

Most of Cognita's code predates the September 2026 direction change. The code
is internally coherent with the **old** vision, so reading it and inferring
intent reproduces the old vision. This skill exists to stop that.

This is a **judgement** skill, not a refactor skill. Its output is a verdict
and an argument, never an edit.

## Before starting

Read `docs/PRODUCT.md` — specifically "Princípios decididos", "Premissas
aposentadas" and "Perguntas em aberto". If that file is empty or missing, stop
and say so; do not reconstruct the direction from the code.

Remember the split: `docs/PRODUCT.md` states the intended direction, the code
states what is implemented. This skill compares them. It does not reconcile
them.

Then read the feature under review. Read enough to describe what it actually
does, not what its name suggests.

## The six questions

Answer each one explicitly. "Unclear" is a valid answer and is more useful than
a guess.

1. **Which vision does it belong to?**
   Does it assume the platform decides what the child does next, or does it
   assume an adult mediates? Does it treat an activity as a closed recipe or as
   an adaptable proposal?

2. **What problem does it solve, for whom?**
   Name the user: child, mediator, guardian, or team. A feature that cannot
   name its user is a candidate for poda.

3. **What evidence supports its existence?**
   Distinguish: stated by a researcher or professional · observed in real use ·
   assumed by the team · implemented because it was easy. The last two are not
   evidence.

4. **Does it reinforce mediation and adaptation, or replace them?**
   Anything that decides *for* the mediator, or that presents a machine
   conclusion as pedagogical fact, fails here.

5. **Does it create an undue generalization?**
   Does any path infer an experience from diagnosis, age or support level?
   Does any copy say what "autistic children" do, rather than what this child
   did in this experience?

6. **Does it need pedagogical validation before it can be extended?**
   Check it against "Perguntas em aberto" in `docs/PRODUCT.md`. If it touches
   one, that is a blocker, not a caveat.

## The verdict

End with exactly one of these, plus a one-paragraph justification:

- **KEEP** — aligned with the current direction. Any extension still goes
  through the normal evidence → validation → requirement workflow; alignment
  is not pre-approval for whatever gets built on top.
- **KEEP WITH NOTE** — aligned, but carries a detail worth recording (a copy
  change, a naming problem, a field nobody reads).
- **REDESIGN** — the need is real, the current shape came from the old vision.
  Say what the need is and what the shape should become.
- **PODA** — no user, no evidence, or it is a facade. Say what an honest empty
  state would look like instead.
- **BLOCKED** — cannot be judged without a pedagogical decision that has not
  been made. Name the decision. This outranks the other verdicts.

## Rules

Never edit code from this skill. The output is text.

Never resolve an open question in order to reach a verdict. BLOCKED is the
correct answer when the question is open — choosing an answer silently is the
exact failure this skill prevents.

A feature that is well built is not thereby correct. Quality of implementation
is not evidence of product fit.

Honest empty states beat misleading UI. A PODA verdict is a good outcome, not
a failure.
