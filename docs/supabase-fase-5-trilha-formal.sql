-- ============================================================
-- Cognita Hub — Fase 5: currículo formal da trilha (Trilha → Módulo → Missão)
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: substituir PLANOS_REGISTRO.primeiros_numeros (hardcoded em
-- js/data/planos-registro.js) por um currículo formal no banco, com
-- vínculo direto entre missão da criança e child_activity — sem inferir
-- por coincidência de molde+tema+config nunca mais.
--
-- Duas famílias de tabela:
--   trail_templates / trail_modules / mission_templates
--     — CATÁLOGO. Conteúdo pedagógico reutilizável, igual pra qualquer
--       criança (homogêneo, como o Duolingo ABC). Autoria da equipe
--       Cognita, não do tutor. Só leitura pro tutor/responsável.
--   child_trails / child_trail_modules / child_trail_missions
--     — INSTÂNCIA. A aplicação do template pra UMA criança: progresso,
--       adaptações escolhidas pelo tutor, datas. Nenhuma escrita direta
--       do navegador — só via função security definer (Fase 2/3, ainda
--       não criada aqui). Por enquanto só leitura, pra manter a
--       superfície de escrita fechada até a RPC existir.
--
-- Esta entrega NÃO cria: a RPC de atribuir trilha (Fase 2), a RPC de
-- liberar módulo em lote (Fase 3), nem toca em Modo Criança/moldes.
-- child_activities ganha só a coluna-ponte (Passo D) — continua podendo
-- nascer avulsa (child_trail_mission_id null), exatamente como hoje.
--
-- Pré-requisito: docs/supabase-fase-4b-corrente.sql e
-- docs/activities-seed.sql já aplicados (is_admin/is_guardian_of/
-- is_tutor_of, child_activities, public.skills).
-- ============================================================

-- PASSO A — Verificações (só leitura) -----------------------------

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('is_admin', 'is_guardian_of', 'is_tutor_of');

select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('children', 'support_cycles', 'child_activities', 'skills');

-- Se alguma das duas consultas acima vier vazia/incompleta, aplique os
-- pré-requisitos listados no cabeçalho antes de continuar.

-- PASSO B — Catálogo: trail_templates, trail_modules, mission_templates --

create table if not exists public.trail_templates (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                              -- ex.: 'fundamentos_numericos'
  title        text not null,
  description  text,
  track_type   text not null default 'learning' check (track_type in ('learning', 'review')),
  age_min      int,
  age_max      int,
  version      int not null default 1,                             -- copiado pra child_trails.template_version na atribuição
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.trail_modules (
  id                 uuid primary key default gen_random_uuid(),
  trail_template_id  uuid not null references public.trail_templates (id) on delete cascade,
  position           int not null,
  title              text not null,
  objective          text,
  visual_key         text,                                         -- reservado pro cenário/decoração quando existir o mapa de mundos
  created_at         timestamptz not null default now(),
  unique (trail_template_id, position)
);

create table if not exists public.mission_templates (
  id                 uuid primary key default gen_random_uuid(),
  trail_module_id    uuid not null references public.trail_modules (id) on delete cascade,
  position           int not null,
  title              text not null,
  skill_id           text references public.skills (id),           -- reusa a taxonomia da Biblioteca de Atividades, não cria outra
  molde              text not null check (molde in ('identificar', 'contar', 'comparar', 'associar')),
  default_tema       text not null,
  default_config     jsonb not null default '{}'::jsonb,            -- mesmo formato de child_activities.config
  default_instrucao  text not null,
  created_at         timestamptz not null default now(),
  unique (trail_module_id, position)
);

-- RLS do catálogo: leitura aberta pro que estiver 'published' (autor vê
-- draft também); escrita só admin — não existe autoria de tutor aqui.

alter table public.trail_templates enable row level security;
alter table public.trail_modules enable row level security;
alter table public.mission_templates enable row level security;

grant select on public.trail_templates to authenticated;
grant select on public.trail_modules to authenticated;
grant select on public.mission_templates to authenticated;

drop policy if exists tt_authenticated_select on public.trail_templates;
drop policy if exists tt_admin_all on public.trail_templates;
drop policy if exists tm_authenticated_select on public.trail_modules;
drop policy if exists tm_admin_all on public.trail_modules;
drop policy if exists mt_authenticated_select on public.mission_templates;
drop policy if exists mt_admin_all on public.mission_templates;

create policy tt_authenticated_select on public.trail_templates
  for select using (status = 'published' or public.is_admin());
create policy tt_admin_all on public.trail_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy tm_authenticated_select on public.trail_modules
  for select using (exists (
    select 1 from public.trail_templates t
    where t.id = trail_template_id and (t.status = 'published' or public.is_admin())
  ));
create policy tm_admin_all on public.trail_modules
  for all using (public.is_admin()) with check (public.is_admin());

create policy mt_authenticated_select on public.mission_templates
  for select using (exists (
    select 1 from public.trail_modules m
    join public.trail_templates t on t.id = m.trail_template_id
    where m.id = trail_module_id and (t.status = 'published' or public.is_admin())
  ));
create policy mt_admin_all on public.mission_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- PASSO C — Instância: child_trails, child_trail_modules, child_trail_missions --
-- Módulos/missões de uma criança só existem a partir do módulo em que ela
-- entrou (starting_module_id) — módulos anteriores não são materializados
-- pra ela, mesma lógica de "nada nasce até precisar" já usada em
-- child_activities. status 'bloqueado' é o estado inicial de todo módulo/
-- missão instanciado; o módulo/missão "atual" é sempre o de menor
-- position ainda não concluído (mesmo cálculo que computeStatusEtapas já
-- faz hoje, só que sobre dado real em vez de inferido).

create table if not exists public.child_trails (
  id                 uuid primary key default gen_random_uuid(),
  child_id           uuid not null references public.children (id) on delete cascade,
  cycle_id           uuid references public.support_cycles (id),
  trail_template_id  uuid not null references public.trail_templates (id),
  template_version   int not null,                                 -- snapshot da versão no momento da atribuição
  starting_module_id uuid references public.trail_modules (id),
  assigned_by        uuid not null references public.profiles (id),
  status             text not null default 'ativa' check (status in ('ativa', 'pausada', 'concluida')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists ct_child_idx on public.child_trails (child_id);

create table if not exists public.child_trail_modules (
  id                uuid primary key default gen_random_uuid(),
  child_trail_id    uuid not null references public.child_trails (id) on delete cascade,
  trail_module_id   uuid not null references public.trail_modules (id),
  status            text not null default 'bloqueado'
                       check (status in ('bloqueado', 'liberado', 'aguardando_revisao', 'concluido')),
  adaptation_config jsonb not null default '{}'::jsonb,             -- tema/rodadas/apoio escolhidos pelo tutor na liberação
  tutor_decision    text check (tutor_decision in ('avancar', 'repetir', 'adaptar', 'voltar_revisao', 'pausar')),
  released_at       timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (child_trail_id, trail_module_id)
);

create index if not exists ctm_trail_idx on public.child_trail_modules (child_trail_id);

create table if not exists public.child_trail_missions (
  id                     uuid primary key default gen_random_uuid(),
  child_trail_module_id  uuid not null references public.child_trail_modules (id) on delete cascade,
  mission_template_id    uuid not null references public.mission_templates (id),
  status                 text not null default 'bloqueada'
                            check (status in ('bloqueada', 'disponivel', 'concluida')),
  unlocked_at            timestamptz,
  completed_at           timestamptz,
  attempts_count         int not null default 0,
  created_at             timestamptz not null default now(),
  unique (child_trail_module_id, mission_template_id)
);

create index if not exists ctmi_module_idx on public.child_trail_missions (child_trail_module_id);

-- RLS da instância: tutor que acompanha a criança lê; responsável lê;
-- admin tudo. SEM grant de insert/update pra authenticated — essas três
-- tabelas só devem mudar via função security definer (Fase 2/3), nunca
-- por insert/update direto do navegador. Enquanto a RPC não existe,
-- ficam efetivamente read-only pra todo mundo menos admin.

alter table public.child_trails enable row level security;
alter table public.child_trail_modules enable row level security;
alter table public.child_trail_missions enable row level security;

grant select on public.child_trails to authenticated;
grant select on public.child_trail_modules to authenticated;
grant select on public.child_trail_missions to authenticated;

drop policy if exists ct_tutor_select on public.child_trails;
drop policy if exists ct_guardian_select on public.child_trails;
drop policy if exists ct_admin_all on public.child_trails;
drop policy if exists ctm_tutor_select on public.child_trail_modules;
drop policy if exists ctm_guardian_select on public.child_trail_modules;
drop policy if exists ctm_admin_all on public.child_trail_modules;
drop policy if exists ctmi_tutor_select on public.child_trail_missions;
drop policy if exists ctmi_guardian_select on public.child_trail_missions;
drop policy if exists ctmi_admin_all on public.child_trail_missions;

create policy ct_tutor_select on public.child_trails
  for select using (public.is_tutor_of(child_id));
create policy ct_guardian_select on public.child_trails
  for select using (public.is_guardian_of(child_id));
create policy ct_admin_all on public.child_trails
  for all using (public.is_admin()) with check (public.is_admin());

create policy ctm_tutor_select on public.child_trail_modules
  for select using (exists (
    select 1 from public.child_trails ct
    where ct.id = child_trail_id and public.is_tutor_of(ct.child_id)
  ));
create policy ctm_guardian_select on public.child_trail_modules
  for select using (exists (
    select 1 from public.child_trails ct
    where ct.id = child_trail_id and public.is_guardian_of(ct.child_id)
  ));
create policy ctm_admin_all on public.child_trail_modules
  for all using (public.is_admin()) with check (public.is_admin());

create policy ctmi_tutor_select on public.child_trail_missions
  for select using (exists (
    select 1 from public.child_trail_modules ctm
    join public.child_trails ct on ct.id = ctm.child_trail_id
    where ctm.id = child_trail_module_id and public.is_tutor_of(ct.child_id)
  ));
create policy ctmi_guardian_select on public.child_trail_missions
  for select using (exists (
    select 1 from public.child_trail_modules ctm
    join public.child_trails ct on ct.id = ctm.child_trail_id
    where ctm.id = child_trail_module_id and public.is_guardian_of(ct.child_id)
  ));
create policy ctmi_admin_all on public.child_trail_missions
  for all using (public.is_admin()) with check (public.is_admin());

-- PASSO D — Ponte em child_activities ------------------------------
-- Atividade pertencente a uma missão da trilha carrega este id.
-- Atividade avulsa (criada fora da trilha, como hoje) continua null.
-- Sem "on delete cascade": nunca apagar uma missão da criança só porque
-- uma child_activity foi removida, nem o contrário.

alter table public.child_activities
  add column if not exists child_trail_mission_id uuid references public.child_trail_missions (id);

create index if not exists ca_trail_mission_idx on public.child_activities (child_trail_mission_id);

-- PASSO E — Seed: "Fundamentos Numéricos" como template oficial ---------
-- primeiros_numeros (5 etapas achatadas, js/data/planos-registro.js) vira
-- 2 módulos de 3 missões. A "revisão calma" original virava só 1 etapa no
-- final; aqui vira uma missão de revisão POR módulo (revisão até 5 e
-- revisão até 10), pra cada módulo fechar com o mesmo ritmo.
--
-- IDs fixos (não gen_random_uuid()) pra dar pra referenciar direto entre
-- as três tabelas sem precisar de CTE/RETURNING. Esquema legível:
-- módulo = ...0N01, missão = ...0N0P (N = módulo, P = posição na missão).

insert into public.trail_templates (id, slug, title, description, track_type, age_min, age_max, version, status)
values (
  '00000000-0000-4000-a000-000000000001',
  'fundamentos_numericos',
  'Fundamentos Numéricos',
  'Sequência guiada para reconhecimento e contagem dos números iniciais.',
  'learning', 5, 9, 1, 'published'
)
on conflict (id) do update set
  slug = excluded.slug, title = excluded.title, description = excluded.description,
  track_type = excluded.track_type, age_min = excluded.age_min, age_max = excluded.age_max,
  status = excluded.status, updated_at = now();

insert into public.trail_modules (id, trail_template_id, position, title, objective)
values
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000001', 1,
   'Números até 5', 'Reconhecer e contar números de 1 a 5.'),
  ('00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000001', 2,
   'Números até 10', 'Reconhecer e contar números de 1 a 10.')
on conflict (id) do update set
  title = excluded.title, objective = excluded.objective;

insert into public.mission_templates
  (id, trail_module_id, position, title, skill_id, molde, default_tema, default_config, default_instrucao)
values
  ('00000000-0000-4000-a000-000000000111', '00000000-0000-4000-a000-000000000101', 1,
   'Identificar números de 1 a 5', 'reconhecer-numeros', 'identificar', 'numeros',
   '{"maiorNumero":5,"opcoes":4,"nivel":1,"rodadas":3}'::jsonb,
   'Toque no número que eu disser.'),
  ('00000000-0000-4000-a000-000000000112', '00000000-0000-4000-a000-000000000101', 2,
   'Contar objetos até 5', 'contar-1-1', 'contar', 'dinossauros',
   '{"quantidade":5,"nivel":1,"rodadas":3}'::jsonb,
   'Toque em cada dinossauro para contar.'),
  ('00000000-0000-4000-a000-000000000113', '00000000-0000-4000-a000-000000000101', 3,
   'Revisão calma até 5', null, 'contar', 'dinossauros',
   '{"quantidade":3,"nivel":1,"rodadas":2}'::jsonb,
   'Toque em cada dinossauro para contar, sem pressa.'),
  ('00000000-0000-4000-a000-000000000121', '00000000-0000-4000-a000-000000000102', 1,
   'Identificar números de 1 a 10', 'reconhecer-numeros', 'identificar', 'numeros',
   '{"maiorNumero":10,"opcoes":5,"nivel":1,"rodadas":3}'::jsonb,
   'Toque no número que eu disser.'),
  ('00000000-0000-4000-a000-000000000122', '00000000-0000-4000-a000-000000000102', 2,
   'Contar objetos até 10', 'contar-1-1', 'contar', 'dinossauros',
   '{"quantidade":10,"nivel":1,"rodadas":3}'::jsonb,
   'Toque em cada dinossauro para contar.'),
  ('00000000-0000-4000-a000-000000000123', '00000000-0000-4000-a000-000000000102', 3,
   'Revisão calma até 10', null, 'contar', 'dinossauros',
   '{"quantidade":5,"nivel":1,"rodadas":2}'::jsonb,
   'Toque em cada dinossauro para contar, sem pressa.')
on conflict (id) do update set
  title = excluded.title, skill_id = excluded.skill_id, molde = excluded.molde,
  default_tema = excluded.default_tema, default_config = excluded.default_config,
  default_instrucao = excluded.default_instrucao;

-- Nota de conteúdo: escolhi quantidade:5/rodadas:2 pra revisão do Módulo
-- 2 (era 3/2 no original) pra não ficar mais fácil que a missão "Contar
-- até 10" que ela revisa. Ajuste os números se quiser outro critério —
-- é decisão de currículo, não de arquitetura.

-- PASSO F — Conferência final ---------------------------------------

-- F1) As 6 tabelas + a coluna-ponte existem?
select table_name from information_schema.tables
where table_schema = 'public' and table_name in
  ('trail_templates', 'trail_modules', 'mission_templates',
   'child_trails', 'child_trail_modules', 'child_trail_missions');

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'child_activities'
  and column_name = 'child_trail_mission_id';

-- F2) O seed carregou certo? Deve devolver 1 linha (template) com 2
-- módulos e 6 missões no total.
select t.title as trilha, m.position as modulo, m.title as modulo_titulo,
       count(mi.id) as missoes
from public.trail_templates t
join public.trail_modules m on m.trail_template_id = t.id
left join public.mission_templates mi on mi.trail_module_id = m.id
where t.slug = 'fundamentos_numericos'
group by t.title, m.position, m.title
order by m.position;

-- F3) Nenhuma policy de insert/update de authenticated deve existir nas
-- 3 tabelas de instância (escrita só via RPC, ainda não criada):
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('child_trails', 'child_trail_modules', 'child_trail_missions')
  and cmd in ('INSERT', 'UPDATE');
-- Se esta consulta devolver alguma linha, algo além deste script criou
-- uma policy de escrita — investigar antes de seguir pra Fase 2.

-- F4) Teste manual opcional — troque <child_id>/<cycle_id>/<tutor_profile_id>
-- pelos uuids reais do Mateus e rode como admin (service role ou usuário
-- com is_admin()) pra ver a trilha atribuída de verdade antes de existir
-- a RPC de atribuição (Fase 2):
--
-- insert into public.child_trails
--   (child_id, cycle_id, trail_template_id, template_version, starting_module_id, assigned_by)
-- values
--   ('<child_id>', '<cycle_id>', '00000000-0000-4000-a000-000000000001', 1,
--    '00000000-0000-4000-a000-000000000101', '<tutor_profile_id>')
-- returning id;
--
-- -- pegue o id devolvido acima e use como <child_trail_id> abaixo:
-- insert into public.child_trail_modules (child_trail_id, trail_module_id, status)
-- values ('<child_trail_id>', '00000000-0000-4000-a000-000000000101', 'bloqueado')
-- returning id;
--
-- -- pegue o id devolvido acima como <child_trail_module_id>:
-- insert into public.child_trail_missions (child_trail_module_id, mission_template_id, status)
-- select '<child_trail_module_id>', id, 'bloqueada'
-- from public.mission_templates where trail_module_id = '00000000-0000-4000-a000-000000000101';
--
-- select * from public.child_trail_missions where child_trail_module_id = '<child_trail_module_id>';

-- Não é esta etapa: RPC de atribuição (Fase 2), RPC de liberação em lote
-- (Fase 3), leitura pelo front-end (js/data/planos-registro.js e os 3
-- pontos que hoje leem PLANOS_REGISTRO direto: tutor.js, trilha.html,
-- app-crianca.js/trilha-crianca.js).
