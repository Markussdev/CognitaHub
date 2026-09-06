import { supabase } from '../lib/supabase.js'

function mapAttentionSpan(value) {
  const map = {
    ate5: 'short',
    'ate-5': 'short',
    short: 'short',

    '5a10': 'medium',
    '5-10': 'medium',
    medium: 'medium',

    mais10: 'long',
    'mais-10': 'long',
    long: 'long',

    naosei: 'unknown',
    'nao-sei': 'unknown',
    unknown: 'unknown',
    '': 'unknown',
    null: 'unknown',
    undefined: 'unknown',
  }

  return map[value] ?? 'unknown'
}

// Camada de gravação dos cadastros no Supabase.
// A candidatura do tutor só é gravada na página autenticada de candidatura.

export async function submitTutorApplication(tutorId, application) {
  const payload = {
    tutor_id: tutorId,
    birth_date: application.birthDate || null,
    formation: application.formation,
    experience: application.experience,
    motivation: application.motivation,
    linkedin: application.linkedin,
    weekly_availability: application.weeklyAvailability ?? [],
    status: 'pending',
  }

  // Consulta e gravação são separadas para preservar decisões já tomadas.
  // A policy de UPDATE também restringe a edição às candidaturas pendentes.
  const { data: existing, error: selectError } = await supabase
    .from('tutor_applications')
    .select('id, status')
    .eq('tutor_id', tutorId)
    .maybeSingle()

  if (selectError) {
    return { error: selectError, step: 'tutor_applications_select' }
  }

  if (existing) {
    if (existing.status === 'pending') {
      const { tutor_id: _tutorId, status: _status, ...editableFields } = payload
      const { data, error } = await supabase
        .from('tutor_applications')
        .update(editableFields)
        .eq('id', existing.id)
        .eq('tutor_id', tutorId)
        .eq('status', 'pending')
        .select('id')

      if (error) return { error, step: 'tutor_applications_update' }
      if (!data?.length) {
        return {
          error: new Error('A candidatura pendente não pôde ser atualizada.'),
          step: 'tutor_applications_update',
        }
      }
      return { updated: true }
    }

    // Já analisada (approved/rejected): nunca sobrescreve a decisão da equipe.
    return { alreadyFinalized: true, step: 'tutor_applications_existing' }
  }

  const { error } = await supabase
    .from('tutor_applications')
    .insert(payload)

  if (error) return { error, step: 'tutor_applications_insert' }

  return {}
}

export async function submitGuardianRegistration(guardianId, registration) {
  // id gerado no cliente para encadear learning_profiles e consents
  // sem precisar de SELECT de retorno (independe de policy de leitura).
  const childId = registration.childId ?? crypto.randomUUID()
  const child = registration.child
  const profile = registration.learningProfile
  const consent = registration.consent

  const { error: childError } = await supabase.from('children').insert({
    id: childId,
    guardian_id: guardianId,
    name: child.name,
    birth_date: child.birthDate,
    school_year: child.schoolYear,
    has_formal_diagnosis: 'not_informed',
    main_difficulties: child.mainDifficulties,
    sensory_notes: child.sensoryNotes,
    routine_notes: child.routineNotes,
    status: 'waiting_review',
  })

  if (childError && childError.code !== '23505') return { error: childError, step: 'children' }

  const { error: profileError } = await supabase.from('learning_profiles').insert({
    child_id: childId,
    preferred_formats: profile.preferredFormats,
    attention_span: mapAttentionSpan(profile.attentionSpan),
    math_difficulties: profile.mathDifficulties,
    motivators: profile.motivators,
    avoidances: profile.avoidances,
  })

  if (profileError && profileError.code !== '23505') {
    return { error: profileError, step: 'learning_profiles' }
  }

  const { error: consentError } = await supabase.from('consents').insert({
    guardian_id: guardianId,
    child_id: childId,
    data_use_accepted: consent.dataUseAccepted,
    contact_accepted: consent.contactAccepted,
    image_use_accepted: false,
    terms_version: consent.termsVersion,
    accepted_at: new Date().toISOString(),
  })

  if (consentError && consentError.code !== '23505') {
    return { error: consentError, step: 'consents' }
  }

  return { childId }
}
