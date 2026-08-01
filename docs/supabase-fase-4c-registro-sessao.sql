-- ============================================================
-- Cognita Hub — Fase 4C (A Corrente): Registro de Sessão em 3 níveis
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: fechar o elo execução → sessão → família.
--   Nível 1 · dado estruturado   — já vive em atividade_execucao (Fase 4B)
--   Nível 2 · resumo p/ família  — nova coluna sessions.family_summary
--   Nível 3 · nota interna       — sessions.notes (já existe), só tutor/admin
-- A família NUNCA deve poder ler sessions.notes. Como RLS é por linha (não
-- por coluna), a família passa a ler por uma função security definer
-- (get_family_sessions) que devolve só níveis 1+2 e jamais seleciona notes.
--
-- Pré-requisito: docs/supabase-fase-4b-corrente.sql já aplicado
-- (child_activities, atividade_execucao, sessions.child_activity_id).
-- ============================================================

-- PASSO C1 — Verificações (só leitura) ---------------------------
-- Confirma que a coluna-ponte já existe e que family_summary ainda não.

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'sessions'
  and column_name in ('notes', 'family_summary', 'child_activity_id', 'next_step');

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('is_guardian_of', 'is_tutor_of', 'is_admin');

-- PASSO C2 — Nível 2: resumo para a família -----------------------

alter table public.sessions
  add column if not exists family_summary text;

-- PASSO C3 — Função de leitura segura para a família --------------
-- Devolve níveis 1 (via atividade_execucao) + 2 (family_summary).
-- NUNCA seleciona sessions.notes (nível 3, só tutor/admin).

create or replace function public.get_family_sessions(p_child uuid)
returns table (
  id uuid,
  cycle_id uuid,
  date date,
  activity_title text,
  focus_area text,
  duration_minutes int,
  next_step text,
  family_summary text,
  molde text,
  tema text,
  nivel_final int,
  precisou_mais_facil boolean,
  tempo_aproximado_segundos int,
  como_encerrou text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.cycle_id, s.date, s.activity_title, s.focus_area,
         s.duration_minutes, s.next_step, s.family_summary,
         e.molde, e.tema, e.nivel_final, e.precisou_mais_facil,
         e.tempo_aproximado_segundos, e.como_encerrou
  from public.sessions s
  join public.support_cycles c on c.id = s.cycle_id
  left join public.atividade_execucao e on e.session_id = s.id
  where c.child_id = p_child
    and public.is_guardian_of(p_child)
  order by s.date desc, s.created_at desc
$$;

grant execute on function public.get_family_sessions(uuid) to authenticated;

-- PASSO C4 — AUDITORIA CRÍTICA (rodar e LER o resultado) ----------
-- A família só pode ler sessões pela função acima. Se aparecer QUALQUER
-- policy de select de responsável direto na tabela sessions, ela vaza o
-- nível 3 (notes) — tem que ser removida.

select policyname, cmd, qual from pg_policies
where schemaname = 'public' and tablename = 'sessions';

-- Se aparecer algo como sessions_guardian_select / responsavel_select
-- (qualquer policy de SELECT cuja condição use is_guardian_of ou aponte
-- pra guardian_id/children do responsável), rode (trocando <nome>):
--
--   drop policy if exists <nome> on public.sessions;
--
-- O select direto em sessions deve sobrar SÓ para tutor (via is_tutor_of
-- no ciclo) e admin. Confirme isso antes de considerar a etapa concluída.
