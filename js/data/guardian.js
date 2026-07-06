import { supabase } from '../lib/supabase.js'
import { getFamilySessions } from './sessions.js'

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
      .select('id, name, email, phone, avatar_path, tutor_presentation, tutor_formation, tutor_availability')
      .in('id', tutorIds)

    if (profilesError) {
      return { data: null, error: profilesError }
    }

    profiles = tutorProfiles ?? []
  }

  // A família nunca lê a tabela sessions direto — só pela função
  // get_family_sessions (security definer), que devolve níveis 1+2 e
  // jamais a coluna notes (nível 3, nota interna do tutor). Ver
  // docs/supabase-fase-4c-registro-sessao.sql.
  const familySessionsResults = await Promise.all(
    childIds.map((childId) => getFamilySessions(childId))
  )

  const sessionsError = familySessionsResults.find((r) => r.error)?.error
  if (sessionsError) {
    return { data: null, error: sessionsError }
  }

  const sessions = familySessionsResults.flatMap((r) => r.data ?? [])

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
