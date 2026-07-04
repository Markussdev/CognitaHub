-- ============================================================
-- Cognita Hub — Fase 4B (A Corrente): autoria de atividade pelo tutor
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: dar ao tutor um lugar no banco para SALVAR uma atividade
-- que ele compôs pra uma criança específica (molde + tema + config +
-- instrução) e um lugar para o Modo Criança devolver o sinal de saída
-- ao encerrar. Fechar este schema é o mesmo passo que "o tutor cria
-- atividades" — não duas tarefas separadas.
--
-- Duas tabelas novas, duas faces diferentes da mesma corrente:
--   child_activities   — a instância autorada (o que o tutor compôs)
--   atividade_execucao — o sinal de execução (o que a criança fez)
-- `activities` continua sendo o roteiro/catálogo — não mexemos nela.
--
-- Pré-requisito: docs/supabase-rls-fix.sql já aplicado (funções
-- is_admin/is_guardian_of/is_tutor_of + policies base). O PASSO A1
-- confirma isso antes de criar qualquer coisa.
-- ============================================================

-- PASSO A1 — Verificações (só leitura) -------------------------
-- Precisa listar children, activities e as 3 funções de RLS. Se
-- faltar algo, aplique supabase-rls-fix.sql antes de continuar.

select 'children' as ok where exists (select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'children');
select 'activities' as ok where exists (select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'activities');

select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('is_admin', 'is_guardian_of', 'is_tutor_of');

-- PASSO A2 — Cria a tabela da instância autorada ----------------
-- Âncora em child_id (não em cycle_id): reusa is_tutor_of/is_guardian_of
-- direto, sem função nova. cycle_id fica opcional, só para relatório.
--
-- Enxutez deliberada: a linha guarda só o que o TUTOR controla (molde,
-- tema, config, instrução, título curto). Falas de acolhimento/feedback
-- têm padrão por molde no código — não se repetem por linha.

create table if not exists public.child_activities (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.children (id) on delete cascade,
  created_by   uuid not null references public.profiles (id),
  template_id  uuid references public.activities (id),          -- roteiro de origem (opcional)
  cycle_id     uuid references public.support_cycles (id),      -- opcional, p/ relatório
  molde        text not null check (molde in ('identificar', 'contar', 'comparar', 'associar')),
  tema         text not null,                                    -- slug do tema (ex.: 'dinossauros')
  config       jsonb not null default '{}'::jsonb,               -- { quantidade, nivel, rodadas, ... }
  instrucao    text not null,
  titulo       text,                                             -- nome curto p/ o tutor reconhecer
  status       text not null default 'ready'
                 check (status in ('draft', 'ready', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ca_child_idx on public.child_activities (child_id);

-- PASSO A3 — RLS de child_activities (reusa as funções existentes) --

alter table public.child_activities enable row level security;
grant select, insert, update on public.child_activities to authenticated;

drop policy if exists ca_tutor_select on public.child_activities;
drop policy if exists ca_tutor_insert on public.child_activities;
drop policy if exists ca_tutor_update on public.child_activities;
drop policy if exists ca_guardian_select on public.child_activities;
drop policy if exists ca_admin_all on public.child_activities;

-- tutor que acompanha a criança: autora e edita
create policy ca_tutor_select on public.child_activities
  for select using (public.is_tutor_of(child_id));
create policy ca_tutor_insert on public.child_activities
  for insert with check (public.is_tutor_of(child_id) and created_by = auth.uid());
create policy ca_tutor_update on public.child_activities
  for update using (public.is_tutor_of(child_id))
  with check (public.is_tutor_of(child_id));

-- responsável que é dono da criança: lê (para fazer em casa)
create policy ca_guardian_select on public.child_activities
  for select using (public.is_guardian_of(child_id));

-- admin: tudo
create policy ca_admin_all on public.child_activities
  for all using (public.is_admin()) with check (public.is_admin());

-- PASSO B1 — Cria a tabela do sinal de execução -----------------
-- O que o Modo Criança monta em montarAtividadeExecucao() ao encerrar
-- (js/pages/modo-crianca.js). É o Nível 1 (dado estruturado) do
-- Registro de Sessão em 3 níveis — os Níveis 2 e 3 são escritos pelo
-- tutor depois, no registro; esta tabela entrega o Nível 1 de graça.

create table if not exists public.atividade_execucao (
  id                        uuid primary key default gen_random_uuid(),
  child_activity_id         uuid not null references public.child_activities (id) on delete cascade,
  child_id                  uuid not null references public.children (id) on delete cascade,
  session_id                uuid references public.sessions (id) on delete set null,  -- setado ao virar registro
  executed_by               uuid not null references public.profiles (id),
  molde                     text not null,   -- snapshot (a instância pode mudar depois)
  tema                      text not null,
  nivel_final               int,
  precisou_mais_facil       boolean not null default false,
  tempo_aproximado_segundos int,
  como_encerrou             text check (como_encerrou in
                              ('crianca_concluiu', 'adulto_encerrou', 'pausa', 'recusa')),
  created_at                timestamptz not null default now()
);

create index if not exists ae_child_idx on public.atividade_execucao (child_id);

-- PASSO B2 — RLS de atividade_execucao ---------------------------

alter table public.atividade_execucao enable row level security;
grant select, insert on public.atividade_execucao to authenticated;

drop policy if exists ae_tutor_select on public.atividade_execucao;
drop policy if exists ae_tutor_insert on public.atividade_execucao;
drop policy if exists ae_guardian_select on public.atividade_execucao;
drop policy if exists ae_guardian_insert on public.atividade_execucao;
drop policy if exists ae_admin_all on public.atividade_execucao;

create policy ae_tutor_select on public.atividade_execucao
  for select using (public.is_tutor_of(child_id));
create policy ae_tutor_insert on public.atividade_execucao
  for insert with check (public.is_tutor_of(child_id) and executed_by = auth.uid());
create policy ae_guardian_select on public.atividade_execucao
  for select using (public.is_guardian_of(child_id));
create policy ae_guardian_insert on public.atividade_execucao
  for insert with check (public.is_guardian_of(child_id) and executed_by = auth.uid());
create policy ae_admin_all on public.atividade_execucao
  for all using (public.is_admin()) with check (public.is_admin());

-- PASSO B3 — Ponte para o registro: a sessão sabe de qual instância veio --

alter table public.sessions
  add column if not exists child_activity_id uuid references public.child_activities (id);

-- PASSO C — Conferência final ------------------------------------

-- C1) As duas tabelas e a coluna-ponte existem?
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('child_activities', 'atividade_execucao');

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'sessions' and column_name = 'child_activity_id';

-- C2) Teste manual — troque <child_id> e <tutor_profile_id> pelos uuids
-- reais de uma criança e do tutor que a acompanha (ver support_cycles),
-- descomente e rode para confirmar que a RLS deixa o tutor autorar e ler:
--
-- insert into public.child_activities
--   (child_id, created_by, molde, tema, config, instrucao, titulo)
-- values
--   ('<child_id>', '<tutor_profile_id>', 'contar', 'dinossauros',
--    '{"quantidade":5,"nivel":1,"rodadas":3}'::jsonb,
--    'Toque em cada dinossauro para contar.', 'Contar dinossauros');
--
-- select * from public.child_activities where child_id = '<child_id>';

-- Não é esta etapa: a tela de autoria do tutor, a troca do stub no
-- Modo Criança, os outros moldes. Ver docs/PLANO-V1.md para a sequência.
