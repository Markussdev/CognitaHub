-- ============================================================
-- Cognita Hub — Fase 4A (pareamento pelo admin): preparação no Supabase
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: o admin cria o support_cycle por botão (em vez de SQL na
-- mão) e a criança passa de waiting_match → active. Pré-requisito:
-- docs/supabase-rls-fix.sql (função is_admin + policies) e
-- docs/supabase-fase-3.sql já aplicados.
-- ============================================================

-- PASSO 1 — Verificações (só leitura) -------------------------

-- 1a) Colunas da support_cycles — confirme que existem child_id,
-- tutor_id, start_date, end_date, status, main_goal, current_plan.

select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'support_cycles'
order by ordinal_position;

-- 1b) CHECKs de status — o ciclo é criado com status 'active' e a
-- criança vai para 'active'. Confirme que ambos os valores são aceitos.

select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where contype = 'c'
  and conrelid in ('public.support_cycles'::regclass, 'public.children'::regclass);

-- 1c) Policies já existentes em support_cycles. Se o rls-fix já criou
-- sc_admin_all (for all), o PASSO 2 vira redundante — mas rodá-lo não
-- causa erro (drop if exists antes de create).

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'support_cycles';

-- PASSO 2 — Grants + policies para o admin criar/editar ciclos -

grant select, insert, update on public.support_cycles to authenticated;
grant select, update on public.children to authenticated;
grant select on public.profiles to authenticated;
grant select on public.tutor_applications to authenticated;

drop policy if exists sc_admin_insert on public.support_cycles;
drop policy if exists sc_admin_update on public.support_cycles;

create policy sc_admin_insert
on public.support_cycles
for insert
to authenticated
with check (public.is_admin());

create policy sc_admin_update
on public.support_cycles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- PASSO 2b — Responsável lê o perfil do tutor vinculado ----------
-- Sem esta policy, o responsável enxerga support_cycles, mas o embed do
-- tutor em profiles pode vir vazio por RLS.

create or replace function public.is_guardian_of_tutor(tutor uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_cycles sc
    join public.children c on c.id = sc.child_id
    where sc.tutor_id = tutor
      and c.guardian_id = auth.uid()
  );
$$;

drop policy if exists profiles_guardian_tutor_select on public.profiles;

create policy profiles_guardian_tutor_select
on public.profiles
for select
to authenticated
using (public.is_guardian_of_tutor(id));

-- Observação: sc_tutor_select e sc_guardian_select (leitura do tutor e
-- do responsável) já vêm do rls-fix §3 — é o que faz a criança aparecer
-- no painel do tutor e o ciclo no painel do responsável após a criação.

-- PASSO 3 — Conferência final ----------------------------------

select count(*) as criancas_aguardando_pareamento
from public.children where status = 'waiting_match';

select count(*) as tutores_disponiveis
from public.profiles where role = 'tutor' and status = 'active';
