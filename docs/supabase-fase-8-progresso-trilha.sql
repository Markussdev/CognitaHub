-- ============================================================
-- Cognita Hub — Fase 8 (roadmap do Marcus: "Fase 4 — Progresso formal")
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: quando a criança termina uma missão no Modo Criança (o que já
-- grava uma linha em atividade_execucao, sem mudança nenhuma nesse
-- fluxo), a child_trail_mission correspondente avança sozinha:
--   'disponivel' -> 'concluida', próxima missão do módulo vira
--   'disponivel'; se era a última do módulo, o módulo vira
--   'aguardando_revisao' (decisão do tutor — avançar/repetir/adaptar/
--   pausar — é a Fase 5, ainda não escrita).
--
-- Por que gatilho e não RPC: js/data/atividade-execucao.js hoje insere
-- direto na tabela (RLS ae_tutor_insert/ae_guardian_insert já permitem),
-- sem passar por nenhuma função. Reescrever esse caminho pra virar RPC
-- não é escopo desta fase — nem toca em Modo Criança/moldes, igual as
-- fases anteriores. Um trigger AFTER INSERT reage a qualquer inserção,
-- venha do tutor ou do responsável, sem precisar mudar o JS agora.
--
-- Decisão de produto que tomei escrevendo isto, sinalizando em vez de
-- decidir calado: só 'crianca_concluiu' e 'adulto_encerrou' avançam a
-- trilha. 'pausa' não avança (a criança deve retomar a MESMA missão,
-- não pular pra próxima); 'recusa' também não avança. Se o critério for
-- outro, é só mudar a lista no Passo B.
--
-- Idempotência: o guard de avanço é `where status = 'disponivel'` — uma
-- segunda execução da mesma missão (repetição, ou uma 2ª child_activity
-- criada pra "adaptar" a mesma child_trail_mission) incrementa
-- attempts_count mas não readvança nada, porque a missão já não está
-- mais 'disponivel' na segunda vez.
--
-- Pré-requisito: docs/supabase-fase-7-liberar-modulo.sql já aplicado.
-- ============================================================

-- PASSO A — Verificação prévia --------------------------------------

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'release_child_module';
-- Precisa devolver 1 linha. Se vier vazio, rode a fase 7 antes.

select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'atividade_execucao';

-- PASSO B — Função + trigger: advance_child_trail_on_execucao ---------

create or replace function public.advance_child_trail_on_execucao()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mission_id   uuid;
  v_module_id    uuid;
  v_next_mission uuid;
begin
  -- só avança em desfechos que representam a criança ter passado pela
  -- missão até o fim; pausa/recusa não contam (ver nota de produto acima)
  if new.como_encerrou not in ('crianca_concluiu', 'adulto_encerrou') then
    return new;
  end if;

  select ca.child_trail_mission_id into v_mission_id
  from public.child_activities ca
  where ca.id = new.child_activity_id;

  if v_mission_id is null then
    return new; -- atividade avulsa, fora de qualquer trilha — nada a avançar
  end if;

  update public.child_trail_missions
  set attempts_count = attempts_count + 1
  where id = v_mission_id;

  update public.child_trail_missions
  set status = 'concluida', completed_at = now()
  where id = v_mission_id and status = 'disponivel';

  if not found then
    return new; -- já estava concluída antes (repetição/2ª execução) — não readvança
  end if;

  select child_trail_module_id into v_module_id
  from public.child_trail_missions
  where id = v_mission_id;

  select ctmi.id into v_next_mission
  from public.child_trail_missions ctmi
  join public.mission_templates mt on mt.id = ctmi.mission_template_id
  where ctmi.child_trail_module_id = v_module_id
    and ctmi.status = 'bloqueada'
  order by mt.position
  limit 1;

  if v_next_mission is not null then
    update public.child_trail_missions
    set status = 'disponivel', unlocked_at = now()
    where id = v_next_mission;
  else
    -- não havia próxima 'bloqueada': essa era a última do módulo
    update public.child_trail_modules
    set status = 'aguardando_revisao'
    where id = v_module_id and status = 'liberado';
  end if;

  return new;
end;
$$;

drop trigger if exists atividade_execucao_advance_trail on public.atividade_execucao;
create trigger atividade_execucao_advance_trail
  after insert on public.atividade_execucao
  for each row execute function public.advance_child_trail_on_execucao();

-- PASSO C — Teste manual -----------------------------------------------
-- Reusa o child_trail_module da fase 7 já liberado (3 child_activities,
-- 1ª missão 'disponivel'). Pegue o child_activity_id da 1ª missão
-- (retornado pelo release_child_module ou pela consulta D1 da fase 7) e
-- insira uma execução como se o Modo Criança tivesse gravado:
--
-- insert into public.atividade_execucao
--   (child_activity_id, child_id, executed_by, molde, tema, nivel_final,
--    precisou_mais_facil, tempo_aproximado_segundos, como_encerrou)
-- values
--   ('<child_activity_id_1a_missao>', '<child_id>', '<tutor_profile_id>',
--    'identificar', 'numeros', 1, false, 45, 'crianca_concluiu');

-- PASSO D — Conferência ------------------------------------------------

-- D1) A 1ª missão virou 'concluida' e a 2ª virou 'disponivel'?
select mt.position, mt.title, ctmi.status, ctmi.attempts_count, ctmi.completed_at
from public.child_trail_missions ctmi
join public.mission_templates mt on mt.id = ctmi.mission_template_id
where ctmi.child_trail_module_id = '<child_trail_module_id>'
order by mt.position;
-- Esperado: missão 1 'concluida' (attempts_count 1), missão 2
-- 'disponivel', missão 3 ainda 'bloqueada'.

-- D2) Repita o insert do Passo C pra MESMA child_activity (simulando a
-- criança repetindo a missão 1) — attempts_count deve subir pra 2, mas
-- o status/completed_at da missão 1 não deve mudar, e a missão 2
-- continua sendo a única 'disponivel' (não pula pra 3):
--
-- insert into public.atividade_execucao
--   (child_activity_id, child_id, executed_by, molde, tema, nivel_final,
--    precisou_mais_facil, tempo_aproximado_segundos, como_encerrou)
-- values
--   ('<child_activity_id_1a_missao>', '<child_id>', '<tutor_profile_id>',
--    'identificar', 'numeros', 1, false, 30, 'crianca_concluiu');

-- D3) Insira execução com como_encerrou = 'pausa' pra missão 2 e
-- confirme que ELA NÃO avança (continua 'disponivel', não 'concluida'):
--
-- insert into public.atividade_execucao
--   (child_activity_id, child_id, executed_by, molde, tema, nivel_final,
--    precisou_mais_facil, tempo_aproximado_segundos, como_encerrou)
-- values
--   ('<child_activity_id_2a_missao>', '<child_id>', '<tutor_profile_id>',
--    'contar', 'dinossauros', 1, false, 10, 'pausa');
-- select status from public.child_trail_missions where id = '<id_missao_2>';
-- -- esperado: ainda 'disponivel'

-- D4) Conclua a missão 2 de verdade e depois a missão 3 (a última do
-- módulo) — ao concluir a 3ª, o MÓDULO inteiro deve virar
-- 'aguardando_revisao' (não existe 4ª missão bloqueada pra liberar):
--
-- insert into public.atividade_execucao (...) values (..., 'crianca_concluiu'); -- missão 2
-- insert into public.atividade_execucao (...) values (..., 'crianca_concluiu'); -- missão 3
-- select status from public.child_trail_modules where id = '<child_trail_module_id>';
-- -- esperado: 'aguardando_revisao'

-- Não é esta etapa: a decisão do tutor em cima do 'aguardando_revisao'
-- (avançar pro próximo módulo / repetir missão / adaptar / pausar —
-- Fase 5 do roadmap), leitura pelo front-end (é só a partir daqui que
-- js/data/planos-registro.js e os pontos que leem PLANOS_REGISTRO direto
-- trocam pra ler das tabelas formais).
