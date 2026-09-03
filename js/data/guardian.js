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

// Consulta separada (não faz parte de CHILDREN_SELECT) porque preferred_name
// e avatar_key vêm da personalização feita no app da criança — uma feature
// mais nova, sem confirmação de estar aplicada em todo ambiente. Isolada
// assim, se as colunas não existirem em algum banco, só este card degrada
// (fallback pro nome/mascote determinístico), sem derrubar o painel inteiro.
export async function getChildAppIdentity(childId) {
  return supabase
    .from('children')
    .select('preferred_name, avatar_key')
    .eq('id', childId)
    .maybeSingle()
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

  // Perfil do tutor via RPC security definer
  // — não via .from('profiles').in('id', ...), que depende de RLS de
  // leitura em profiles pro responsável e não tinha confirmação de estar
  // aplicada no projeto real. A RPC escopa por auth.uid() como guardian
  // e devolve só o que o card do tutor usa (nem email/phone/disponibilidade).
  const { data: guardianTutorProfiles, error: tutorProfilesError } = await supabase
    .rpc('get_guardian_tutor_profiles')

  if (tutorProfilesError) {
    return { data: null, error: tutorProfilesError }
  }

  const tutorByCycleId = new Map(
    (guardianTutorProfiles ?? []).map((row) => [
      row.cycle_id,
      {
        id: row.tutor_id,
        name: row.tutor_name,
        avatar_path: row.avatar_path,
        tutor_presentation: row.tutor_presentation,
        tutor_formation: row.tutor_formation,
      },
    ])
  )

  // A família nunca lê a tabela sessions direto — só pela função
  // get_family_sessions (security definer), que devolve níveis 1+2 e
  // jamais a coluna notes (nível 3, nota interna do tutor).
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

  const cyclesByChildId = new Map()

  ;(cycles ?? []).forEach((cycle) => {
    const enrichedCycle = {
      ...cycle,
      profiles: tutorByCycleId.get(cycle.id) ?? null,
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
