import { supabase } from '../lib/supabase.js'

// A tabela sessions se ancora no cycle_id — criança e tutor são derivados
// via support_cycles quando preciso (não há colunas child_id/tutor_id aqui).
// A coluna da data é `date` (não session_date).
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
      notes,
      next_step,
      created_at
    `)
    .eq('cycle_id', cycleId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
}

export async function createSessionRecord({
  cycleId,
  activityId,
  sessionDate,
  durationMinutes,
  activityTitle,
  focusArea,
  notes,
  nextStep,
}) {
  return supabase
    .from('sessions')
    .insert({
      cycle_id: cycleId,
      activity_id: activityId || null,
      date: sessionDate,
      duration_minutes: durationMinutes || null,
      topic: activityTitle,
      activity_title: activityTitle,
      focus_area: focusArea || null,
      notes: notes || null,
      next_step: nextStep || null,
    })
    .select('id')
    .single()
}
