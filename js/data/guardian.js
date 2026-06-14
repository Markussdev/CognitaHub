import { supabase } from '../lib/supabase.js'

const CHILDREN_SELECT = `
  id,
  name,
  birth_date,
  school_year,
  status,
  main_difficulties,
  sensory_notes,
  routine_notes,
  learning_profiles (
    preferred_formats,
    attention_span,
    math_difficulties,
    motivators,
    avoidances
  )
`

export async function getGuardianChildren(guardianId) {
  return getGuardianChildrenInSteps(guardianId)
}

async function getGuardianChildrenInSteps(guardianId) {
  const { data: children, error: childrenError } = await supabase
    .from('children')
    .select(CHILDREN_SELECT)
    .eq('guardian_id', guardianId)
    .order('created_at', { ascending: false })

  if (childrenError) {
    return { data: null, error: childrenError }
  }

  if (!children?.length) {
    return { data: [], error: null }
  }

  const childIds = children.map((child) => child.id)

  const { data: cycles, error: cyclesError } = await supabase
    .from('support_cycles')
    .select('id, child_id, status, start_date, end_date, main_goal, current_plan, tutor_id')
    .in('child_id', childIds)

  if (cyclesError) {
    return { data: null, error: cyclesError }
  }

  const tutorIds = [...new Set((cycles ?? []).map((cycle) => cycle.tutor_id).filter(Boolean))]
  let profiles = []

  if (tutorIds.length) {
    const { data: tutorProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, phone')
      .in('id', tutorIds)

    if (profilesError) {
      return { data: null, error: profilesError }
    }

    profiles = tutorProfiles ?? []
  }

  const cycleIds = [...new Set((cycles ?? []).map((cycle) => cycle.id).filter(Boolean))]
  let sessions = []

  if (cycleIds.length) {
    const { data: cycleSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, cycle_id, date, duration_minutes, activity_title, focus_area, notes, next_step, created_at')
      .in('cycle_id', cycleIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (sessionsError) {
      return { data: null, error: sessionsError }
    }

    sessions = cycleSessions ?? []
  }

  const sessionsByCycleId = new Map()
  sessions.forEach((sessionRow) => {
    const list = sessionsByCycleId.get(sessionRow.cycle_id) ?? []
    list.push(sessionRow)
    sessionsByCycleId.set(sessionRow.cycle_id, list)
  })

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const cyclesByChildId = new Map()

  ;(cycles ?? []).forEach((cycle) => {
    const enrichedCycle = {
      ...cycle,
      profiles: cycle.tutor_id ? profileById.get(cycle.tutor_id) ?? null : null,
      sessions: sessionsByCycleId.get(cycle.id) ?? [],
    }
    const list = cyclesByChildId.get(cycle.child_id) ?? []
    list.push(enrichedCycle)
    cyclesByChildId.set(cycle.child_id, list)
  })

  return {
    data: children.map((child) => ({
      ...child,
      support_cycles: cyclesByChildId.get(child.id) ?? [],
    })),
    error: null,
  }
}
