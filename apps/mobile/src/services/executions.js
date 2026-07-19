import { supabase } from './supabase.js'

// Sem .select(): o dispositivo tem permissão para inserir, mas não para
// ler a execução devolvida.
export async function createActivityExecution({ activity, executedBy, durationSeconds }) {
  const { error } = await supabase.from('atividade_execucao').insert({
    child_activity_id: activity.id,
    child_id: activity.child_id,
    executed_by: executedBy,
    molde: activity.molde,
    tema: activity.tema,
    nivel_final: Number(activity.config?.nivel) || 1,
    precisou_mais_facil: false,
    tempo_aproximado_segundos: durationSeconds,
    como_encerrou: 'crianca_concluiu',
  })

  if (error) throw error
}
