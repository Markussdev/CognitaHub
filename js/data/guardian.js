import { supabase } from '../lib/supabase.js'

// Crianças do responsável, com o perfil pedagógico embutido. A criança
// pode estar em vários status (waiting_review, revision_requested,
// waiting_match, matched, active...) — a página decide o que mostrar.
export async function getGuardianChildren(guardianId) {
  return await supabase
    .from('children')
    .select(`
      id, name, birth_date, school_year, status,
      main_difficulties, sensory_notes, routine_notes,
      learning_profiles ( preferred_formats, attention_span,
                          math_difficulties, motivators, avoidances )
    `)
    .eq('guardian_id', guardianId)
    .order('created_at', { ascending: false })
}
