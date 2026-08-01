-- ============================================================
-- Cognita Hub — Fase 11: repetir/adaptar uma missão concluída
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: na revisão de um módulo (aguardando_revisao), o tutor escolhe
-- UMA missão já concluída e reabre ela — igual (repetir) ou com
-- rodadas/nível diferentes (adaptar). Não mexe nas outras missões do
-- módulo, que continuam concluídas.
--
-- Decisão de dado (evita tabela/coluna nova): uma child_trail_mission pode
-- ter mais de uma child_activity ao longo do tempo agora. Em vez de um
-- vínculo formal de "versão atual", a atividade anterior vira 'archived'
-- e a nova nasce 'ready' — o app infantil e a aba Atividades preparadas já
-- filtram por status, então "qual é a atividade válida agora" continua
-- sendo uma pergunta de uma coluna só. atividade_execucao não muda: ela
-- aponta pra child_activity_id que já existia no momento em que rodou,
-- então o histórico de tentativas antigas continua íntegro mesmo depois
-- do archive.
--
-- Pré-requisito: docs/supabase-fase-8-progresso-trilha.sql (trigger de
-- progresso — não precisa mudar nada nele: reabrir a missão só bota o
-- módulo de volta em 'liberado', e a lógica já existente do trigger
-- ("achou 'bloqueada'? libera; senão módulo vira aguardando_revisao")
-- já lida com isso sozinha quando a missão repetida for concluída de novo).
-- ============================================================

-- PASSO A — Verificação prévia --------------------------------------

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'advance_child_trail_module';
-- Precisa devolver 1 linha. Se vier vazio, rode a fase 9 antes.

-- PASSO B — Função reopen_child_trail_mission --------------------------

create or replace function public.reopen_child_trail_mission(
  p_mission_id uuid,
  p_adaptations jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_child_id        uuid;
  v_cycle_id        uuid;
  v_trail_status    text;
  v_module_id       uuid;
  v_module_status   text;
  v_adaptations     jsonb;
  v_config_override jsonb;
  v_old_activity    public.child_activities%rowtype;
  v_new_activity_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  v_adaptations := coalesce(p_adaptations, '{}'::jsonb);
  if jsonb_typeof(v_adaptations) <> 'object' then
    raise exception 'As adaptações precisam ser um objeto JSON.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(v_adaptations) as k
    where k not in ('rodadas', 'nivel')
  ) then
    raise exception 'Adaptações inválidas. Use apenas "rodadas" e "nivel".';
  end if;
  if v_adaptations ? 'rodadas'
     and (jsonb_typeof(v_adaptations->'rodadas') <> 'number'
          or coalesce(v_adaptations->>'rodadas', '') !~ '^[1-9][0-9]*$')
  then
    raise exception '"rodadas" precisa ser um número inteiro maior que zero.';
  end if;
  if v_adaptations ? 'nivel'
     and (jsonb_typeof(v_adaptations->'nivel') <> 'number'
          or coalesce(v_adaptations->>'nivel', '') !~ '^[1-9][0-9]*$')
  then
    raise exception '"nivel" precisa ser um número inteiro maior que zero.';
  end if;

  select ct.child_id, ct.cycle_id, ct.status, ctm.id, ctm.status
    into v_child_id, v_cycle_id, v_trail_status, v_module_id, v_module_status
  from public.child_trail_missions ctmi
  join public.child_trail_modules ctm on ctm.id = ctmi.child_trail_module_id
  join public.child_trails ct on ct.id = ctm.child_trail_id
  where ctmi.id = p_mission_id
  for update of ctmi;

  if not found then
    raise exception 'Missão não encontrada.';
  end if;

  if not public.is_tutor_of(v_child_id) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  if not exists (
    select 1 from public.support_cycles sc
    where sc.id = v_cycle_id and sc.child_id = v_child_id and sc.tutor_id = auth.uid()
  ) then
    raise exception 'Esta missão não pertence ao seu ciclo com esta criança.';
  end if;

  if v_trail_status <> 'ativa' then
    raise exception 'A trilha desta criança não está ativa.';
  end if;

  -- só faz sentido reabrir missão de um módulo em revisão (todas as
  -- missões já concluídas) — não de um módulo ainda em andamento nem já
  -- fechado.
  if v_module_status <> 'aguardando_revisao' then
    raise exception 'Só é possível repetir/adaptar missões de um módulo aguardando revisão.';
  end if;

  -- guard atômico + idempotência: só reabre se estiver 'concluida'
  update public.child_trail_missions
  set status = 'disponivel', completed_at = null, unlocked_at = now()
  where id = p_mission_id and status = 'concluida';

  if not found then
    raise exception 'Esta missão não está concluída — nada pra repetir.';
  end if;

  v_config_override := jsonb_strip_nulls(jsonb_build_object(
    'rodadas', v_adaptations->'rodadas',
    'nivel', v_adaptations->'nivel'
  ));

  select * into v_old_activity
  from public.child_activities
  where child_trail_mission_id = p_mission_id and status = 'ready'
  order by created_at desc
  limit 1;

  if v_old_activity.id is null then
    raise exception 'Não encontrei a atividade atual desta missão.';
  end if;

  update public.child_activities
  set status = 'archived'
  where id = v_old_activity.id;

  insert into public.child_activities
    (child_id, created_by, cycle_id, molde, tema, config, instrucao, titulo, status, child_trail_mission_id)
  values
    (v_child_id, auth.uid(), v_cycle_id, v_old_activity.molde, v_old_activity.tema,
     v_old_activity.config || v_config_override, v_old_activity.instrucao, v_old_activity.titulo,
     'ready', p_mission_id)
  returning id into v_new_activity_id;

  -- volta o módulo pra 'liberado' — o trigger da fase 8 já sabe reconduzir
  -- pra 'aguardando_revisao' de novo quando essa missão for concluída
  -- (procura 'bloqueada' pra liberar, não acha nenhuma, fecha o módulo).
  update public.child_trail_modules
  set status = 'liberado'
  where id = v_module_id and status = 'aguardando_revisao';

  return v_new_activity_id;
end;
$$;

revoke all privileges on function public.reopen_child_trail_mission(uuid, jsonb) from public;
revoke all privileges on function public.reopen_child_trail_mission(uuid, jsonb) from anon;
grant execute on function public.reopen_child_trail_mission(uuid, jsonb) to authenticated;

-- PASSO C — Teste manual (usuário TUTOR logado) ------------------------
-- Pegue o id de uma child_trail_mission já 'concluida' num módulo
-- 'aguardando_revisao' (ex.: o Módulo 2 do Mateus, se você já concluiu
-- as 3 missões dele nos testes da fase 8/9):
--
-- select public.reopen_child_trail_mission('<mission_id>', '{"rodadas": 2}'::jsonb);

-- PASSO D — Conferência --------------------------------------------------

-- D1) A missão voltou pra 'disponivel', sem completed_at?
select status, completed_at, attempts_count from public.child_trail_missions
where id = '<mission_id>';

-- D2) O módulo voltou pra 'liberado'?
select status from public.child_trail_modules where id = '<child_trail_module_id>';

-- D3) A atividade antiga está 'archived', a nova 'ready', com o rodadas
-- novo e o resto copiado (molde/tema/instrucao iguais)?
select id, status, config, molde, tema, instrucao
from public.child_activities
where child_trail_mission_id = '<mission_id>'
order by created_at;

-- D4) Chamar de novo pra mesma missão (ainda 'disponivel', não
-- 'concluida') deve falhar com "Esta missão não está concluída":
--
-- select public.reopen_child_trail_mission('<mission_id>', '{}'::jsonb);

-- D5) Reabrir com o módulo não estando 'aguardando_revisao' (ex.: tente
-- numa missão de um módulo ainda 'liberado') deve falhar com "Só é
-- possível repetir/adaptar missões de um módulo aguardando revisão".

-- Não é esta etapa: repetir mais de uma missão de uma vez, "voltar pra
-- revisão" de um módulo anterior já concluído, histórico de versões além
-- do archived/ready, leitura pelo front-end (próximo passo).
