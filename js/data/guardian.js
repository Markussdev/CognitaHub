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

const CHILDREN_WITH_CYCLES_SELECT = `
  ${CHILDREN_SELECT},
  support_cycles (
    id,
    status,
    start_date,
    end_date,
    main_goal,
    current_plan,
    tutor_id,
    profiles:tutor_id (
      id,
      name,
      email,
      phone
    )
  )
`

// Criancas do responsavel, com perfil pedagogico e ciclo de acompanhamento.
// Se o PostgREST nao resolver o embed do tutor, buscamos as relacoes em etapas.
export async function getGuardianChildren(guardianId) {
  const result = await supabase
    .from('children')
    .select(CHILDREN_WITH_CYCLES_SELECT)
    .eq('guardian_id', guardianId)
    .order('created_at', { ascending: false })

  if (result.error?.code === 'PGRST200') {
    return getGuardianChildrenFallback(guardianId)
  }

  if (!result.error && hasMissingTutorProfiles(result.data)) {
    return getGuardianChildrenFallback(guardianId)
  }

  return result
}

function hasMissingTutorProfiles(children) {
  return (children ?? []).some((child) => {
    const cycles = Array.isArray(child.support_cycles)
      ? child.support_cycles
      : child.support_cycles
        ? [child.support_cycles]
        : []

    return cycles.some((cycle) => cycle.tutor_id && !cycle.profiles)
  })
}

async function getGuardianChildrenFallback(guardianId) {
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

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const cyclesByChildId = new Map()

  ;(cycles ?? []).forEach((cycle) => {
    const enrichedCycle = {
      ...cycle,
      profiles: cycle.tutor_id ? profileById.get(cycle.tutor_id) ?? null : null,
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
