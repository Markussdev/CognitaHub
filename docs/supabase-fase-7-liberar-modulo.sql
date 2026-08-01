-- ============================================================
-- Cognita Hub — Fase 7 (roadmap do Marcus: "Fase 3 — Liberação em lote")
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: o tutor libera um módulo já atribuído (fase 6) escolhendo só
-- as adaptações gerais (rodadas, nível) — a função gera TODAS as
-- child_activities do módulo numa tacada, na ordem certa, cada uma já
-- vinculada à sua child_trail_mission (o vínculo formal que substitui a
-- inferência). A primeira missão do módulo fica 'disponivel' pra criança;
-- as outras continuam 'bloqueada' mesmo já tendo child_activity pronta —
-- "preparada" e "liberada pra criança agora" são coisas diferentes.
--
-- Revisão (2ª versão): tema deixou de ser adaptável nesta fase — nenhum
-- molde tem tema 'espaco'/outro registrado ainda (MOLDES_REGISTRO hoje só
-- tem 'dinossauros' pro contar e 'numeros' pro identificar, cada um com
-- assets próprios); aceitar tema livre geraria child_activity que o Modo
-- Criança não sabe renderizar. A função também: restringe as chaves
-- aceitas em config (só rodadas/nivel — quantidade/maiorNumero são
-- conteúdo pedagógico, vêm sempre do template), confere que o ciclo é
-- mesmo do tutor chamando (não só que ele tem alguma relação com a
-- criança), impede liberar um módulo fora de ordem, confere que o módulo
-- tem missões materializadas antes de marcar como liberado, e revoga
-- EXECUTE de public/anon (Postgres dá EXECUTE a PUBLIC por padrão em
-- CREATE FUNCTION — diferente de tabela).
--
-- Revisão (3ª versão, aplicada por Marcus direto no Supabase): endurece
-- ainda mais a allowlist — REJEITA a chamada inteira se vier qualquer
-- chave fora de rodadas/nivel (em vez de só ignorar em silêncio), valida
-- que rodadas/nivel são inteiro positivo de verdade (regex sobre o texto,
-- não só "existe a chave"), trava a linha do módulo já na leitura
-- (`for update of ctm`), guarda contra child_activities já existirem pro
-- módulo (estado inconsistente), checa auth.uid() não nulo antes de
-- qualquer outra coisa, e usa `search_path = pg_catalog, public` (mais
-- rígido que as demais funções do projeto — prática recomendada oficial
-- pra security definer, não aplicada retroativamente nas outras sem pedido).
--
-- Pré-requisito: docs/supabase-fase-6-atribuir-trilha.sql já aplicado e
-- testado (você já tem um child_trail_module real do Mateus pra usar
-- no teste do Passo C abaixo).
-- ============================================================

-- PASSO A — Verificação prévia --------------------------------------

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'assign_child_trail';
-- Precisa devolver 1 linha. Se vier vazio, rode a fase 6 antes.

-- PASSO B — Função release_child_module ------------------------------
-- Idempotência sem constraint nova: o guard é a própria condição do
-- UPDATE (`where status = 'bloqueado'`) — se 0 linhas forem afetadas,
-- FOUND vem falso e a função aborta. Dois cliques em "Liberar módulo"
-- não geram duas rodadas de child_activities.

create or replace function public.release_child_module(
  p_child_trail_module_id uuid,
  p_adaptations jsonb default '{}'::jsonb
)
returns table (
  child_activity_id uuid,
  mission_title text,
  mission_position int
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_child_id        uuid;
  v_cycle_id        uuid;
  v_trail_status    text;
  v_child_trail_id  uuid;
  v_this_position   int;
  v_adaptations     jsonb;
  v_config_override jsonb;
  v_first_mission   uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  v_adaptations := coalesce(p_adaptations, '{}'::jsonb);

  if jsonb_typeof(v_adaptations) <> 'object' then
    raise exception 'As adaptações precisam ser um objeto JSON.';
  end if;

  -- Nesta fase, somente rodadas e nível podem ser adaptados.
  -- Tema, quantidade, maiorNumero e outros campos continuam definidos
  -- pelo currículo oficial.
  if exists (
    select 1
    from jsonb_object_keys(v_adaptations) as adaptation_key
    where adaptation_key not in ('rodadas', 'nivel')
  ) then
    raise exception 'Adaptações inválidas. Use apenas "rodadas" e "nivel".';
  end if;

  if v_adaptations ? 'rodadas'
     and (
       jsonb_typeof(v_adaptations->'rodadas') <> 'number'
       or coalesce(v_adaptations->>'rodadas', '') !~ '^[1-9][0-9]*$'
     )
  then
    raise exception '"rodadas" precisa ser um número inteiro maior que zero.';
  end if;

  if v_adaptations ? 'nivel'
     and (
       jsonb_typeof(v_adaptations->'nivel') <> 'number'
       or coalesce(v_adaptations->>'nivel', '') !~ '^[1-9][0-9]*$'
     )
  then
    raise exception '"nivel" precisa ser um número inteiro maior que zero.';
  end if;

  -- Carrega e bloqueia o módulo durante a operação.
  select
    ct.child_id,
    ct.cycle_id,
    ct.status,
    ct.id,
    tm.position
  into
    v_child_id,
    v_cycle_id,
    v_trail_status,
    v_child_trail_id,
    v_this_position
  from public.child_trail_modules ctm
  join public.child_trails ct
    on ct.id = ctm.child_trail_id
  join public.trail_modules tm
    on tm.id = ctm.trail_module_id
  where ctm.id = p_child_trail_module_id
  for update of ctm;

  if not found then
    raise exception 'Módulo não encontrado.';
  end if;

  if not public.is_tutor_of(v_child_id) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  -- is_tutor_of confere só "existe alguma relação"; aqui confere que É
  -- o ciclo exato desta trilha, com este tutor — cobre o caso de um
  -- tutor antigo ainda ter um support_cycle velho com a mesma criança.
  if not exists (
    select 1
    from public.support_cycles sc
    where sc.id = v_cycle_id
      and sc.child_id = v_child_id
      and sc.tutor_id = auth.uid()
  ) then
    raise exception 'Este ciclo não pertence ao tutor e à criança informados.';
  end if;

  if v_trail_status <> 'ativa' then
    raise exception 'A trilha desta criança não está ativa.';
  end if;

  -- sequência: nenhum módulo materializado com posição menor pode estar
  -- diferente de 'concluido'. Módulos anteriores ao ponto de partida da
  -- criança nunca existem como linha, então não entram nesta checagem —
  -- a regra vale igual pra quem começou no módulo 1 ou direto no 2.
  if exists (
    select 1
    from public.child_trail_modules previous_ctm
    join public.trail_modules previous_tm
      on previous_tm.id = previous_ctm.trail_module_id
    where previous_ctm.child_trail_id = v_child_trail_id
      and previous_tm.position < v_this_position
      and previous_ctm.status <> 'concluido'
  ) then
    raise exception 'Conclua os módulos anteriores antes de liberar este módulo.';
  end if;

  if not exists (
    select 1
    from public.child_trail_missions ctmi
    where ctmi.child_trail_module_id = p_child_trail_module_id
  ) then
    raise exception 'Este módulo não possui missões.';
  end if;

  -- Proteção adicional contra atividades duplicadas em dados inconsistentes.
  if exists (
    select 1
    from public.child_activities ca
    join public.child_trail_missions ctmi
      on ctmi.id = ca.child_trail_mission_id
    where ctmi.child_trail_module_id = p_child_trail_module_id
  ) then
    raise exception 'Este módulo já possui atividades preparadas.';
  end if;

  v_config_override := jsonb_strip_nulls(
    jsonb_build_object(
      'rodadas', v_adaptations->'rodadas',
      'nivel', v_adaptations->'nivel'
    )
  );

  -- O UPDATE funciona como trava de idempotência.
  update public.child_trail_modules
  set
    status = 'liberado',
    adaptation_config = v_config_override,
    released_at = now()
  where id = p_child_trail_module_id
    and status = 'bloqueado';

  if not found then
    raise exception 'Este módulo já foi liberado ou não está bloqueado.';
  end if;

  -- Cria todas as atividades do módulo em lote.
  insert into public.child_activities (
    child_id,
    created_by,
    cycle_id,
    molde,
    tema,
    config,
    instrucao,
    titulo,
    status,
    child_trail_mission_id
  )
  select
    v_child_id,
    auth.uid(),
    v_cycle_id,
    mt.molde,
    mt.default_tema,
    mt.default_config || v_config_override,
    mt.default_instrucao,
    mt.title,
    'ready',
    ctmi.id
  from public.child_trail_missions ctmi
  join public.mission_templates mt
    on mt.id = ctmi.mission_template_id
  where ctmi.child_trail_module_id = p_child_trail_module_id
  order by mt.position;

  -- Localiza a primeira missão.
  select ctmi.id
  into v_first_mission
  from public.child_trail_missions ctmi
  join public.mission_templates mt
    on mt.id = ctmi.mission_template_id
  where ctmi.child_trail_module_id = p_child_trail_module_id
  order by mt.position
  limit 1;

  if v_first_mission is null then
    raise exception 'Não foi possível localizar a primeira missão do módulo.';
  end if;

  -- Somente a primeira missão fica disponível imediatamente.
  update public.child_trail_missions
  set
    status = 'disponivel',
    unlocked_at = now()
  where id = v_first_mission
    and status = 'bloqueada';

  if not found then
    raise exception 'A primeira missão não está bloqueada.';
  end if;

  return query
    select
      ca.id::uuid,
      mt.title::text,
      mt.position::int
    from public.child_activities ca
    join public.child_trail_missions ctmi
      on ctmi.id = ca.child_trail_mission_id
    join public.mission_templates mt
      on mt.id = ctmi.mission_template_id
    where ctmi.child_trail_module_id = p_child_trail_module_id
    order by mt.position;
end;
$$;

revoke all privileges
on function public.release_child_module(uuid, jsonb)
from public;

revoke all privileges
on function public.release_child_module(uuid, jsonb)
from anon;

grant execute
on function public.release_child_module(uuid, jsonb)
to authenticated;

-- PASSO C — Teste manual (usuário TUTOR logado, não admin) ------------
-- Pegue o id de um child_trail_module 'bloqueado' do Mateus (do teste da
-- fase 6 — Passo D1 daquele arquivo mostra os ids). Só rodadas/nivel são
-- aceitos agora:
--
-- select * from public.release_child_module(
--   '<child_trail_module_id>',
--   '{"rodadas": 2}'::jsonb
-- );
--
-- Esperado: 3 linhas devolvidas (as 3 missões do módulo), cada uma com
-- o child_activity_id novo.

-- PASSO D — Conferência ------------------------------------------------

-- D1) As child_activities nasceram vinculadas de verdade, com tema do
-- template (não sobrescrito) e rodadas adaptado?
select ca.titulo, ca.molde, ca.tema, ca.config, ctmi.status as missao_status
from public.child_activities ca
join public.child_trail_missions ctmi on ctmi.id = ca.child_trail_mission_id
where ctmi.child_trail_module_id = '<child_trail_module_id>'
order by ca.created_at;
-- tema deve ser 'numeros' ou 'dinossauros' conforme a missão (nunca
-- 'espaco'); rodadas deve estar 2; quantidade/maiorNumero continuam o
-- valor do seed mesmo se você tentar mandar outro no p_adaptations.

-- D2) Só a primeira missão (position 1) deve estar 'disponivel'; as
-- outras duas 'bloqueada' mesmo já tendo child_activity:
select mt.position, mt.title, ctmi.status
from public.child_trail_missions ctmi
join public.mission_templates mt on mt.id = ctmi.mission_template_id
where ctmi.child_trail_module_id = '<child_trail_module_id>'
order by mt.position;

-- D3) Chamar de novo pro mesmo módulo deve falhar com "Este módulo já
-- foi liberado":
--
-- select * from public.release_child_module('<child_trail_module_id>', '{}'::jsonb);

-- D4) Tentar liberar o Módulo 2 sem o Módulo 1 estar 'concluido' deve
-- falhar com "Conclua ou revise o módulo anterior antes de liberar
-- este." — pegue o id do child_trail_module do Módulo 2 (position 2) na
-- consulta D1 da fase 6 e tente:
--
-- select * from public.release_child_module('<child_trail_module_id_modulo_2>', '{}'::jsonb);

-- D5) Chave fora da allowlist agora FALHA a chamada inteira (versão 3 é
-- estrita, não silenciosa) — deve devolver erro 'Adaptações inválidas.
-- Use apenas "rodadas" e "nivel".', e nenhuma child_activity deve nascer:
--
-- select * from public.release_child_module(
--   '<outro_child_trail_module_id_bloqueado>',
--   '{"quantidade": 999, "maiorNumero": 999}'::jsonb
-- );
-- select status from public.child_trail_modules
-- where id = '<outro_child_trail_module_id_bloqueado>';
-- -- esperado: ainda 'bloqueado' (a função abortou antes do UPDATE)

-- D5b) rodadas/nivel com valor inválido também deve falhar, com mensagem
-- específica ('"rodadas" precisa ser um número inteiro maior que zero.'):
--
-- select * from public.release_child_module(
--   '<outro_child_trail_module_id_bloqueado>', '{"rodadas": 0}'::jsonb
-- );
-- select * from public.release_child_module(
--   '<outro_child_trail_module_id_bloqueado>', '{"rodadas": "abc"}'::jsonb
-- );
-- select * from public.release_child_module(
--   '<outro_child_trail_module_id_bloqueado>', '{"rodadas": 2.5}'::jsonb
-- );

-- D6) O módulo em si registrou a liberação (só com rodadas/nivel, nunca
-- as chaves fora da allowlist)?
select status, adaptation_config, released_at
from public.child_trail_modules
where id = '<child_trail_module_id>';

-- Não é esta etapa: avançar a missão disponível pra 'concluida' quando a
-- criança termina (Fase 4 do roadmap — provavelmente um gatilho ou RPC
-- disparado quando atividade_execucao é criada, que também decide se o
-- módulo inteiro vira 'aguardando_revisao'), decisão do tutor ao final do
-- módulo (avançar/repetir/adaptar/pausar), theme packs (tema adaptável de
-- verdade, quando existir mais de um tema por molde), leitura pelo
-- front-end.
