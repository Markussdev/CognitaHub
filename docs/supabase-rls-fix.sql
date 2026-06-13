-- ============================================================
-- Cognita Hub — Correção do RLS no Supabase (rodar no SQL Editor)
-- ============================================================
-- PROBLEMA DETECTADO: as policies atuais de children/support_cycles
-- referenciam uma à outra (children -> support_cycles -> children),
-- causando "infinite recursion detected in policy" (erro 42P17) em
-- QUALQUER leitura de children, learning_profiles, support_cycles,
-- sessions, progress_logs e reports.
--
-- SOLUÇÃO: funções SECURITY DEFINER (executam sem RLS) quebram o
-- ciclo entre as policies. Este script APAGA todas as policies de
-- children, learning_profiles, consents, support_cycles e
-- tutor_applications e recria um conjunto coerente para o MVP.
--
-- Revise antes de rodar. Rode uma vez, inteiro.
-- ============================================================

-- 1) Funções auxiliares (sem recursão) ------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_guardian_of(child uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from children c
    where c.id = child and c.guardian_id = auth.uid()
  );
$$;

create or replace function public.is_tutor_of(child uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from support_cycles sc
    where sc.child_id = child and sc.tutor_id = auth.uid()
  );
$$;

-- 2) Remove as policies antigas das tabelas afetadas ----------
-- (sem bloco "do $$": o parser do SQL Editor recusa o comando "do")
-- 2a) Esta consulta GERA um drop para cada policy existente —
-- copie o resultado da coluna "comando_drop" e rode aqui:

select format('drop policy %I on public.%I;', policyname, tablename) as comando_drop
from pg_policies
where schemaname = 'public'
  and tablename in ('children', 'learning_profiles', 'consents',
                    'support_cycles', 'tutor_applications');

-- 2b) As policies que ESTE script cria já caem aqui (permite rodar
-- o script de novo sem erro de nome duplicado):

drop policy if exists children_guardian_select on public.children;
drop policy if exists children_guardian_insert on public.children;
drop policy if exists children_guardian_update on public.children;
drop policy if exists children_tutor_select on public.children;
drop policy if exists children_admin_all on public.children;
drop policy if exists lp_guardian_select on public.learning_profiles;
drop policy if exists lp_guardian_insert on public.learning_profiles;
drop policy if exists lp_tutor_select on public.learning_profiles;
drop policy if exists lp_admin_all on public.learning_profiles;
drop policy if exists consents_guardian_select on public.consents;
drop policy if exists consents_guardian_insert on public.consents;
drop policy if exists consents_admin_select on public.consents;
drop policy if exists sc_tutor_select on public.support_cycles;
drop policy if exists sc_guardian_select on public.support_cycles;
drop policy if exists sc_admin_all on public.support_cycles;
drop policy if exists ta_tutor_select on public.tutor_applications;
drop policy if exists ta_tutor_insert on public.tutor_applications;
drop policy if exists ta_tutor_update on public.tutor_applications;
drop policy if exists ta_admin_all on public.tutor_applications;

-- 3) Recria as policies (MVP) ---------------------------------

alter table public.children enable row level security;
alter table public.learning_profiles enable row level security;
alter table public.consents enable row level security;
alter table public.support_cycles enable row level security;
alter table public.tutor_applications enable row level security;

-- children: responsável gerencia os próprios filhos; tutor lê os
-- que acompanha (via support_cycles, sem recursão); admin tudo.
create policy children_guardian_select on public.children
  for select using (guardian_id = auth.uid());
create policy children_guardian_insert on public.children
  for insert with check (guardian_id = auth.uid());
create policy children_guardian_update on public.children
  for update using (guardian_id = auth.uid());
create policy children_tutor_select on public.children
  for select using (public.is_tutor_of(id));
create policy children_admin_all on public.children
  for all using (public.is_admin()) with check (public.is_admin());

-- learning_profiles: segue a criança.
create policy lp_guardian_select on public.learning_profiles
  for select using (public.is_guardian_of(child_id));
create policy lp_guardian_insert on public.learning_profiles
  for insert with check (public.is_guardian_of(child_id));
create policy lp_tutor_select on public.learning_profiles
  for select using (public.is_tutor_of(child_id));
create policy lp_admin_all on public.learning_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- consents: só o responsável cria/lê; admin lê.
create policy consents_guardian_select on public.consents
  for select using (guardian_id = auth.uid());
create policy consents_guardian_insert on public.consents
  for insert with check (guardian_id = auth.uid());
create policy consents_admin_select on public.consents
  for select using (public.is_admin());

-- support_cycles: tutor vê os seus; responsável vê os dos filhos;
-- admin gerencia (criação de ciclo é tarefa do admin na Fase 3).
create policy sc_tutor_select on public.support_cycles
  for select using (tutor_id = auth.uid());
create policy sc_guardian_select on public.support_cycles
  for select using (public.is_guardian_of(child_id));
create policy sc_admin_all on public.support_cycles
  for all using (public.is_admin()) with check (public.is_admin());

-- tutor_applications: tutor cria/lê/edita a própria candidatura; admin tudo.
-- O update só vale enquanto status = 'pending' (no with check): impede o
-- tutor de se auto-aprovar ou reativar uma candidatura recusada.
create policy ta_tutor_select on public.tutor_applications
  for select using (tutor_id = auth.uid());
create policy ta_tutor_insert on public.tutor_applications
  for insert with check (tutor_id = auth.uid());
create policy ta_tutor_update on public.tutor_applications
  for update using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid() and status = 'pending');
create policy ta_admin_all on public.tutor_applications
  for all using (public.is_admin()) with check (public.is_admin());

-- 4) Grants para o papel authenticated (RLS continua filtrando) -

grant select, insert, update on public.children to authenticated;
grant select, insert, update on public.learning_profiles to authenticated;
grant select, insert on public.consents to authenticated;
grant select, insert, update on public.support_cycles to authenticated;
grant select, insert, update on public.tutor_applications to authenticated;

-- 5) Trigger de criação do profile ------------------------------
-- ⚠️ SUPERSEDED: use docs/supabase-signup-fix.sql no lugar desta
-- seção. Este bloco só remove um trigger chamado on_auth_user_created;
-- se o trigger antigo tiver OUTRO nome, ficam dois triggers inserindo
-- em profiles e todo signup quebra com "Database error saving new user".
-- O signup-fix remove todos os triggers de usuário do auth.users antes
-- de recriar um único.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
