import { supabase } from '../lib/supabase.js'

// requireRole('tutor') já devolve o profile que controla o acesso.
// Esta função é para dados frescos de exibição quando necessário.
export async function getTutorProfile(userId) {
  return await supabase
    .from('profiles')
    .select('id, name, email, status')
    .eq('id', userId)
    .single()
}

const CHILD_SELECT = `
  id, name, birth_date, school_year, status, main_difficulties,
  learning_profiles ( preferred_formats, attention_span, math_difficulties,
                      motivators, avoidances )
`

// Ciclos que o tutor acompanha, com a criança de cada um. Em duas queries
// (sem embed cross-table support_cycles→children) pelo mesmo motivo do
// guardian.js: o embed entre essas tabelas não é detectado pelo PostgREST
// aqui. O embed children→learning_profiles continua funcionando.
export async function getTutorCycles(tutorId) {
  const { data: cycles, error } = await supabase
    .from('support_cycles')
    .select('id, status, start_date, end_date, child_id, main_goal, current_plan')
    .eq('tutor_id', tutorId)
    .in('status', ['planned', 'active', 'paused', 'completed'])
    .order('created_at', { ascending: false })

  if (error) return { data: null, error }
  if (!cycles?.length) return { data: [], error: null }

  const childIds = [...new Set(cycles.map((cycle) => cycle.child_id).filter(Boolean))]

  const { data: children, error: childrenError } = await supabase
    .from('children')
    .select(CHILD_SELECT)
    .in('id', childIds)

  if (childrenError) return { data: null, error: childrenError }

  const childById = new Map((children ?? []).map((child) => [child.id, child]))

  return {
    data: cycles.map((cycle) => ({
      ...cycle,
      children: cycle.child_id ? childById.get(cycle.child_id) ?? null : null,
    })),
    error: null,
  }
}
