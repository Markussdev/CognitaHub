-- ============================================================
-- Cognita Hub — Fase 14b: fechar a integração da sessão multi-execução
-- Rodar no SQL Editor. Sem blocos "do $$".
-- ============================================================
-- Depois que UMA sessão passou a poder ter N execuções (Fase 14), sobraram
-- arestas de integração. Esta fase fecha as cinco:
--
--   1. get_family_sessions duplicava: LEFT JOIN sessão→execução devolvia a
--      MESMA sessão N vezes → família via N cards iguais. Nova
--      get_family_sessions_v2 devolve UMA linha por sessão + array execucoes.
--   2/3. Escopo por ciclo: a RPC agora só liga execuções cuja atividade
--      pertence a ESTE ciclo (child_activities.cycle_id, preenchido em
--      autoria/release/reopen) — não só "da criança".
--   4. Sem ignorar em silêncio: se qualquer id pedido não for vinculado, a
--      RPC aborta tudo (rollback), em vez de pular a execução calada.
--   5. Autorização pelo ciclo EXATO: support_cycles.tutor_id = auth.uid()
--      (mesmo padrão de release_child_module), não só is_tutor_of(child).
--
-- Substitui a versão da RPC da Fase 14 (create or replace) — rode esta,
-- tendo rodado a Fase 14 antes ou não.
-- Pré-requisito: docs/supabase-fase-4b/4c e fase-14 (tabelas/colunas).
-- ============================================================

-- ── 1 · RPC endurecida: cria a sessão e liga N execuções, atômico ──────────

create or replace function public.create_session_with_execucoes(
  p_cycle_id         uuid,
  p_date             date,
  p_duration_minutes int,
  p_activity_id      uuid,
  p_activity_title   text,
  p_focus_area       text,
  p_family_summary   text,
  p_notes            text,
  p_next_step        text,
  p_execucao_ids     uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_child_id   uuid;
  v_tutor_id   uuid;
  v_session_id uuid;
  v_expected   int;
  v_linked     int;
begin
  -- Ponto 5 — autorização pelo ciclo exato (não só is_tutor_of da criança).
  select child_id, tutor_id into v_child_id, v_tutor_id
  from public.support_cycles
  where id = p_cycle_id;

  if v_child_id is null then
    raise exception 'Ciclo não encontrado';
  end if;

  if v_tutor_id is distinct from auth.uid() then
    raise exception 'Sem permissão para registrar sessão neste ciclo';
  end if;

  -- Cria a sessão (a coluna única sessions.child_activity_id fica null: o
  -- vínculo plural é via atividade_execucao.session_id).
  insert into public.sessions (
    cycle_id, activity_id, date, duration_minutes,
    topic, activity_title, focus_area, family_summary, notes, next_step
  ) values (
    p_cycle_id, p_activity_id, p_date, p_duration_minutes,
    p_activity_title, p_activity_title, p_focus_area, p_family_summary, p_notes, p_next_step
  )
  returning id into v_session_id;

  -- Quantas execuções DISTINTAS foram pedidas (robusto a id repetido).
  select count(distinct x)::int into v_expected
  from unnest(coalesce(p_execucao_ids, array[]::uuid[])) as x;

  if v_expected > 0 then
    -- Pontos 2/3 — liga só execuções (a) ainda pendentes, (b) da criança do
    -- ciclo E (c) cuja atividade pertence a ESTE ciclo (child_activities.cycle_id).
    update public.atividade_execucao ae
    set session_id = v_session_id
    from public.child_activities ca
    where ae.id = any (p_execucao_ids)
      and ae.session_id is null
      and ae.child_id = v_child_id
      and ca.id = ae.child_activity_id
      and ca.cycle_id = p_cycle_id;

    get diagnostics v_linked = row_count;

    -- Ponto 4 — nenhum id ignorado em silêncio: se não vinculou exatamente o
    -- que foi pedido, alguma execução não é deste ciclo/criança ou já fora
    -- registrada → aborta tudo (rollback), sem sessão órfã.
    if v_linked <> v_expected then
      raise exception
        'Execução inválida: pedidas %, vinculadas % (alguma não pertence a este ciclo/criança ou já foi registrada)',
        v_expected, v_linked;
    end if;
  end if;

  return v_session_id;
end;
$$;

grant execute on function public.create_session_with_execucoes(
  uuid, date, int, uuid, text, text, text, text, text, uuid[]
) to authenticated;

-- ── 1 · get_family_sessions_v2: uma linha por sessão + array execucoes ─────
-- Mesma garantia LGPD da v1: security definer, is_guardian_of, NUNCA notes.
-- Agrega as execuções da sessão num jsonb array (era N linhas na v1).

create or replace function public.get_family_sessions_v2(p_child uuid)
returns table (
  id uuid,
  cycle_id uuid,
  date date,
  activity_title text,
  focus_area text,
  duration_minutes int,
  next_step text,
  family_summary text,
  execucoes jsonb
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select s.id, s.cycle_id, s.date, s.activity_title, s.focus_area,
         s.duration_minutes, s.next_step, s.family_summary,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'molde', e.molde,
               'tema', e.tema,
               'nivel_final', e.nivel_final,
               'precisou_mais_facil', e.precisou_mais_facil,
               'tempo_aproximado_segundos', e.tempo_aproximado_segundos,
               'como_encerrou', e.como_encerrou
             ) order by e.created_at
           ) filter (where e.id is not null),
           '[]'::jsonb
         ) as execucoes
  from public.sessions s
  join public.support_cycles c on c.id = s.cycle_id
  left join public.atividade_execucao e on e.session_id = s.id
  where c.child_id = p_child
    and public.is_guardian_of(p_child)
  group by s.id, s.cycle_id, s.date, s.activity_title, s.focus_area,
           s.duration_minutes, s.next_step, s.family_summary, s.created_at
  order by s.date desc, s.created_at desc
$$;

grant execute on function public.get_family_sessions_v2(uuid) to authenticated;

-- ============================================================
-- Conferência (opcional):
-- 1) Uma sessão com 3 execuções deve devolver UMA linha, execucoes com 3
--    objetos:
--   select id, activity_title, jsonb_array_length(execucoes) as n
--   from public.get_family_sessions_v2('<child_id>');   -- rodar como o responsável
--
-- 2) A RPC deve RECUSAR (rollback) uma execução de outro ciclo:
--   select public.create_session_with_execucoes(
--     '<cycle_id>', current_date, null, null, 'teste', null, 'resumo', null, null,
--     array['<exec_de_outro_ciclo>']::uuid[]);   -- espera: exception "Execução inválida"
-- ============================================================
