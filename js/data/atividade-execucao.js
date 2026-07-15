import { supabase } from '../lib/supabase.js'

// Grava o sinal de saída do Modo Criança (montarAtividadeExecucao() em
// js/pages/modo-crianca.js) — o Nível 1 (dado estruturado) do Registro de
// Sessão em 3 níveis. Ver docs/supabase-fase-4b-corrente.sql.
// RLS exige child_id (via is_tutor_of/is_guardian_of) e executed_by =
// auth.uid() simultaneamente.
// Execuções do Modo Criança que ainda não viraram Registro de Sessão
// (session_id nulo) — alimenta a lista "Usar esta execução" no Registrar
// sessão do tutor (js/pages/tutor.js), pra não digitar de novo o Nível 1.
// Embute child_activities (titulo, config) pelo FK child_activity_id — dá
// pro item pendente mostrar título e rodadas sem duplicar essa informação
// em atividade_execucao (que só guarda o snapshot de molde/tema/nível).
const EXECUCAO_SELECT = `
  id, child_activity_id, molde, tema, nivel_final, precisou_mais_facil,
  tempo_aproximado_segundos, como_encerrou, created_at, session_id,
  child_activities ( titulo, config )
`

export async function listPendingExecucoes(childId) {
  return supabase
    .from('atividade_execucao')
    .select(EXECUCAO_SELECT)
    .eq('child_id', childId)
    .is('session_id', null)
    .order('created_at', { ascending: false })
}

// Visão de leitura (sem ação) pra aba "Atividades preparadas" — mostra as
// últimas execuções do Modo Criança, pendentes ou já registradas, só pro
// tutor acompanhar o que a criança andou fazendo. "Usar esta execução"
// continua exclusiva da aba Sessões (é lá que o registro nasce de verdade).
export async function listRecentExecucoes(childId, limit = 5) {
  return supabase
    .from('atividade_execucao')
    .select(EXECUCAO_SELECT)
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(limit)
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
  // Sem .select() de propósito: o dispositivo pareado (Fase 13) só tem
  // policy de INSERT em atividade_execucao (ae_device_insert), não de
  // SELECT — ele não precisa ler execução de volta, só gravar. Encadear
  // .select() faria o INSERT...RETURNING ser filtrado por RLS de SELECT
  // que não existe pra esse papel, e o supabase-js reportaria erro mesmo
  // com o insert já commitado (falso negativo).
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
}
