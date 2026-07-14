import { supabase } from '../lib/supabase.js'

// Currículo formal da trilha (Trilha → Módulo → Missão) — ver
// docs/supabase-fase-5-trilha-formal.sql em diante. Substitui
// PLANOS_REGISTRO (js/data/planos-registro.js), que fica só como
// histórico/seed até todos os pontos de leitura migrarem.

// ── Catálogo (conteúdo pedagógico, igual pra qualquer criança) ────────────

export async function listPublishedTrailTemplates() {
  return supabase
    .from('trail_templates')
    .select('id, slug, title, description, track_type, age_min, age_max')
    .eq('status', 'published')
    .order('title')
}

export async function getTrailTemplateWithModules(trailTemplateId) {
  return supabase
    .from('trail_modules')
    .select('id, position, title, objective, mission_templates ( id, position, title, molde, default_tema, default_config )')
    .eq('trail_template_id', trailTemplateId)
    .order('position')
}

// ── Instância (progresso real de uma criança) ──────────────────────────────

// A mais recente, não só a 'ativa' — senão uma trilha 'concluida' vira
// invisível pra UI (parece "nunca atribuída" de novo, escondendo que a
// criança acabou de terminar tudo). Quem chama decide o que fazer com
// cada status (ativa/concluida/pausada); null só quando não existe
// nenhuma linha ainda (nunca foi atribuída).
export async function getLatestChildTrail(childId) {
  return supabase
    .from('child_trails')
    .select('id, trail_template_id, template_version, starting_module_id, status, created_at, trail_templates ( title, description )')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export async function getChildTrailModules(childTrailId) {
  return supabase
    .from('child_trail_modules')
    .select('id, status, adaptation_config, released_at, completed_at, tutor_decision, trail_modules ( id, position, title, objective )')
    .eq('child_trail_id', childTrailId)
    .order('position', { foreignTable: 'trail_modules' })
}

export async function getChildTrailMissions(childTrailModuleId) {
  return supabase
    .from('child_trail_missions')
    .select('id, status, unlocked_at, completed_at, attempts_count, mission_templates ( id, position, title, molde, default_tema, default_config )')
    .eq('child_trail_module_id', childTrailModuleId)
    .order('position', { foreignTable: 'mission_templates' })
}

// ── Mutações (sempre via RPC — as tabelas de instância não aceitam
// insert/update direto, ver docs/supabase-fase-5-trilha-formal.sql Passo C) ──

export async function assignChildTrail({ childId, cycleId, trailTemplateId, startingModuleId }) {
  return supabase.rpc('assign_child_trail', {
    p_child_id: childId,
    p_cycle_id: cycleId,
    p_trail_template_id: trailTemplateId,
    p_starting_module_id: startingModuleId,
  })
}

// adaptations: só { rodadas, nivel } são aceitos (allowlist na RPC) —
// ver docs/supabase-fase-7-liberar-modulo.sql.
export async function releaseChildModule({ childTrailModuleId, adaptations = {} }) {
  return supabase.rpc('release_child_module', {
    p_child_trail_module_id: childTrailModuleId,
    p_adaptations: adaptations,
  })
}

// Devolve { completed_module_id, next_module_id, trail_completed } — ver
// docs/supabase-fase-9-avancar-modulo.sql.
export async function advanceChildTrailModule({ childTrailModuleId }) {
  return supabase.rpc('advance_child_trail_module', {
    p_child_trail_module_id: childTrailModuleId,
  })
}
