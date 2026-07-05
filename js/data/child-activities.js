import { supabase } from '../lib/supabase.js'

// child_activities é a instância autorada pelo tutor (molde + tema + config +
// instrução) para uma criança específica — ver docs/supabase-fase-4b-corrente.sql.
// RLS (ca_tutor_insert) exige child_id (via is_tutor_of) e created_by = auth.uid()
// simultaneamente; quem chama createChildActivity precisa fornecer os dois.

export async function createChildActivity({
  childId,
  createdBy,
  molde,
  tema,
  config,
  instrucao,
  titulo,
}) {
  return supabase
    .from('child_activities')
    .insert({
      child_id: childId,
      created_by: createdBy,
      molde,
      tema,
      config,
      instrucao,
      titulo: titulo || null,
      status: 'ready',
    })
    .select('id, molde, tema, config, instrucao, titulo, status, created_at')
    .single()
}

export async function listChildActivities(childId) {
  return supabase
    .from('child_activities')
    .select('id, molde, tema, config, instrucao, titulo, status, created_at')
    .eq('child_id', childId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
}

// Usado pelo Modo Criança ao abrir com ?activity=<id> — troca o
// getStubActivityContract() por esta linha real. child_id vem junto porque
// o casca precisa dele pra gravar o atividade_execucao no encerramento.
export async function getChildActivityById(id) {
  return supabase
    .from('child_activities')
    .select('id, child_id, molde, tema, config, instrucao, titulo, status, created_at')
    .eq('id', id)
    .single()
}
