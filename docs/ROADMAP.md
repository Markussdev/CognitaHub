# Roadmap — Cognita Hub

Last revised: October 1, 2026.

## Current state

### Implemented

- guardian and tutor authentication;
- email confirmation and role-based access control;
- child registration and learning profile;
- tutor application and approval;
- admin panel;
- tutor–child matching;
- support cycles;
- session and execution records;
- activity catalog and preparation;
- personalized trails and journeys;
- progress by modules and missions;
- child experience (web shell and Android app);
- anonymous child authentication;
- device pairing and revocation;
- child name and avatar personalization;
- legal documents and acceptances;
- configurable experience settings on Android (reduced motion, large text);
- RevenueCat Test Store prototype for an institutional licence (Android only; demo
  pricing, no real revenue);
- Cognita for Schools demo on fabricated local data: school overview, tutor,
  child and family surfaces (no backend).

### Planned, not implemented

- Immediate entry in the Android app — trying an activity without a session or
  pairing (see [MOBILE.md](./MOBILE.md)).

## Current priorities

1. Stabilize and consolidate the child flow.
2. Improve the visual experience and the clarity of the journey.
3. Validate real use with children, guardians and tutors.
4. Improve metrics and progress visualization.
5. Reduce technical debt before widening the scope.

## Technical debt

- create a reproducible baseline in `supabase/migrations/`;
- review and remove old RPCs when there are no consumers left;
- audit RLS policies and `EXECUTE` permissions of `SECURITY DEFINER` functions;
- consolidate the parallel implementations of the child experience (the web child
  shell and the Android app both exist and are both active; the molds are
  implemented twice);
- remove remaining legacy comments and code (for example the temporary
  `trail-preview` harness in the Android package);
- add tests for the critical authentication, pairing and progress flows (neither
  the root package nor `apps/mobile` defines a test script today);
- keep the README and the reference documents in sync with the product;
- Android app: the privacy policy URL is still empty
  (`screens/guardian-settings.js`), and Google Play requires the policy to be
  reachable from the app;
- Android app: confirm whether Supabase Auth CAPTCHA protection applies to
  anonymous sign-ins — the web child flow sends a Turnstile token, the Android app
  does not;
- the `docs/decisions/MOBILE.md` file is an outdated copy of an earlier
  `docs/MOBILE.md` and does not follow the `NNNN-` decision format; decide whether
  to remove it.

## Out of the current scope

- clinical diagnosis;
- marketplace;
- public ranking;
- competitive gamification.

This file records only the current state and priorities. The history of decisions
stays in Git.
