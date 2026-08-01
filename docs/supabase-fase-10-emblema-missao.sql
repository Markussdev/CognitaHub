-- ============================================================
-- Cognita Hub — Fase 10 (prerequisito pequeno pro app infantil formal)
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: mission_templates não tinha campo de emblema (o ícone visual
-- do nó no mapa — identificar/contar/revisar). O sistema antigo
-- (PLANOS_REGISTRO em js/data/planos-registro.js) tinha isso por etapa;
-- ficou de fora do schema formal (docs/supabase-fase-5-trilha-formal.sql)
-- por descuido. Sem essa coluna, "Revisão calma" mostraria o mesmo ícone
-- de "Contar" no mapa da criança (molde é igual, emblema deveria ser
-- diferente) — pequeno, mas incorreto o bastante pra valer corrigir antes
-- do app infantil ler isso.
--
-- Pré-requisito: docs/supabase-fase-5-trilha-formal.sql já aplicado.
-- ============================================================

-- PASSO A — Coluna nova (nullable, sem quebrar nada existente) --------

alter table public.mission_templates
  add column if not exists emblema text check (emblema in ('identificar', 'contar', 'revisar'));

-- PASSO B — Preenche o seed já existente -------------------------------

update public.mission_templates set emblema = 'identificar'
where id = '00000000-0000-4000-a000-000000000111';
update public.mission_templates set emblema = 'contar'
where id = '00000000-0000-4000-a000-000000000112';
update public.mission_templates set emblema = 'revisar'
where id = '00000000-0000-4000-a000-000000000113';
update public.mission_templates set emblema = 'identificar'
where id = '00000000-0000-4000-a000-000000000121';
update public.mission_templates set emblema = 'contar'
where id = '00000000-0000-4000-a000-000000000122';
update public.mission_templates set emblema = 'revisar'
where id = '00000000-0000-4000-a000-000000000123';

-- PASSO C — Conferência --------------------------------------------------

select position, title, molde, emblema
from public.mission_templates
where trail_module_id in (
  '00000000-0000-4000-a000-000000000101',
  '00000000-0000-4000-a000-000000000102'
)
order by trail_module_id, position;
-- Esperado: 6 linhas, emblema nunca null (identificar/identificar/contar/
-- contar/revisar/revisar, na ordem de título — confira contra o padrão:
-- Identificar→identificar, Contar→contar, Revisão→revisar).
