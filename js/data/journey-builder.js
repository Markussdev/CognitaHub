import { supabase } from '../lib/supabase.js'

// Autoria de jornada privada do tutor (Fase 15). A escrita no catálogo é
// SEMPRE via RPC security definer — nunca DML direto (o tutor não tem policy
// de insert/update em trail_templates/modules/mission_templates). O snapshot
// pedagógico é copiado no servidor a partir do source_child_activity_id.

export async function createPrivateJourney({ title, objective, childId }) {
  return supabase.rpc('create_private_journey', {
    p_title: title,
    p_objective: objective ?? null,
    p_child_id: childId,
  })
}

// modules: [{ title, objective?, visual_key, missions: [{ source_child_activity_id, title? }] }]
// Salva a jornada INTEIRA (título/objetivo + estrutura + cenário de cada
// módulo). Devolve o novo updated_at (usar como expectedUpdatedAt no
// próximo save). v2 registra visual_key por cima da validação pedagógica
// que save_journey_draft (v1) já fazia, na mesma transação.
export async function saveJourneyDraft({ templateId, title, objective, modules, expectedUpdatedAt }) {
  return supabase.rpc('save_journey_draft_v2', {
    p_template_id: templateId,
    p_title: title,
    p_objective: objective ?? null,
    p_modules: modules,
    p_expected_updated_at: expectedUpdatedAt,
  })
}

export async function publishJourney(templateId) {
  return supabase.rpc('publish_journey', { p_template_id: templateId })
}

// Jornadas privadas do tutor para uma criança (draft + published). RLS já
// garante que só o autor vê os drafts.
export async function listMyPrivateJourneys(childId) {
  return supabase
    .from('trail_templates')
    .select('id, title, description, status, updated_at, target_child_id')
    .eq('visibility', 'private')
    .eq('target_child_id', childId)
    .order('updated_at', { ascending: false })
}

// Estrutura completa de um template privado para edição — módulos + missões,
// com source_child_activity_id pra o builder saber qual atividade cada missão
// é. Ordena por position no cliente (embeds não garantem ordem).
export async function getPrivateJourneyStructure(templateId) {
  return supabase
    .from('trail_templates')
    .select(`
      id, title, description, status, updated_at, target_child_id,
      trail_modules (
        id, position, title, objective, visual_key,
        mission_templates ( id, position, title, molde, source_child_activity_id )
      )
    `)
    .eq('id', templateId)
    .single()
}
