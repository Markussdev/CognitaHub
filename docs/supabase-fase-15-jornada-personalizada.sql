-- ============================================================
-- Cognita Hub — Fase 15: Jornada personalizada (autoria de tutor)
-- VERSÃO CONSOLIDADA — executar o arquivo inteiro no SQL Editor.
--
-- Tudo roda em uma única transação: se qualquer comando falhar,
-- nenhuma alteração deste arquivo é mantida.
-- ============================================================

begin;

-- ============================================================
-- A. SCHEMA
-- ============================================================

alter table public.trail_templates
  add column if not exists visibility text not null default 'official';

alter table public.trail_templates
  add column if not exists target_child_id uuid
    references public.children (id) on delete cascade;

alter table public.mission_templates
  add column if not exists source_child_activity_id uuid
    references public.child_activities (id) on delete set null;

alter table public.trail_templates
  drop constraint if exists trail_templates_visibility_ck;

alter table public.trail_templates
  add constraint trail_templates_visibility_ck
  check (visibility in ('official', 'private'));

alter table public.trail_templates
  drop constraint if exists trail_templates_visibility_child_ck;

alter table public.trail_templates
  add constraint trail_templates_visibility_child_ck
  check (
    (visibility = 'official' and target_child_id is null)
    or
    (
      visibility = 'private'
      and target_child_id is not null
      and created_by is not null
    )
  );


-- ============================================================
-- B. HELPER CENTRAL DE LEITURA
-- ============================================================

create or replace function public.can_read_trail_template(
  p_template_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.trail_templates t
    where t.id = p_template_id
      and (
        -- Catálogo oficial publicado.
        (t.visibility = 'official' and t.status = 'published')

        -- Autor e admin enxergam qualquer estado.
        or t.created_by = auth.uid()
        or public.is_admin()

        -- Família e dispositivo só enxergam uma privada publicada
        -- depois de ela ter sido atribuída à criança-alvo.
        or (
          t.visibility = 'private'
          and t.status = 'published'
          and exists (
            select 1
            from public.child_trails ct
            where ct.trail_template_id = t.id
              and ct.child_id = t.target_child_id
          )
          and (
            public.is_guardian_of(t.target_child_id)
            or exists (
              select 1
              from public.paired_devices pd
              where pd.child_id = t.target_child_id
                and pd.auth_user_id = auth.uid()
                and pd.revoked_at is null
            )
          )
        )
      )
  );
$$;

revoke all privileges
  on function public.can_read_trail_template(uuid)
  from public;
revoke all privileges
  on function public.can_read_trail_template(uuid)
  from anon;
grant execute
  on function public.can_read_trail_template(uuid)
  to authenticated;


-- ============================================================
-- C. RLS DE LEITURA DO CATÁLOGO
-- ============================================================

alter table public.trail_templates enable row level security;
alter table public.trail_modules enable row level security;
alter table public.mission_templates enable row level security;

-- Policies antigas da trilha formal e nomes desta migração.
drop policy if exists tt_authenticated_select on public.trail_templates;
drop policy if exists tm_authenticated_select on public.trail_modules;
drop policy if exists mt_authenticated_select on public.mission_templates;
drop policy if exists tt_select on public.trail_templates;
drop policy if exists tm_select on public.trail_modules;
drop policy if exists mt_select on public.mission_templates;

create policy tt_select
  on public.trail_templates
  for select
  to authenticated
  using (public.can_read_trail_template(id));

create policy tm_select
  on public.trail_modules
  for select
  to authenticated
  using (public.can_read_trail_template(trail_template_id));

create policy mt_select
  on public.mission_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trail_modules tm
      where tm.id = mission_templates.trail_module_id
        and public.can_read_trail_template(tm.trail_template_id)
    )
  );


-- ============================================================
-- D. RPC: CRIAR RASCUNHO PRIVADO
-- ============================================================

create or replace function public.create_private_journey(
  p_title     text,
  p_objective text,
  p_child_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id        uuid;
  v_title     text := btrim(coalesce(p_title, ''));
  v_objective text := nullif(btrim(coalesce(p_objective, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  if not public.is_tutor_of(p_child_id) then
    raise exception 'Você não acompanha esta criança.';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Título inválido (1 a 120 caracteres).';
  end if;

  if char_length(coalesce(v_objective, '')) > 1000 then
    raise exception 'Objetivo muito longo (máximo de 1000 caracteres).';
  end if;

  insert into public.trail_templates (
    slug,
    title,
    description,
    track_type,
    status,
    visibility,
    target_child_id,
    created_by
  )
  values (
    'priv_' || replace(gen_random_uuid()::text, '-', ''),
    v_title,
    v_objective,
    'learning',
    'draft',
    'private',
    p_child_id,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all privileges
  on function public.create_private_journey(text, text, uuid)
  from public;
revoke all privileges
  on function public.create_private_journey(text, text, uuid)
  from anon;
grant execute
  on function public.create_private_journey(text, text, uuid)
  to authenticated;


-- ============================================================
-- E. RPC: SALVAR ESTRUTURA DO RASCUNHO
-- ============================================================

create or replace function public.save_journey_draft(
  p_template_id         uuid,
  p_modules             jsonb,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_child_id       uuid;
  v_new_updated    timestamptz;
  v_mod            jsonb;
  v_mis            jsonb;
  v_mod_pos        integer := 0;
  v_mis_pos        integer;
  v_new_module_id  uuid;
  v_source_id      uuid;
  v_ca             record;
  v_mod_count      integer;
  v_mis_count      integer;
  v_module_title   text;
  v_module_objective text;
  v_mission_title  text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_modules is null or jsonb_typeof(p_modules) <> 'array' then
    raise exception 'A estrutura de módulos precisa ser uma lista.';
  end if;

  v_mod_count := jsonb_array_length(p_modules);

  if v_mod_count < 1 then
    raise exception 'A jornada precisa de pelo menos 1 módulo.';
  end if;

  if v_mod_count > 10 then
    raise exception 'Máximo de 10 módulos por jornada.';
  end if;

  -- Lock otimista. A atualização é revertida junto com toda a função
  -- caso qualquer validação posterior falhe.
  update public.trail_templates
  set updated_at = now()
  where id = p_template_id
    and created_by = auth.uid()
    and visibility = 'private'
    and status = 'draft'
    and updated_at = p_expected_updated_at
  returning target_child_id, updated_at
    into v_child_id, v_new_updated;

  if not found then
    raise exception 'Não foi possível salvar: a jornada não é sua, já foi publicada ou foi alterada em outra aba. Recarregue antes de salvar.';
  end if;

  -- Replace-all explícito, sem depender apenas do cascade.
  delete from public.mission_templates mt
  using public.trail_modules tm
  where mt.trail_module_id = tm.id
    and tm.trail_template_id = p_template_id;

  delete from public.trail_modules
  where trail_template_id = p_template_id;

  for v_mod in
    select value
    from jsonb_array_elements(p_modules)
  loop
    if jsonb_typeof(v_mod) <> 'object' then
      raise exception 'Cada módulo precisa ser um objeto válido.';
    end if;

    v_mod_pos := v_mod_pos + 1;
    v_module_title := btrim(coalesce(v_mod->>'title', ''));
    v_module_objective := nullif(btrim(coalesce(v_mod->>'objective', '')), '');

    if char_length(v_module_title) < 1
       or char_length(v_module_title) > 120 then
      raise exception 'Título de módulo inválido (1 a 120 caracteres).';
    end if;

    if char_length(coalesce(v_module_objective, '')) > 1000 then
      raise exception 'Objetivo de módulo muito longo (máximo de 1000 caracteres).';
    end if;

    if v_mod->'missions' is null
       or jsonb_typeof(v_mod->'missions') <> 'array' then
      raise exception 'Cada módulo precisa possuir uma lista de missões.';
    end if;

    v_mis_count := jsonb_array_length(v_mod->'missions');

    if v_mis_count < 1 then
      raise exception 'Cada módulo precisa de pelo menos 1 missão.';
    end if;

    if v_mis_count > 20 then
      raise exception 'Máximo de 20 missões por módulo.';
    end if;

    insert into public.trail_modules (
      trail_template_id,
      position,
      title,
      objective
    )
    values (
      p_template_id,
      v_mod_pos,
      v_module_title,
      v_module_objective
    )
    returning id into v_new_module_id;

    v_mis_pos := 0;

    for v_mis in
      select value
      from jsonb_array_elements(v_mod->'missions')
    loop
      if jsonb_typeof(v_mis) <> 'object' then
        raise exception 'Cada missão precisa ser um objeto válido.';
      end if;

      v_mis_pos := v_mis_pos + 1;

      if coalesce(v_mis->>'source_child_activity_id', '')
         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Uma missão possui um identificador de atividade inválido.';
      end if;

      v_source_id := (v_mis->>'source_child_activity_id')::uuid;

      select
        ca.molde,
        ca.tema,
        ca.config,
        ca.instrucao,
        ca.titulo,
        ca.id
      into v_ca
      from public.child_activities ca
      where ca.id = v_source_id
        and ca.child_id = v_child_id
        and ca.created_by = auth.uid()
        and ca.child_trail_mission_id is null
        and ca.status <> 'archived';

      if not found then
        raise exception 'Atividade inválida numa missão: ela não pertence a você e à criança, não é avulsa ou está arquivada.';
      end if;

      if v_ca.molde not in ('contar', 'identificar') then
        raise exception 'O molde % ainda não pode ser usado numa jornada personalizada.', v_ca.molde;
      end if;

      v_mission_title := coalesce(
        nullif(btrim(coalesce(v_mis->>'title', '')), ''),
        nullif(btrim(coalesce(v_ca.titulo, '')), ''),
        'Missão'
      );

      if char_length(v_mission_title) > 120 then
        raise exception 'Título de missão muito longo (máximo de 120 caracteres).';
      end if;

      insert into public.mission_templates (
        trail_module_id,
        position,
        title,
        molde,
        emblema,
        default_tema,
        default_config,
        default_instrucao,
        source_child_activity_id
      )
      values (
        v_new_module_id,
        v_mis_pos,
        v_mission_title,
        v_ca.molde,
        v_ca.molde,
        v_ca.tema,
        v_ca.config,
        v_ca.instrucao,
        v_ca.id
      );
    end loop;
  end loop;

  return v_new_updated;
end;
$$;

revoke all privileges
  on function public.save_journey_draft(uuid, jsonb, timestamptz)
  from public;
revoke all privileges
  on function public.save_journey_draft(uuid, jsonb, timestamptz)
  from anon;
grant execute
  on function public.save_journey_draft(uuid, jsonb, timestamptz)
  to authenticated;


-- ============================================================
-- F. RPC: PUBLICAR E CONGELAR
-- ============================================================

create or replace function public.publish_journey(
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  if not exists (
    select 1
    from public.trail_templates t
    where t.id = p_template_id
      and t.created_by = auth.uid()
      and t.visibility = 'private'
      and t.status = 'draft'
  ) then
    raise exception 'Não foi possível publicar: a jornada não é sua ou já está publicada.';
  end if;

  if not exists (
    select 1
    from public.trail_modules tm
    join public.mission_templates mt
      on mt.trail_module_id = tm.id
    where tm.trail_template_id = p_template_id
  ) then
    raise exception 'A jornada precisa de pelo menos um módulo com uma missão.';
  end if;

  if exists (
    select 1
    from public.trail_modules tm
    where tm.trail_template_id = p_template_id
      and not exists (
        select 1
        from public.mission_templates mt
        where mt.trail_module_id = tm.id
      )
  ) then
    raise exception 'Todos os módulos precisam possuir pelo menos uma missão.';
  end if;

  update public.trail_templates
  set status = 'published', updated_at = now()
  where id = p_template_id
    and created_by = auth.uid()
    and visibility = 'private'
    and status = 'draft';

  if not found then
    raise exception 'A jornada foi alterada enquanto era publicada. Tente novamente.';
  end if;
end;
$$;

revoke all privileges
  on function public.publish_journey(uuid)
  from public;
revoke all privileges
  on function public.publish_journey(uuid)
  from anon;
grant execute
  on function public.publish_journey(uuid)
  to authenticated;


-- ============================================================
-- G. RPC: ATRIBUIR JORNADA OFICIAL OU PRIVADA
-- ============================================================

create or replace function public.assign_child_trail(
  p_child_id uuid,
  p_cycle_id uuid,
  p_trail_template_id uuid,
  p_starting_module_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_version  integer;
  v_template_status   text;
  v_visibility        text;
  v_created_by        uuid;
  v_target_child      uuid;
  v_starting_position integer;
  v_child_trail_id    uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  if not public.is_tutor_of(p_child_id) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  if not exists (
    select 1
    from public.support_cycles sc
    where sc.id = p_cycle_id
      and sc.child_id = p_child_id
      and sc.tutor_id = auth.uid()
  ) then
    raise exception 'Este ciclo não pertence ao seu acompanhamento com esta criança.';
  end if;

  if exists (
    select 1
    from public.child_trails ct
    where ct.child_id = p_child_id
      and ct.status = 'ativa'
  ) then
    raise exception 'Esta criança já tem uma jornada ativa.';
  end if;

  select
    t.version,
    t.status,
    t.visibility,
    t.created_by,
    t.target_child_id
  into
    v_template_version,
    v_template_status,
    v_visibility,
    v_created_by,
    v_target_child
  from public.trail_templates t
  where t.id = p_trail_template_id;

  if not found then
    raise exception 'Jornada não encontrada.';
  end if;

  if v_template_status <> 'published' then
    raise exception 'Esta jornada não está publicada.';
  end if;

  if v_visibility = 'private' then
    if v_created_by is distinct from auth.uid() then
      raise exception 'Esta jornada não é sua.';
    end if;

    if v_target_child is distinct from p_child_id then
      raise exception 'Esta jornada foi criada para outra criança.';
    end if;
  end if;

  select tm.position
  into v_starting_position
  from public.trail_modules tm
  where tm.id = p_starting_module_id
    and tm.trail_template_id = p_trail_template_id;

  if not found then
    raise exception 'Módulo inicial não pertence a esta jornada.';
  end if;

  insert into public.child_trails (
    child_id,
    cycle_id,
    trail_template_id,
    template_version,
    starting_module_id,
    assigned_by
  )
  values (
    p_child_id,
    p_cycle_id,
    p_trail_template_id,
    v_template_version,
    p_starting_module_id,
    auth.uid()
  )
  returning id into v_child_trail_id;

  insert into public.child_trail_modules (
    child_trail_id,
    trail_module_id,
    status
  )
  select
    v_child_trail_id,
    tm.id,
    'bloqueado'
  from public.trail_modules tm
  where tm.trail_template_id = p_trail_template_id
    and tm.position >= v_starting_position;

  insert into public.child_trail_missions (
    child_trail_module_id,
    mission_template_id,
    status
  )
  select
    ctm.id,
    mt.id,
    'bloqueada'
  from public.child_trail_modules ctm
  join public.mission_templates mt
    on mt.trail_module_id = ctm.trail_module_id
  where ctm.child_trail_id = v_child_trail_id;

  return v_child_trail_id;
end;
$$;

revoke all privileges
  on function public.assign_child_trail(uuid, uuid, uuid, uuid)
  from public;
revoke all privileges
  on function public.assign_child_trail(uuid, uuid, uuid, uuid)
  from anon;
grant execute
  on function public.assign_child_trail(uuid, uuid, uuid, uuid)
  to authenticated;


commit;


-- ============================================================
-- H. CONFERÊNCIA PÓS-MIGRAÇÃO (somente leitura)
-- ============================================================

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'trail_templates'
      and column_name in ('visibility', 'target_child_id'))
    or
    (table_name = 'mission_templates'
      and column_name = 'source_child_activity_id')
  )
order by table_name, ordinal_position;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in (
    'trail_templates',
    'trail_modules',
    'mission_templates'
  )
order by tablename, policyname;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_read_trail_template',
    'create_private_journey',
    'save_journey_draft',
    'publish_journey',
    'assign_child_trail'
  )
order by p.proname;
