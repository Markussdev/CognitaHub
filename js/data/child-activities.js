import { supabase } from '../lib/supabase.js'

// child_activities é a instância autorada pelo tutor (molde + tema + config +
// instrução) para uma criança específica — ver docs/supabase-fase-4b-corrente.sql.
// RLS (ca_tutor_insert) exige child_id (via is_tutor_of) e created_by = auth.uid()
// simultaneamente; quem chama createChildActivity precisa fornecer os dois.

export async function createChildActivity({
  childId,
  createdBy,
  cycleId = null,
  templateId = null,
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
      cycle_id: cycleId,
      template_id: templateId,
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

// child_trail_missions ( status ) vem junto pra quem lista poder distinguir
// atividade avulsa (child_trail_mission_id null, sempre executável) de
// atividade de missão de trilha — que só deve virar "Fazer com a criança"
// quando a missão estiver 'disponivel' (a criança não pode pular pra uma
// missão 2/3 só porque o tutor liberou o módulo em lote, ver
// docs/supabase-fase-7-liberar-modulo.sql).
export async function listChildActivities(childId) {
  return supabase
    .from('child_activities')
    .select('id, molde, tema, config, instrucao, titulo, status, created_at, child_trail_mission_id, child_trail_missions ( status )')
    .eq('child_id', childId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
}

// Edição de uma atividade já preparada — reusa o mesmo form de composição
// do tutor.js (troca só o botão de "Salvar atividade" pra "Salvar
// alterações" e chama isto em vez de createChildActivity). RLS (ca_tutor_update)
// já cobre: exige is_tutor_of(child_id), sem precisar de policy nova.
export async function updateChildActivity(id, { molde, tema, config, instrucao, titulo }) {
  return supabase
    .from('child_activities')
    .update({ molde, tema, config, instrucao, titulo: titulo || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, molde, tema, config, instrucao, titulo, status, created_at')
    .single()
}

// "Arquivar" — status já previa esse valor desde a Fase 4B
// (docs/supabase-fase-4b-corrente.sql: check (status in ('draft','ready','archived'))).
// listChildActivities já filtra archived; não precisa de coluna nova.
export async function archiveChildActivity(id) {
  return supabase
    .from('child_activities')
    .update({ status: 'archived' })
    .eq('id', id)
    .select('id')
    .single()
}

// Usado pelo Modo Criança ao abrir com ?activity=<id> — troca o
// getStubActivityContract() por esta linha real. child_id vem junto porque
// o casca precisa dele pra gravar o atividade_execucao no encerramento.
// child_trail_mission_id + status vêm junto pra modo-crianca.js poder
// recusar abrir uma missão que a trilha ainda não liberou pra criança,
// mesmo que o tutor (ou qualquer um) tente acessar direto pela URL —
// a lista de "Atividades preparadas" já esconde o link, mas isso sozinho
// não impede navegação direta.
export async function getChildActivityById(id) {
  return supabase
    .from('child_activities')
    .select('id, child_id, molde, tema, config, instrucao, titulo, status, created_at, child_trail_mission_id, child_trail_missions ( status )')
    .eq('id', id)
    .single()
}
