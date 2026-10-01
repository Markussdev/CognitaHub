# Decisions

One decision per file. The record exists so that nobody — including you six
months from now, including an agent reading the code — has to rediscover why
something is the way it is.

## When to write one

Write one when the decision:

- closes an alternative that someone could reasonably choose;
- will be questioned in the future ("why didn't they use X?");
- retires an earlier premise;
- is expensive to reverse.

Do not write one for an obvious choice, an implementation detail or a style
preference.

Rule of thumb: if the answer to "why not the other way?" is long, it becomes a
file.

## File name

```
NNNN-short-phrase-in-lowercase.md
```

Sequential numbering, never reused. `0003-no-embedded-webrtc.md`.

## Format

```markdown
# NNNN — Title

**Date:** YYYY-MM-DD
**Status:** accepted | superseded by NNNN | reverted

## Context
What was happening. What constraint existed. What we knew — and what we did not
know — at that moment.

## Alternatives considered
Each one with the real reason it was not chosen. An alternative listed without a
reason does not count.

## Decision
What was decided, in one or two sentences.

## Consequences
What this makes easier. What it makes harder. What becomes forbidden. What will
have to be revisited, and under which condition.
```

## Rules

**An accepted file is not edited.** If the decision changes, write another one and
mark the old one `superseded by NNNN`. Rewriting the past erases the reason, which
is the only thing that matters here.

**An agent does not change an existing decision.** It may propose a new one;
changing the old ones is Marcus's job.

**The resulting rule goes to `docs/PRODUCT.md`.** The reasoning stays here; what
counts as a rule lives there. No duplication — the rule there, the why here.

## First ones to write

Two already exist as a decision made but not yet recorded:

- **why adaptation is not automated** — why Cognita does not infer an experience
  from a profile, and what that closes
- **why the library stopped being "the embedded expert"** — the premise retired
  after Ruaké, and what took its place

A third, older and just as easy to question:

- **why there is no embedded video call** — WebRTC was rejected because of scope
  risk, child safety and data protection; the path is a session link field
  pointing to an external service

And a fourth, which **is not yet a decision** — it is open and needs to be
resolved before becoming an ADR:

- **how contact between the mediator and the family works** — the old rule
  ("tutor–family contact is always mediated by the team") came into tension with
  the post-Ruaké definition of mediator, which includes the guardian. It is
  listed under "Open questions" in `docs/PRODUCT.md` until it is decided.
