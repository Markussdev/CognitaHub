# Database — Cognita Hub

Last verification against the production Supabase project: September 3, 2026.
The October 1, 2026 update translated this document and added the section on what
the Android app uses (taken from the code); **the database itself was not
re-checked**, so treat every figure below as a lead to verify.

Cognita Hub's official database is PostgreSQL through Supabase. The production
schema is currently the source of truth.

> The repository still has no baseline or reliable sequence of migrations.
> Therefore, at this time, cloning the project is not enough to rebuild the
> database.

The `public` schema contains 26 tables, organized below by domain.

## Identity

- `profiles`
- `tutor_applications`

`auth.users` is managed by Supabase. `profiles.id` corresponds to the user
identifier in `auth.users`.

Roles available in `profiles.role`:

- `guardian`;
- `tutor`;
- `admin`;
- `child_device`.

States available in `profiles.status`:

- `pending`;
- `active`;
- `inactive`.

## Children and consents

- `children`
- `learning_profiles`
- `consents`
- `consent_acceptances`

## Follow-up

- `matches`
- `support_cycles`
- `sessions`
- `reports`
- `progress_logs`
- `admin_notes`

## Activities

- `activities`
- `child_activities`
- `atividade_execucao`
- `skills`

`activities` is the catalog; `child_activities` materializes an activity prepared
for a child; `atividade_execucao` records its execution.

## Trails and journeys

- `trail_templates`
- `trail_modules`
- `mission_templates`
- `child_trails`
- `child_trail_modules`
- `child_trail_missions`

The first three tables define templates. The tables prefixed with `child_`
represent the instance assigned to the child and its progress state.

## Child application

- `child_pairing_codes`
- `paired_devices`

A child device has a user in `auth.users` with `is_anonymous = true` and a profile
with `role = child_device` and `status = active`. To access a child's context, an
active link must exist in `paired_devices`.

## Legal documents

- `legal_documents`
- `legal_acceptances`

## Important functions

### Identity and authorization

- `handle_new_user` — creates the profile after a user is created;
- `my_role`, `is_admin` and `current_user_is_admin` — query the authorization
  context;
- `is_guardian_of`, `is_tutor_of` and `is_paired_device_of` — check
  relationships with a child;
- `block_admin_signup` — prevents the public granting of the admin role;
- `can_guardian_read_tutor_avatar` and `can_read_trail_template` — auxiliary
  access checks.

### Pairing

- `create_pairing_code`;
- `claim_pairing_code`;
- `revoke_paired_device`;
- `unpair_current_device`;
- `get_paired_child_context`;
- `get_paired_child_context_v2`;
- `cleanup_unclaimed_anonymous_users`.

The current child frontend uses `get_paired_child_context_v2`. The version without
a suffix remains in the database for compatibility.

### Trails and journeys

- `create_private_journey`;
- `save_journey_draft`;
- `save_journey_draft_v2`;
- `publish_journey`;
- `assign_child_trail`;
- `release_child_module`;
- `advance_child_trail_module`;
- `advance_child_trail_on_execucao`;
- `reopen_child_trail_mission`.

The current builder uses `save_journey_draft_v2`. Functions without the suffix may
represent contracts kept for compatibility and must be reviewed before removal.

### Sessions and family

- `create_session_with_execucoes`;
- `get_family_sessions`;
- `get_family_sessions_v2`;
- `get_guardian_tutor_profiles`.

The family panel uses `get_family_sessions_v2`.

### Personalization, validation and documents

- `set_child_personalization`;
- `validate_child_birth_date`;
- `validate_tutor_birth_date`;
- `can_insert_legal_acceptance`.

## Used by the Android app (read from the code, not from the live database)

The Android app (`apps/mobile/src/services/`) is the only consumer listed here. It
signs in anonymously and touches the following objects.

RPCs:

- `claim_pairing_code(p_code, p_device_name)` — links the device to a child;
- `get_paired_child_context_v2()` — returns the paired context (zero rows for both
  "never paired" and "revoked", so the app cannot tell them apart);
- `unpair_current_device()` — revokes only the device's own active link;
- `set_child_personalization(p_child_id, p_preferred_name, p_avatar_key)` — the
  only way the app changes the child's name/avatar.

Reads (`select`):

- `child_trails` with `trail_templates (title, description)`;
- `child_trail_modules` with `trail_modules (id, position, title, objective,
  visual_key)`;
- `child_trail_missions` with `mission_templates (id, position, title, molde,
  emblema)` and `child_activities (id)`, filtered to `child_activities.status =
  'ready'`;
- `child_activities` (`id, child_id, molde, tema, config, instrucao, titulo,
  child_trail_mission_id`) with the mission status.

Writes:

- `atividade_execucao` — **insert only** (`child_activity_id, child_id,
  executed_by, molde, tema, nivel_final, precisou_mais_facil,
  tempo_aproximado_segundos, como_encerrou`). The device has no permission to
  read the row back, so the app does not use `.select()` after the insert.
  `precisou_mais_facil` is currently always sent as `false` and `como_encerrou` as
  `crianca_concluiu`.

The avatar keys in `apps/mobile/src/config/child-avatars.js` (`astronauta`,
`cientista`, `mago`, `pintor`) must match the check constraint on
`children.avatar_key`; changing one side without the other breaks saving.

The Cognita for Schools demo (`apps/mobile/src/demo/`) uses none of these: it runs
on in-memory data and never calls Supabase.

## Storage

The project has two buckets:

- `profile-photos` — private;
- `email-assets` — public.

## Security

All 26 tables in the `public` schema have RLS enabled. This does not remove the
need to review the policies and the function permissions.

Rules that must remain valid:

- never use `raw_user_meta_data` directly to authorize access;
- never expose the `service_role` key in the frontend;
- combine the authenticated role with ownership or link relationships;
- treat `SECURITY DEFINER` functions as privileged surfaces;
- grant `EXECUTE` only to the roles that really need the function.

`handle_new_user()` is an internal function triggered from `auth.users`. In the
most recent check, `PUBLIC`, `anon` and `authenticated` had no permission to
execute it directly.

## State of the migrations

The migration history of the Supabase project is empty. The old `.sql` files in
`docs/` were historical scripts executed manually and were removed because they
did not represent the full state or a reproducible order of the schema.

The future fix is to create a real baseline and keep incremental changes in:

```text
supabase/
└── migrations/
    └── ...
```

That task must include generating the baseline, reviewing RLS and functions,
validating in a separate environment, and documenting the deployment flow.
