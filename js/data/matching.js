import { supabase } from '../lib/supabase.js'

export async function getChildrenWaitingMatch() {
  return supabase
    .from('children')
    .select(`
      id,
      name,
      birth_date,
      school_year,
      status,
      main_difficulties,
      learning_profiles (
        preferred_formats,
        attention_span,
        math_difficulties,
        motivators,
        avoidances
      )
    `)
    .eq('status', 'waiting_match')
    .order('created_at', { ascending: false })
}

export async function getAvailableTutors() {
  return supabase
    .from('profiles')
    .select(`
      id,
      name,
      email,
      phone,
      status,
      tutor_applications (
        status,
        formation,
        experience
      )
    `)
    .eq('role', 'tutor')
    .eq('status', 'active')
}

export async function createSupportCycle({ childId, tutorId, mainGoal, currentPlan }) {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + 6)

  const formatDate = (date) => date.toISOString().slice(0, 10)

  const { data: cycle, error: cycleError } = await supabase
    .from('support_cycles')
    .insert({
      child_id: childId,
      tutor_id: tutorId,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      status: 'active',
      main_goal: mainGoal || null,
      current_plan: currentPlan || null,
    })
    .select('id')
    .single()

  if (cycleError) {
    return { error: cycleError }
  }

  const { data: childUpdate, error: childError } = await supabase
    .from('children')
    .update({ status: 'active' })
    .eq('id', childId)
    .select('id')

  if (childError || !childUpdate?.length) {
    return {
      error: childError ?? new Error('Ciclo criado, mas a criança não foi atualizada.'),
      cycle,
    }
  }

  return { cycle }
}