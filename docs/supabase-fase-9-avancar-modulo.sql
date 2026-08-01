-- ============================================================
-- Cognita Hub — Fase 9 (roadmap do Marcus: "Fase 5 — decisão do tutor",
-- só a opção "avançar" — as outras 4 ficam pra quando existir tela)
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: fechar o caminho feliz inteiro. Quando um módulo chega em
-- 'aguardando_revisao' (fase 8), o tutor confirma que está tudo certo e
-- avança — a função conclui o módulo atual e devolve o próximo, já
-- pronto pro JS decidir o que mostrar na tela.
--
-- Só 'avançar' vira RPC agora. As outras 4 opções da decisão do tutor
-- (repetir/adaptar/voltar_revisao/pausar) NÃO são a mesma operação com
-- um parâmetro diferente — repetir/adaptar precisam saber qual missão
-- o tutor está mirando e geram uma nova child_activity ligada à mesma
-- child_trail_mission; pausar é estado da trilha inteira, não do
-- módulo; voltar_revisao ainda nem tem semântica definida (reabre uma
-- missão? o módulo inteiro?). Construir uma RPC genérica tipo
-- decide_module(acao, ...) agora só ia juntar coisas diferentes e ser
-- refeita quando a UI existir — fica pra depois, com tela na mão.
--
-- Pré-requisito: docs/supabase-fase-8-progresso-trilha.sql já aplicado
-- e testado.
-- ============================================================

-- PASSO A — Verificação prévia --------------------------------------

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'advance_child_trail_on_execucao';
-- Precisa devolver 1 linha. Se vier vazio, rode a fase 8 antes.

-- PASSO B — Função advance_child_trail_module -------------------------

create or replace function public.advance_child_trail_module(
  p_child_trail_module_id uuid
)
returns table (
  completed_module_id uuid,
  next_module_id uuid,
  trail_completed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_child_id       uuid;
  v_cycle_id       uuid;
  v_trail_status   text;
  v_child_trail_id uuid;
  v_this_position  int;
  v_next_module_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  select ct.child_id, ct.cycle_id, ct.status, ct.id, tm.position
    into v_child_id, v_cycle_id, v_trail_status, v_child_trail_id, v_this_position
  from public.child_trail_modules ctm
  join public.child_trails ct on ct.id = ctm.child_trail_id
  join public.trail_modules tm on tm.id = ctm.trail_module_id
  where ctm.id = p_child_trail_module_id
  for update of ctm;

  if not found then
    raise exception 'Módulo não encontrado.';
  end if;

  if not public.is_tutor_of(v_child_id) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  if not exists (
    select 1 from public.support_cycles sc
    where sc.id = v_cycle_id and sc.child_id = v_child_id and sc.tutor_id = auth.uid()
  ) then
    raise exception 'Este módulo não pertence ao seu ciclo com esta criança.';
  end if;

  if v_trail_status <> 'ativa' then
    raise exception 'A trilha desta criança não está ativa.';
  end if;

  -- defesa extra: não confia só no status do módulo, confere de verdade
  -- que nenhuma missão ficou pra trás.
  if exists (
    select 1 from public.child_trail_missions
    where child_trail_module_id = p_child_trail_module_id
      and status <> 'concluida'
  ) then
    raise exception 'Nem todas as missões deste módulo estão concluídas.';
  end if;

  -- guard atômico + idempotência: só avança se estiver 'aguardando_revisao'.
  -- uma segunda chamada (duplo clique) falha aqui, mesmo padrão das RPCs
  -- anteriores — não é silenciosa.
  update public.child_trail_modules
  set status = 'concluido', tutor_decision = 'avancar', completed_at = now()
  where id = p_child_trail_module_id and status = 'aguardando_revisao';

  if not found then
    raise exception 'Este módulo não está aguardando revisão (já avançado, ou ainda não chegou lá).';
  end if;

  -- próximo módulo já existe como linha (fase 6 materializa todos de uma
  -- vez a partir do módulo inicial) — continua 'bloqueado', só devolvemos
  -- o id pro JS decidir a tela; liberar é uma chamada separada a
  -- release_child_module, com as adaptações que o tutor escolher lá.
  select ctm2.id into v_next_module_id
  from public.child_trail_modules ctm2
  join public.trail_modules tm2 on tm2.id = ctm2.trail_module_id
  where ctm2.child_trail_id = v_child_trail_id
    and tm2.position > v_this_position
  order by tm2.position
  limit 1;

  if v_next_module_id is null then
    update public.child_trails
    set status = 'concluida', updated_at = now()
    where id = v_child_trail_id;
  end if;

  return query
    select p_child_trail_module_id, v_next_module_id, (v_next_module_id is null);
end;
$$;

revoke all privileges on function public.advance_child_trail_module(uuid) from public;
revoke all privileges on function public.advance_child_trail_module(uuid) from anon;
grant execute on function public.advance_child_trail_module(uuid) to authenticated;

-- PASSO C — Teste manual -------------------------------------------
-- Pegue o child_trail_module do Módulo 1 do Mateus que você já levou até
-- 'aguardando_revisao' na fase 8 (D4 daquele arquivo):
--
-- select * from public.advance_child_trail_module('<child_trail_module_id_modulo_1>');
--
-- Esperado: 1 linha — completed_module_id = o mesmo id passado,
-- next_module_id = o id do child_trail_module do Módulo 2,
-- trail_completed = false.

-- PASSO D — Conferência ------------------------------------------------

-- D1) O módulo 1 virou 'concluido' de verdade?
select status, tutor_decision, completed_at
from public.child_trail_modules
where id = '<child_trail_module_id_modulo_1>';

-- D2) Chamar de novo pro mesmo módulo deve falhar ("não está aguardando
-- revisão"):
--
-- select * from public.advance_child_trail_module('<child_trail_module_id_modulo_1>');

-- D3) Guard de "nem todas as missões concluídas" — difícil simular sem
-- corromper dado de propósito; se quiser provar, escolha outro módulo já
-- liberado (fase 7) com pelo menos 1 missão ainda não concluída, force o
-- status dele pra 'aguardando_revisao' na mão (só pra teste) e chame a
-- função — deve falhar com essa mensagem antes de tocar em qualquer
-- linha:
--
-- update public.child_trail_modules set status = 'aguardando_revisao'
-- where id = '<outro_child_trail_module_com_missao_pendente>';
-- select * from public.advance_child_trail_module('<outro_child_trail_module_com_missao_pendente>');
-- -- depois desfaça o status manual se não for usar esse módulo de verdade

-- D4) Caminho completo até "trilha concluída" (opcional, mais longo):
-- libere o Módulo 2 (fase 7), conclua as 3 missões dele (fase 8, insert
-- em atividade_execucao pra cada uma) até ele virar 'aguardando_revisao',
-- e então:
--
-- select * from public.advance_child_trail_module('<child_trail_module_id_modulo_2>');
-- -- esperado: next_module_id = null, trail_completed = true
-- select status from public.child_trails where id = '<child_trail_id>';
-- -- esperado: 'concluida'

-- Não é esta etapa: repetir/adaptar/voltar_revisao/pausar (esperando
-- tela pra definir o formato certo), leitura pelo front-end.
