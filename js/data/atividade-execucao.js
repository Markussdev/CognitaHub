import { supabase } from '../lib/supabase.js'

// Grava o sinal de saída do Modo Criança (montarAtividadeExecucao() em
// js/pages/modo-crianca.js) — o Nível 1 (dado estruturado) do Registro de
// Sessão em 3 níveis. Ver docs/supabase-fase-4b-corrente.sql.
// RLS exige child_id (via is_tutor_of/is_guardian_of) e executed_by =
// auth.uid() simultaneamente.
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
