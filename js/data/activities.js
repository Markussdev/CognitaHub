import { supabase } from '../lib/supabase.js'

const ACTIVITY_SELECT = `
  id,
  slug,
  title,
  summary_short,
  skill_id,
  age_min,
  age_max,
  formats,
  estimated_minutes,
  level,
  sensory_load,
  objective,
  before_start,
  steps,
  say,
  avoid,
  if_difficult,
  if_easy,
  success_signal,
  tea_note,
  status,
  skills ( id, label, sort_order )
`

export async function getActivities() {
  return supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('status', 'published')
    .order('skill_id')
}

export async function getActivityById(id) {
  return supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('id', id)
    .single()
}
