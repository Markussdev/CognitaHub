import { supabase } from '../lib/supabase.js'

// Update que falha alto quando o RLS filtra tudo: sem o .select(), o
// PostgREST devolve "sucesso" mesmo com zero linhas alteradas e o botão
// funcionaria sem mudar nada no banco.
async function updateOne(table, patch, column, value) {
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq(column, value)
    .select('id')

  if (error) return { error }

  if (!data?.length) {
    return {
      error: new Error(`Nenhuma linha alterada em ${table} — confira as policies de admin.`),
    }
  }

  return { data }
}

export function getPendingTutors() {
  return supabase
    .from('tutor_applications')
    .select(`
      id, tutor_id, formation, experience, motivation, linkedin,
      weekly_availability, status, created_at,
      profiles:tutor_id ( name, email, phone, status )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
}

export function getChildrenWaitingReview() {
  return supabase
    .from('children')
    .select(`
      id, guardian_id, name, birth_date, school_year, has_formal_diagnosis,
      main_difficulties, sensory_notes, routine_notes, status, created_at,
      profiles:guardian_id ( name, email, phone ),
      learning_profiles ( preferred_formats, attention_span, math_difficulties,
                          strengths, motivators, avoidances )
    `)
    .eq('status', 'waiting_review')
    .order('created_at', { ascending: false })
}

// Candidatura primeiro, profile depois: se o profile falhar no meio,
// o tutor NÃO ganha acesso com candidatura pendente. O rollback devolve
// a candidatura à fila para o admin tentar de novo.
export async function approveTutor(tutorId, adminId) {
  const reviewed = { reviewed_by: adminId, reviewed_at: new Date().toISOString() }

  const application = await updateOne(
    'tutor_applications',
    { status: 'approved', ...reviewed },
    'tutor_id',
    tutorId
  )
  if (application.error) return application

  const profile = await updateOne('profiles', { status: 'active' }, 'id', tutorId)

  if (profile.error) {
    await updateOne(
      'tutor_applications',
      { status: 'pending', reviewed_by: null, reviewed_at: null },
      'tutor_id',
      tutorId
    )
    return profile
  }

  return profile
}

export async function rejectTutor(tutorId, adminId) {
  const reviewed = { reviewed_by: adminId, reviewed_at: new Date().toISOString() }

  const application = await updateOne(
    'tutor_applications',
    { status: 'rejected', ...reviewed },
    'tutor_id',
    tutorId
  )
  if (application.error) return application

  const profile = await updateOne('profiles', { status: 'rejected' }, 'id', tutorId)

  if (profile.error) {
    await updateOne(
      'tutor_applications',
      { status: 'pending', reviewed_by: null, reviewed_at: null },
      'tutor_id',
      tutorId
    )
    return profile
  }

  return profile
}

export function approveChild(childId) {
  return updateOne('children', { status: 'waiting_match' }, 'id', childId)
}

// "Pedir revisão" ≠ recusar: o cadastro volta pro responsável ajustar.
export function requestChildRevision(childId) {
  return updateOne('children', { status: 'revision_requested' }, 'id', childId)
}

// ── Visões completas pro admin (aba Pessoas / Ciclos) ────────────────────
// Duas etapas em vez de embed cross-table (support_cycles↔children/profiles)
// — o PostgREST não detecta esses embeds neste schema (mesmo motivo de
// guardian.js/tutor.js fazerem o merge no JS).

export async function getAllChildrenAdmin() {
  return supabase
    .from('children')
    .select(`
      id, guardian_id, name, birth_date, school_year, status, created_at,
      main_difficulties,
      profiles:guardian_id ( name, email, phone )
    `)
    .order('created_at', { ascending: false })
}

export async function getAllTutorsAdmin() {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, email, phone, status, created_at')
    .eq('role', 'tutor')
    .order('created_at', { ascending: false })

  if (profilesError) return { data: null, error: profilesError }
  if (!profiles?.length) return { data: [], error: null }

  const { data: applications, error: appsError } = await supabase
    .from('tutor_applications')
    .select('tutor_id, formation, experience, motivation, weekly_availability, status, created_at')
    .in('tutor_id', profiles.map((p) => p.id))

  if (appsError) return { data: null, error: appsError }

  const appByTutor = new Map((applications ?? []).map((a) => [a.tutor_id, a]))
  return {
    data: profiles.map((p) => ({ ...p, application: appByTutor.get(p.id) ?? null })),
    error: null,
  }
}

export async function getAllCyclesAdmin() {
  const { data: cycles, error: cyclesError } = await supabase
    .from('support_cycles')
    .select('id, child_id, tutor_id, status, start_date, end_date, main_goal, created_at')
    .order('created_at', { ascending: false })

  if (cyclesError) return { data: null, error: cyclesError }
  if (!cycles?.length) return { data: [], error: null }

  const childIds = [...new Set(cycles.map((c) => c.child_id).filter(Boolean))]
  const tutorIds = [...new Set(cycles.map((c) => c.tutor_id).filter(Boolean))]

  const [childrenRes, tutorsRes] = await Promise.all([
    childIds.length
      ? supabase.from('children').select('id, name, birth_date').in('id', childIds)
      : Promise.resolve({ data: [], error: null }),
    tutorIds.length
      ? supabase.from('profiles').select('id, name').in('id', tutorIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (childrenRes.error) return { data: null, error: childrenRes.error }
  if (tutorsRes.error) return { data: null, error: tutorsRes.error }

  const childById = new Map((childrenRes.data ?? []).map((c) => [c.id, c]))
  const tutorById = new Map((tutorsRes.data ?? []).map((t) => [t.id, t]))

  return {
    data: cycles.map((c) => ({
      ...c,
      child: childById.get(c.child_id) ?? null,
      tutor: tutorById.get(c.tutor_id) ?? null,
    })),
    error: null,
  }
}

// ── Gestão de ciclo (pausar/retomar/encerrar + trocar tutor) ─────────────
// Mantém children.status coerente com o ciclo — o painel da família deriva
// primeiro do ciclo, mas os pré-estados e filas do admin olham a criança.

export async function updateCycleStatus(cycleId, childId, cycleStatus, childStatus) {
  const cycle = await updateOne('support_cycles', { status: cycleStatus }, 'id', cycleId)
  if (cycle.error) return cycle
  if (childId && childStatus) {
    const child = await updateOne('children', { status: childStatus }, 'id', childId)
    if (child.error) {
      return {
        error: child.error,
        userMessage: 'Ciclo atualizado, mas o status da criança não acompanhou — confira em Pessoas.',
      }
    }
  }
  return cycle
}

export function swapCycleTutor(cycleId, tutorId) {
  return updateOne('support_cycles', { tutor_id: tutorId }, 'id', cycleId)
}

// ── Conteúdo: jornadas oficiais (catálogo trail_templates) ───────────────
// select('*') deliberado: a coluna `visibility` só existe depois da Fase 15
// — selecioná-la explicitamente quebraria num banco que ainda não a tem.
// O filtro "só oficiais" é client-side, tolerante à coluna ausente.

export async function listTrailTemplatesAdmin() {
  const { data, error } = await supabase
    .from('trail_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error }
  return {
    data: (data ?? []).filter((t) => (t.visibility ?? 'official') === 'official'),
    error: null,
  }
}

export function setTrailTemplateStatus(templateId, status) {
  return updateOne('trail_templates', { status }, 'id', templateId)
}

// Uso real de cada template (child_trails atribuídas) — o admin precisa
// disso ANTES de arquivar: o RLS de leitura do catálogo
// (can_read_trail_template, fase-15) só libera 'published' pra tutor/
// família/dispositivo, então arquivar um template com jornadas atribuídas
// apagaria módulos e missões da tela de todo mundo no meio do caminho.
export async function getTrailTemplateUsage() {
  const { data, error } = await supabase
    .from('child_trails')
    .select('trail_template_id, status')

  if (error) return { data: null, error }
  const usage = new Map()
  ;(data ?? []).forEach((row) => {
    usage.set(row.trail_template_id, (usage.get(row.trail_template_id) ?? 0) + 1)
  })
  return { data: usage, error: null }
}
