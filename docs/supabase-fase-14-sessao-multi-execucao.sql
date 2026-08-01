-- ============================================================
-- Cognita Hub — Fase 14: registrar UMA sessão a partir de N execuções
-- Rodar no SQL Editor. Sem blocos "do $$".
-- ============================================================
-- Problema 1 (semântica): a criança pode concluir várias atividades numa
-- mesma experiência, mas a UI amarrava 1 execução = 1 registro de sessão.
-- Obrigar três devolutivas pra uma sessão é inviável — uma devolutiva deve
-- poder cobrir várias execuções.
--
-- Problema 2 (bug real): NÃO existe policy nem grant de UPDATE em
-- atividade_execucao pro tutor (a Fase 4B deu só select/insert). Então o
-- vínculo client-side (linkExecucaoToSession → UPDATE ... SET session_id)
-- falha calado: a execução nunca recebe session_id e fica "pendente" pra
-- sempre. Confirme o diagnóstico:
--   select count(*) from pg_policies
--   where tablename = 'atividade_execucao' and cmd = 'UPDATE';   -- espera 0
--
-- Solução única pros dois: uma RPC security definer que, autorizando o
-- tutor da criança do ciclo, cria a sessão e liga TODAS as execuções
-- escolhidas ao mesmo session_id numa transação só. Se qualquer parte
-- falhar, tudo dá rollback — sem sessão órfã e sem "sucesso" falso. O
-- definer contorna a policy de UPDATE ausente sem afrouxar o RLS (mesmo
-- padrão das RPCs de trilha, docs/supabase-fase-5..9).
--
-- Pré-requisito: docs/supabase-fase-4b-corrente.sql aplicado.
-- ============================================================

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
  v_session_id uuid;
begin
  -- Criança do ciclo + autorização: só o tutor que a acompanha.
  -- (auth.uid() continua sendo o chamador mesmo em security definer.)
  select child_id into v_child_id
  from public.support_cycles
  where id = p_cycle_id;

  if v_child_id is null then
    raise exception 'Ciclo não encontrado';
  end if;

  if not public.is_tutor_of(v_child_id) then
    raise exception 'Sem permissão para registrar sessão desta criança';
  end if;

  -- Cria a sessão (mesmos campos do antigo createSessionRecord). A coluna
  -- única sessions.child_activity_id (legado, Fase 4B) fica null aqui: o
  -- vínculo real e plural é via atividade_execucao.session_id, que aceita
  -- N execuções apontando pra mesma sessão.
  insert into public.sessions (
    cycle_id, activity_id, date, duration_minutes,
    topic, activity_title, focus_area, family_summary, notes, next_step
  ) values (
    p_cycle_id, p_activity_id, p_date, p_duration_minutes,
    p_activity_title, p_activity_title, p_focus_area, p_family_summary, p_notes, p_next_step
  )
  returning id into v_session_id;

  -- Liga as execuções escolhidas — só as ainda pendentes E da criança certa
  -- (guarda contra ligar execução de outra criança por id forjado).
  if array_length(p_execucao_ids, 1) is not null then
    update public.atividade_execucao
    set session_id = v_session_id
    where id = any (p_execucao_ids)
      and session_id is null
      and child_id = v_child_id;
  end if;

  return v_session_id;
end;
$$;

grant execute on function public.create_session_with_execucoes(
  uuid, date, int, uuid, text, text, text, text, text, uuid[]
) to authenticated;

-- ============================================================
-- Conferência (opcional) — troque <cycle_id> por um ciclo ativo real e
-- <exec_id_1>/<exec_id_2> por execuções pendentes dessa criança:
--
-- select public.create_session_with_execucoes(
--   '<cycle_id>', current_date, 30, null,
--   '2 atividades: Contar até 10, Identificar números',
--   'contagem', 'Resumo para a família.', 'Nota interna.', 'Próximo passo.',
--   array['<exec_id_1>', '<exec_id_2>']::uuid[]
-- );
--
-- Depois: as duas execuções devem ter session_id preenchido e sumir de
-- "pendentes":
-- select id, session_id from public.atividade_execucao
-- where id in ('<exec_id_1>', '<exec_id_2>');
-- ============================================================
