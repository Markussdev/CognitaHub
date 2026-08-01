-- ============================================================
-- Cognita Hub — Fase 13: pareamento de dispositivo infantil
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: o app infantil deixa de reusar a sessão do tutor ("modo
-- demonstração", Sprint 6A) e passa a ter identidade própria — um
-- dispositivo pareado a UMA criança, via código curto gerado pelo adulto,
-- usando auth anônimo do Supabase (auth.uid() real, RLS de verdade, sessão
-- persistente por refresh token — sem inventar token/expiração na mão).
--
-- PRÉ-REQUISITOS MANUAIS (fora do SQL Editor, no Dashboard):
--   1. Authentication → Providers → habilitar "Anonymous sign-ins".
--   2. Authentication → Attack Protection → habilitar CAPTCHA (Turnstile)
--      pro provider anônimo. Sem isso, qualquer um pode chamar
--      signInAnonymously() em loop e encher auth.users — o Supabase avisa
--      isso explicitamente na documentação de sign-in anônimo.
-- Sem o passo 1, claim_pairing_code nunca vai ver is_anonymous=true no JWT
-- de ninguém (não existe usuário anônimo possível ainda).
--
-- Pré-requisito de SQL: docs/supabase-fase-5-trilha-formal.sql,
-- docs/supabase-fase-8-progresso-trilha.sql e docs/supabase-rls-fix.sql
-- já aplicados.
-- ============================================================

-- PASSO A — pgcrypto (usado por digest() pro hash do código) -----------

select extname, extnamespace::regnamespace as schema
from pg_extension where extname = 'pgcrypto';
-- Se vier vazio, rode: create extension if not exists pgcrypto;
-- Se o "schema" devolvido NÃO for "extensions", troque "extensions" por
-- esse schema nos dois `set search_path` que citam extensions abaixo
-- (Passo D, funções create_pairing_code e claim_pairing_code).

create extension if not exists pgcrypto;

-- PASSO B — descobre a constraint de profiles.role e nullability de email

select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'c';
-- Copie o conname da constraint que lista os roles (algo como
-- "profiles_role_check") e rode, trocando <nome>:
--
-- alter table public.profiles drop constraint <nome>;
-- alter table public.profiles
--   add constraint <nome> check (role in ('guardian', 'tutor', 'admin', 'child_device'));
--
-- (se a constraint antiga tiver outros valores além desses 3, inclua-os
-- também na nova lista — não removi nenhum, só adicionei 'child_device')

select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'email';
-- Se is_nullable = 'NO', rode:
-- alter table public.profiles alter column email drop not null;

-- PASSO C — ajusta handle_new_user pra distinguir dispositivo anônimo ---
-- Sem isso, atividade_execucao.executed_by (references profiles) quebraria
-- pro dispositivo — ele precisa de UMA linha em profiles pra existir,
-- só que com role próprio, não 'guardian' (o coalesce original tratava
-- QUALQUER novo auth.users sem role explícito como guardian — inclusive
-- anônimo, o que criaria um "responsável fantasma" a cada pareamento).

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) then
    insert into public.profiles (id, name, email, phone, role, status)
    values (new.id, 'Dispositivo infantil', null, null, 'child_device', 'active')
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, name, email, phone, role, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      new.email,
      new.raw_user_meta_data ->> 'phone',
      coalesce(new.raw_user_meta_data ->> 'role', 'guardian'),
      case
        when coalesce(new.raw_user_meta_data ->> 'role', 'guardian') = 'guardian'
          then 'active'
        else 'pending'
      end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- (o trigger em si já existe, criado em supabase-rls-fix.sql — só a
-- função mudou, create or replace já cobre)

-- PASSO D — Tabelas: child_pairing_codes, paired_devices ----------------
-- child_pairing_codes: só o hash SHA-256 do código, nunca o texto puro —
-- mesmo alguém com acesso de leitura ao banco não recupera o código.
-- attempts_count conta tentativas que JÁ acertaram o hash (reuso do mesmo
-- código) — não é proteção contra adivinhar o código às cegas; essa vem
-- do espaço de busca (32^8 ≈ 1,1 trilhão) + expiração de 10min + o
-- CAPTCHA no login anônimo (pré-requisito manual acima), não deste
-- contador. Sendo honesto sobre o que cada camada realmente protege.

create table if not exists public.child_pairing_codes (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references public.children (id) on delete cascade,
  created_by     uuid not null references public.profiles (id),
  code_hash      text not null,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  attempts_count int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists cpc_child_idx on public.child_pairing_codes (child_id);
create index if not exists cpc_hash_idx on public.child_pairing_codes (code_hash);

-- auth_user_id único: 1 dispositivo (1 sessão anônima) pareia com 1
-- criança de cada vez. Uma criança pode ter vários dispositivos (sem
-- unique em child_id).
create table if not exists public.paired_devices (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  child_id     uuid not null references public.children (id) on delete cascade,
  paired_by    uuid not null references public.profiles (id),
  device_name  text,
  paired_at    timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists pd_child_idx on public.paired_devices (child_id);

-- RLS: child_pairing_codes é RPC-only, zero select/insert direto — o
-- código nunca precisa ser lido de volta da tabela (create_pairing_code
-- devolve o texto direto, uma vez só). paired_devices tem select normal
-- pro tutor/responsável/admin (mesmo padrão de sempre, pra "tela de
-- dispositivos conectados" não precisar de RPC própria) — sem
-- insert/update direto, isso é só via claim/revoke.

alter table public.child_pairing_codes enable row level security;
alter table public.paired_devices enable row level security;

drop policy if exists cpc_admin_all on public.child_pairing_codes;
create policy cpc_admin_all on public.child_pairing_codes
  for all using (public.is_admin()) with check (public.is_admin());
-- (sem grant de select/insert pra authenticated de propósito — só admin
-- via policy acima, todo mundo mais entra pelas RPCs, security definer)

drop policy if exists pd_tutor_select on public.paired_devices;
drop policy if exists pd_guardian_select on public.paired_devices;
drop policy if exists pd_admin_all on public.paired_devices;

grant select on public.paired_devices to authenticated;

create policy pd_tutor_select on public.paired_devices
  for select using (public.is_tutor_of(child_id));
create policy pd_guardian_select on public.paired_devices
  for select using (public.is_guardian_of(child_id));
create policy pd_admin_all on public.paired_devices
  for all using (public.is_admin()) with check (public.is_admin());

-- PASSO E — is_paired_device_of ------------------------------------------
-- Exige as DUAS coisas: o JWT precisa dizer is_anonymous=true (uma conta
-- normal comprometida não vira "dispositivo" só por estar em
-- paired_devices por engano) E existir vínculo ativo não revogado.

create or replace function public.is_paired_device_of(p_child_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    and exists (
      select 1 from public.paired_devices pd
      where pd.auth_user_id = auth.uid()
        and pd.child_id = p_child_id
        and pd.revoked_at is null
    );
$$;

-- PASSO F — RPCs: gerar, reivindicar, revogar, contexto ------------------

create or replace function public.create_pairing_code(p_child_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_charset text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I/L (ambíguos)
  v_code    text := '';
  v_i       int;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;
  if not (public.is_tutor_of(p_child_id) or public.is_guardian_of(p_child_id) or public.is_admin()) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  for v_i in 1..8 loop
    v_code := v_code || substr(v_charset, 1 + floor(random() * length(v_charset))::int, 1);
  end loop;

  insert into public.child_pairing_codes (child_id, created_by, code_hash, expires_at)
  values (p_child_id, auth.uid(), encode(digest(v_code, 'sha256'), 'hex'), now() + interval '10 minutes');

  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end;
$$;

-- claim: só usuário anônimo pode chamar (não deixa uma conta normal se
-- "parear" como se fosse dispositivo). Mensagem de erro sempre genérica —
-- não revela se o código existe, expirou, ou já foi usado, de propósito.
create or replace function public.claim_pairing_code(p_code text, p_device_name text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_normalized text;
  v_hash       text;
  v_row        public.child_pairing_codes%rowtype;
  v_attempts   int;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;
  if not coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Este código só pode ser usado por um dispositivo pareado.';
  end if;

  v_normalized := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_normalized) <> 8 then
    raise exception 'Código inválido ou expirado.';
  end if;
  v_hash := encode(digest(v_normalized, 'sha256'), 'hex');

  select * into v_row
  from public.child_pairing_codes
  where code_hash = v_hash
  for update;

  if v_row.id is null then
    raise exception 'Código inválido ou expirado.';
  end if;

  update public.child_pairing_codes
  set attempts_count = attempts_count + 1
  where id = v_row.id
  returning attempts_count into v_attempts;

  if v_row.used_at is not null or v_row.expires_at < now() or v_attempts > 5 then
    raise exception 'Código inválido ou expirado.';
  end if;

  update public.child_pairing_codes set used_at = now() where id = v_row.id;

  insert into public.paired_devices (auth_user_id, child_id, paired_by, device_name)
  values (auth.uid(), v_row.child_id, v_row.created_by, p_device_name)
  on conflict (auth_user_id) do update
    set child_id = excluded.child_id,
        paired_by = excluded.paired_by,
        device_name = coalesce(excluded.device_name, public.paired_devices.device_name),
        paired_at = now(),
        revoked_at = null;

  return v_row.child_id;
end;
$$;

create or replace function public.revoke_paired_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_child_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  select child_id into v_child_id from public.paired_devices where id = p_device_id;
  if v_child_id is null then
    raise exception 'Dispositivo não encontrado.';
  end if;

  if not (public.is_tutor_of(v_child_id) or public.is_guardian_of(v_child_id) or public.is_admin()) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  update public.paired_devices set revoked_at = now()
  where id = p_device_id and revoked_at is null;
end;
$$;

-- Contexto mínimo que o app infantil lê no boot — nada de expor a tabela
-- children inteira via RLS pro dispositivo; só isto, via RPC.
create or replace function public.get_paired_child_context()
returns table (
  child_id uuid,
  primeiro_nome text,
  cycle_id uuid,
  child_trail_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.paired_devices
  set last_seen_at = now()
  where auth_user_id = auth.uid() and revoked_at is null;

  return query
    select c.id, split_part(c.name, ' ', 1), ct.cycle_id, ct.id
    from public.paired_devices pd
    join public.children c on c.id = pd.child_id
    left join public.child_trails ct on ct.child_id = pd.child_id and ct.status = 'ativa'
    where pd.auth_user_id = auth.uid() and pd.revoked_at is null;
end;
$$;

revoke all privileges on function public.create_pairing_code(uuid) from public;
revoke all privileges on function public.create_pairing_code(uuid) from anon;
grant execute on function public.create_pairing_code(uuid) to authenticated;

revoke all privileges on function public.claim_pairing_code(text, text) from public;
revoke all privileges on function public.claim_pairing_code(text, text) from anon;
grant execute on function public.claim_pairing_code(text, text) to authenticated;

revoke all privileges on function public.revoke_paired_device(uuid) from public;
revoke all privileges on function public.revoke_paired_device(uuid) from anon;
grant execute on function public.revoke_paired_device(uuid) to authenticated;

revoke all privileges on function public.get_paired_child_context() from public;
revoke all privileges on function public.get_paired_child_context() from anon;
grant execute on function public.get_paired_child_context() to authenticated;

-- PASSO G — Policies mínimas nas tabelas que o dispositivo precisa ler ---
-- Aditivas — não troca nenhuma policy de tutor/guardian/admin já
-- existente, só soma um branch novo. child_trails/child_trail_modules/
-- child_trail_missions/child_activities já têm grant select pra
-- authenticated desde as fases 5/4b — o dispositivo herda isso pelo
-- papel, só faltava a policy de linha.

drop policy if exists ct_device_select on public.child_trails;
create policy ct_device_select on public.child_trails
  for select using (public.is_paired_device_of(child_id));

drop policy if exists ctm_device_select on public.child_trail_modules;
create policy ctm_device_select on public.child_trail_modules
  for select using (exists (
    select 1 from public.child_trails ct
    where ct.id = child_trail_id and public.is_paired_device_of(ct.child_id)
  ));

drop policy if exists ctmi_device_select on public.child_trail_missions;
create policy ctmi_device_select on public.child_trail_missions
  for select using (exists (
    select 1 from public.child_trail_modules ctm
    join public.child_trails ct on ct.id = ctm.child_trail_id
    where ctm.id = child_trail_module_id and public.is_paired_device_of(ct.child_id)
  ));

drop policy if exists ca_device_select on public.child_activities;
create policy ca_device_select on public.child_activities
  for select using (public.is_paired_device_of(child_id));

-- Só insert — o dispositivo grava a execução, nunca precisa ler
-- atividade_execucao de volta.
drop policy if exists ae_device_insert on public.atividade_execucao;
create policy ae_device_insert on public.atividade_execucao
  for insert with check (public.is_paired_device_of(child_id) and executed_by = auth.uid());

-- Catálogo (trail_templates/trail_modules/mission_templates): NÃO precisa
-- de policy nova — tt_authenticated_select/tm_authenticated_select/
-- mt_authenticated_select (fase 5) já liberam pra qualquer authenticated
-- com status='published', e dispositivo pareado usa o papel authenticated
-- (é exatamente o ponto que você levantou: usuário anônimo do Supabase
-- NÃO usa o papel "anon", usa "authenticated" — qualquer policy antiga
-- "to authenticated using (true)" já vale pra ele também, por isso o
-- Passo H de auditoria abaixo é importante).

-- PASSO H — Auditoria: toda policy de authenticated do schema -----------
-- Rode e revise cada linha. Qualquer coisa que pareça ampla demais pra um
-- dispositivo infantil ver (sessions, learning_profiles, consents,
-- adminNotes, tutor_applications, reports — nada disso deveria aparecer
-- aqui com using(true) ou condição fraca) precisa de policy mais
-- específica, não uma tabela nova bloqueando.

select schemaname, tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- PASSO I — Teste manual completo ----------------------------------------
-- I1) Como tutor/responsável logado, gere um código pro Mateus:
--
-- select public.create_pairing_code('<child_id_mateus>');
-- -- anote o código devolvido, ex.: '7K4M-9P2D'
--
-- I2) No cliente (não dá pra simular só em SQL — precisa do
-- supabase-js): supabase.auth.signInAnonymously(), depois:
--
-- select public.claim_pairing_code('7K4M-9P2D', 'iPhone de teste');
-- -- esperado: devolve o child_id do Mateus
--
-- select * from public.get_paired_child_context();
-- -- esperado: 1 linha — child_id, "Mateus", cycle_id, child_trail_id
--
-- I3) Chamar claim_pairing_code de novo com o MESMO código deve falhar
-- ("Código inválido ou expirado." — já usado).
--
-- I4) Como tutor, revogue:
--
-- select public.revoke_paired_device('<paired_device_id>');
--
-- I5) Repita get_paired_child_context() com a MESMA sessão anônima —
-- esperado: 0 linhas (revogado, sem acesso).

-- PASSO J — Limpeza de anônimos não pareados (manual por enquanto) ------
-- Supabase não limpa usuário anônimo sozinho. Função pronta pra rodar
-- quando lembrar (ou automatizar depois via pg_cron, se disponível no seu
-- plano — não assumido aqui). Só apaga auth.users anônimo SEM linha em
-- paired_devices (nunca chegou a parear) e com mais de 48h de vida —
-- nunca mexe em dispositivo já pareado, pareado e revogado depois
-- continua existindo (histórico de atividade_execucao dele fica intacto).

create or replace function public.cleanup_unclaimed_anonymous_users()
returns int
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;

  with candidatos as (
    select u.id from auth.users u
    where coalesce(u.is_anonymous, false)
      and u.created_at < now() - interval '48 hours'
      and not exists (select 1 from public.paired_devices pd where pd.auth_user_id = u.id)
  )
  delete from auth.users where id in (select id from candidatos);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all privileges on function public.cleanup_unclaimed_anonymous_users() from public;
revoke all privileges on function public.cleanup_unclaimed_anonymous_users() from anon;
grant execute on function public.cleanup_unclaimed_anonymous_users() to authenticated;

-- Não é esta etapa: esconder role='child_device' das listas de admin
-- (js/pages/admin.js ainda não foi lido/tocado nesta sessão — se ele
-- lista profiles por role, vai precisar filtrar; sinalizar antes de
-- assumir como já resolvido). requirePairedDevice() e a tela de código no
-- front-end (próximo passo, só depois dos dois pré-requisitos manuais do
-- topo estarem ligados e deste SQL testado).
