import { supabase } from '../lib/supabase.js'

// A tabela sessions se ancora no cycle_id — criança e tutor são derivados
// via support_cycles quando preciso (não há colunas child_id/tutor_id aqui).
// A coluna da data é `date` (não session_date). Esta consulta é do tutor —
// ele vê os 3 níveis (family_summary e notes inclusos); a família NUNCA lê
// esta tabela direto, ela usa getFamilySessions() (RPC) abaixo.
export async function getCycleSessions(cycleId) {
  return supabase
    .from('sessions')
    .select(`
      id,
      cycle_id,
      date,
      duration_minutes,
      activity_id,
      activity_title,
      focus_area,
      family_summary,
      notes,
      next_step,
      child_activity_id,
      created_at
    `)
    .eq('cycle_id', cycleId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
}

export async function createSessionRecord({
  cycleId,
  activityId,
  childActivityId,
  sessionDate,
  durationMinutes,
  activityTitle,
  focusArea,
  familySummary,
  notes,
  nextStep,
}) {
  return supabase
    .from('sessions')
    .insert({
      cycle_id: cycleId,
      activity_id: activityId || null,
      child_activity_id: childActivityId || null,
      date: sessionDate,
      duration_minutes: durationMinutes || null,
      topic: activityTitle,
      activity_title: activityTitle,
      focus_area: focusArea || null,
      family_summary: familySummary || null,
      notes: notes || null,
      next_step: nextStep || null,
    })
    .select('id')
    .single()
}

// Fecha a ponte prevista em docs/supabase-fase-4b-corrente.sql (PASSO B1):
// liga a execução do Modo Criança à sessão que acabou de nascer dela.
export async function linkExecucaoToSession(execucaoId, sessionId) {
  return supabase
    .from('atividade_execucao')
    .update({ session_id: sessionId })
    .eq('id', execucaoId)
    .select('id')
    .single()
}

// Leitura da família — nunca a tabela sessions direto. get_family_sessions
// é security definer e devolve só níveis 1+2, nunca `notes` (nível 3).
// Ver docs/supabase-fase-4c-registro-sessao.sql.
export async function getFamilySessions(childId) {
  return supabase.rpc('get_family_sessions', { p_child: childId })
}
