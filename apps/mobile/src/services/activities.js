import { supabase } from './supabase.js'

export async function getChildActivity(activityId) {
  const { data, error } = await supabase
    .from('child_activities')
    .select(`
      id,
      child_id,
      molde,
      tema,
      config,
      instrucao,
      titulo,
      child_trail_mission_id,
      child_trail_missions (status)
    `)
    .eq('id', activityId)
    .single()

  if (error) throw error

  const mission = Array.isArray(data.child_trail_missions)
    ? data.child_trail_missions[0]
    : data.child_trail_missions

  if (data.child_trail_mission_id && mission?.status !== 'disponivel') {
    throw new Error('MISSION_NOT_AVAILABLE')
  }

  return data
}
