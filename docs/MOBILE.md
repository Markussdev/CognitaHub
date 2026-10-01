# Cognita mobile — current state and immediate entry

Updated October 1, 2026. Pedagogical principles: [PRODUCT.md](PRODUCT.md).

## 1. Observed state — not a promise that it works

Observed on branch `shipaton-2026` (HEAD `e958620`; the working tree has only
documentation edits on top of it), by reading the code and by running the
Cognita for Schools demo flow in a desktop browser. This is **not** an APK test and **not** a validation of the
production database.

| Part | Observed behavior |
| --- | --- |
| `apps/mobile/index.html` → `src/main.js` | Applies the visual preferences (reduced motion, large text) before the first paint, then picks one of two entries: the Shipaton school entry (`?school=1`, or build flag `VITE_SHIPATON_SCHOOL_DEMO=1`) or the connected child app (`src/app.js`). This routing is temporary; it is not the planned immediate entry. |
| `src/app.js` | Connected flow: anonymous sign-in, pairing lookup, trail → modules → missions. Screen state drives the Android back button; the app reloads on `appStateChange`. |
| `src/services/supabase.js` | Creates the Supabase client **at import time**; reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; session key `cognita-mobile-child-auth-v1`. |
| `src/services/auth.js` | Reuses the persisted anonymous session; signs out a non-anonymous (adult) session. |
| `src/screens/mission.js` | Receives the activity, the exit and the completion through callbacks. |
| `src/activities/activity-runner.js` | Runs only `contar` and `identificar`. |
| `src/services/executions.js` | Connected flow only: inserts into `atividade_execucao` (insert-only; the device cannot read the row back). |
| `src/services/settings.js`, `screens/experience-settings.js` | Local preferences: reduced motion and large text. Sound and haptics keys exist in the settings schema but are hidden, because neither is implemented. |
| `src/services/revenuecat.js`, `screens/school-license.js`, `screens/school-workspace.js` | Shipaton prototype: RevenueCat Test Store licence (native Android only), reached only through the school entry. |
| `src/demo/` | Cognita for Schools demo on fabricated in-memory data, no Supabase: school overview, student hub, tutor, child and family surfaces, and a shared store. `demo/school-back.js` handles the Android back button for this flow only. |
| `trail-preview.html`, `src/trail-preview.js` | Temporary development harness for the map screens. Not a build entry: the package has no Vite config, so only `index.html` is built. |
| Android project | `appId br.com.cognitahub.app`, app name "Cognita Hub", `INTERNET` is the only permission, `allowBackup="false"`. |

Without a pairing link, the app shows the pairing screen. With a link and no
`child_trail_id`, it shows "Your tutor hasn't built your journey yet. Check back
soon." The wait comes from the absence of a journey; anonymous sign-in
identifies the device, it does not create the journey.

The landmark preview (`?landmarkShowcase=1`, development only) is not a complete
functional experience. The web preview does not replace testing the APK. The
shared database and its policies need their own validation before real data is
tested.

## 2. Goal of the next implementation

Let an educator, guardian or evaluator open the app and try an activity
immediately, while preserving access to linked journeys.

The trial is an example for getting to know and conducting the experience with
human mediation. It is not an assessment, a diagnosis, a personalized trail or
proof of learning. Do not use diagnosis or age to choose the example.

The initial scope uses the two existing molds. It does not depend on future
audiovisual activities or on monetization. The proposal answers the access
barrier discussed with Marcus and the static inspection; its benefit in real use
and the pedagogical suitability of the examples have not yet been validated.

## 3. Desired behavior — not yet implemented

| Situation | Destination |
| --- | --- |
| First open | Screen with "Try an activity", "I have a code" and a secondary pointer to guidance for adults. |
| Try | Choice of Contar or Identificar, objective/suggested conduct for the adult, the activity, and a local closing. |
| I have a code | Initialization of the connected part and the existing pairing flow. |
| Return with a valid link and a journey | Resume the connected path after validating the session and context. |
| Valid link, no journey | Explain the state, offer to refresh and to try an activity without removing the link. |
| Network unavailable | Offer to retry the connection and to try locally; do not erase the session or the link because of a network error. |

At the end of a trial, offer to repeat or to choose another activity. Do not show
"Saving..." and do not point to a map that does not exist. The presentation to
the adult must use the language of a proposal, include possible adaptations and
what to observe, and keep the child's instruction simple. Review the concrete
content of this guidance; reusing a mold does not mean it has already been
pedagogically validated.

In this first cut, the state of the trial activity exists only during the
interface session; it does not represent a learning indicator. Existing visual
preferences may stay persisted. Do not ask for a name, diagnosis or any other
child data in order to try.

Do not transfer trial results to a child paired later: the app does not know who
did the example. A person who is already paired can try an activity without
losing the link or changing the journey.

## 4. Suggested technical cut

The names of the new files below are suggestions, not existing modules.

1. Adjust `src/main.js` / `src/app.js` to separate the local entry from the
   connected initialization. Inspect every transitive import that creates the
   Supabase client, including profile screens and services.
2. Add an entry/trial screen and local configuration for the examples. Required
   resources must ship in the bundle.
3. Reuse `renderMission` and `mountActivity`. Pass a local completion that does
   not depend on real IDs and does not write to the database.
4. Adjust mission texts/return through an explicit contract. The connected path
   remains responsible for `createActivityExecution` and for updating the
   journey.
5. Update the states used by the back button, pause/resume and asynchronous
   loading. Do not let a late boot replace the trial.
6. Use the same local entry in the no-journey and connection-unavailable states.

Postponing only the authentication call does not solve the early initialization
of `createClient`. The local entry must keep opening without Supabase
configuration. Use the smallest isolation necessary, without rewriting the whole
orchestrator or creating a second activity engine.

This cut does not require schema, RLS or RPC changes. If the implementation
finds a dependency that requires them, report it before widening the scope. Do
not create fictitious accounts in the backend to unblock the interface.

## 5. Acceptance criteria for the implementation

All are pending until the implementation and the tests are done.

- Without Supabase variables: open the entry, complete each example and return
  to the selection without initializing the client or calling the backend.
- Installed APK, network off: repeat the path above with local resources. This
  does not promise offline access to the website.
- Trying: no authentication, RPC or execution write; no trial history associated
  with a child or synchronized later.
- No journey: entering/leaving the trial preserves the existing link.
- Online: pair, load the assigned activity, complete it and confirm the write.
  A save failure must allow recovery without pretending the work was completed.
- Invalid/expired code and connection error: appropriate messages and an
  available exit; the person is not stuck on a waiting screen.
- Android: back returns to the right destination; pause/resume neither restarts
  the local activity nor replaces it with pairing/journey.
- Large text and reduced motion continue to be respected.
- Do not rewrite or duplicate a connected completion when returning from the
  trial.

Record build, static tracing, browser, APK and database separately. A green build
does not prove that a policy authorizes the right operation.

## 6. Next cuts under discussion

These directions came from product conversations; they are not finished features
and not authorization to widen the immediate-entry task.

### Institutional monetization

Explore a licence for hosted use by a school/class, bought by an adult, with
organization of follow-up and distribution of activities. Price, limits,
institutional roles and permissions still need to be defined. This does not
authorize charging families or restricting accessibility support.

The mobile package already has a RevenueCat (Test Store) prototype, in
`services/revenuecat.js` and `screens/school-license.js`, reached only through
the temporary Shipaton entry (`?school=1` or `VITE_SHIPATON_SCHOOL_DEMO`) and
outside the child's flow. Offer and price are demonstrative, with no validation
against real revenue. A real purchase must be tied to the institutional
guardian, not to the anonymous identifier of the child's device. Access rights
and links are verified on the server. Separate test purchases from real revenue
and check the current documentation and the event's rules before claiming
eligibility.

**School overview (demonstration) — implemented, local only.** After the
licence, the workspace offers "School overview" (`src/demo/demo-school.js`,
`demo-learner.js`, `school-roster.js`): a fictional school ("Cognita
Demonstration School", 24 students, 5 tutors) with a sample of 6 students, to
show the hierarchy school → student → tutor/child/family. Only Mateus is a real
profile of the demo: his card is derived from `school-demo-store.js` ("N of M
missions", "Up to date" / "Session to review"), so the school agrees with the
tutor, the child and the family; the other five are fixed data in `DEMO_SCHOOL`
(`school-demo-data.js`) and do not open. Out of scope, on purpose: student or
tutor CRUD, invitations, classes, institutional login, reports, tables or RLS.
Nothing is read from or written to Supabase.

Language choices to keep: operational state only ("there is a session to review
or not"); mission counts, never percentages; no "on track" or any judgment of
pace; no diagnosis, grade, observation or feedback in the school view; no
ranking. The "Demonstration data" notice sits at the top of the school view,
next to "Only Mateus is interactive in this demo"; the "Need review" metric
counts students with something to review, not activities. This is a
presentation hypothesis, not a validated requirement: who, inside an
institution, may see what remains open in [PRODUCT.md](PRODUCT.md).

The Android back button in the school flow is handled by
`src/demo/school-back.js` (each screen says where back goes; the licence screen
asks for confirmation before exiting). The connected flow keeps using `app.js`;
the school handling switches itself off when that flow is entered.

### Variation of experiences

Explore repeatable narration in Identificar, numeral/quantity matching with
pieces, and comparison of sets. Audio must be possible to turn off; dragging must
have a tap alternative. Do not show as available any support that has not been
built.

The adult's objective, conduct, context and feedback remain central. Recording
the use of a support is not the same as validating a learning scale. The open
pedagogical questions in PRODUCT remain open.

### Full evaluation of the project

The local entry demonstrates the activities, but does not prove tutor → child →
record against the real backend. The Cognita for Schools demo shows that loop on
fabricated in-memory data (tutor prepares, child completes, the school sees a
pending review, the tutor registers the session, the family reads the reviewed
feedback), without proving it end to end. A real path will need a separate demo
environment, fictitious data and reproducible instructions. The repository does
not demonstrate a complete database baseline; do not present historical SQL as a
guaranteed installation.

## 7. Verification status of the Cognita for Schools demo

Evidence for the school overview work (October 1, 2026). This is separate from
the acceptance criteria in section 5, which are all still pending.

Verified:

- `npm --prefix apps/mobile run build` passes, both with the local `.env` flags
  and with `VITE_SHIPATON_SCHOOL_DEMO` / `VITE_SHIPATON_CHILD_DEMO` empty. Only
  the second proves the isolation: with the flags on, Vite removes the connected
  branch and the `app.js`/Supabase chunk is not even generated. With the flags
  off, that chunk is referenced only by dynamic `import()` (`main.js` and the
  click in `school-license.js`).
- Browser (headless Chromium, 390×844, with the RevenueCat module replaced by a
  stub): licence → workspace → school overview → Mateus → Tutor / Child / Family
  and back; the child completed a Contar mission and the school reflected the
  pending review; large text without horizontal scroll; no request to Supabase;
  no console errors. The tutor's session registration was done directly on the
  store, not through the interface wizard.

Not verified:

- APK/device: the physical back button was exercised by calling
  `handleSchoolBack()` in the browser; the native listener
  (`App.addListener`) was not. Confirm on a device: back on every screen of the
  school flow and the exit confirmation on the licence screen.
- The real RevenueCat Test Store leading to the workspace; in the browser the
  module was replaced by a stub.
- The workspace "Child" card without `VITE_SHIPATON_CHILD_DEMO`, which enters the
  connected flow and creates an anonymous session; deliberately avoided in the
  tests.
- Reading tests of the school overview with evaluators.

Known behavior, unchanged: pressing back on the workspace goes to the licence
screen and resets the demo state (same effect as the arrow).
