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

// Ciclos que o tutor acompanha. Hoje retorna vazio (pareamento/ciclo
// ainda não existem) — o painel mostra o estado "sem crianças vinculadas".
export async function getTutorCycles(tutorId) {
  return await supabase
    .from('support_cycles')
    .select(`
      id, status, start_date, end_date, child_id,
      children:child_id ( name, birth_date, status )
    `)
    .eq('tutor_id', tutorId)
    .in('status', ['planned', 'active'])
    .order('created_at', { ascending: false })
}
