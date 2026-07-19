import { supabase } from './supabase.js'

export async function getChildTrail(childTrailId) {
  const { data, error } = await supabase
    .from('child_trails')
    .select(`
      id,
      status,
      trail_templates (title, description)
    `)
    .eq('id', childTrailId)
    .single()

  if (error) throw error
  return data
}

export async function getChildTrailModules(childTrailId) {
  const { data, error } = await supabase
    .from('child_trail_modules')
    .select(`
      id,
      status,
      trail_modules (id, position, title, objective)
    `)
    .eq('child_trail_id', childTrailId)

  if (error) throw error

  return (data ?? []).sort(
    (a, b) => a.trail_modules.position - b.trail_modules.position,
  )
}

export async function getModuleMissions(childTrailModuleId) {
  const { data, error } = await supabase
    .from('child_trail_missions')
    .select(`
      id,
      status,
      attempts_count,
      mission_templates (id, position, title, molde, emblema),
      child_activities (id)
    `)
    .eq('child_trail_module_id', childTrailModuleId)
    .eq('child_activities.status', 'ready')

  if (error) throw error

  return (data ?? []).sort(
    (a, b) => a.mission_templates.position - b.mission_templates.position,
  )
}
