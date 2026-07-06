import { supabase } from '../lib/supabase.js'

// Grava o sinal de saída do Modo Criança (montarAtividadeExecucao() em
// js/pages/modo-crianca.js) — o Nível 1 (dado estruturado) do Registro de
// Sessão em 3 níveis. Ver docs/supabase-fase-4b-corrente.sql.
// RLS exige child_id (via is_tutor_of/is_guardian_of) e executed_by =
// auth.uid() simultaneamente.
// Execuções do Modo Criança que ainda não viraram Registro de Sessão
// (session_id nulo) — alimenta a lista "Usar esta execução" no Registrar
// sessão do tutor (js/pages/tutor.js), pra não digitar de novo o Nível 1.
export async function listPendingExecucoes(childId) {
  return supabase
    .from('atividade_execucao')
    .select('id, child_activity_id, molde, tema, nivel_final, precisou_mais_facil, tempo_aproximado_segundos, como_encerrou, created_at')
    .eq('child_id', childId)
    .is('session_id', null)
    .order('created_at', { ascending: false })
}

export async function createAtividadeExecucao({
  childActivityId,
  childId,
  executedBy,
  molde,
  tema,
  nivelFinal,
  precisouMaisFacil,
  tempoAproximadoSegundos,
  comoEncerrou,
}) {
  return supabase
    .from('atividade_execucao')
    .insert({
      child_activity_id: childActivityId,
      child_id: childId,
      executed_by: executedBy,
      molde,
      tema,
      nivel_final: nivelFinal,
      precisou_mais_facil: precisouMaisFacil,
      tempo_aproximado_segundos: tempoAproximadoSegundos,
      como_encerrou: comoEncerrou,
    })
    .select('id')
    .single()
}
