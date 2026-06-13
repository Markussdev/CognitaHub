import { supabase } from '../lib/supabase.js'

// Camada de gravação dos cadastros no Supabase.
// Usada em dois momentos: logo após o signUp (quando já existe sessão)
// ou no primeiro login (quando a confirmação de email está ligada e o
// cadastro ficou pendente — ver js/lib/pending-signup.js).

export async function submitTutorApplication(tutorId, application) {
  const payload = {
    tutor_id: tutorId,
    formation: application.formation,
    experience: application.experience,
    motivation: application.motivation,
    linkedin: application.linkedin,
    weekly_availability: application.weeklyAvailability ?? [],
    status: 'pending',
  }

  // Se a candidatura já existe (ex.: retry no primeiro login após
  // confirmação de email), não reinsere — evita o 409 por chave
  // duplicada que travava o fluxo em loop.
  const { data: existing, error: selectError } = await supabase
    .from('tutor_applications')
    .select('id, status')
    .eq('tutor_id', tutorId)
    .maybeSingle()

  if (selectError) {
    return { error: selectError, step: 'tutor_applications_select' }
  }

  if (existing) {
    // Candidatura pendente é o caso esperado do retry: nada a fazer.
    if (existing.status === 'pending') {
      return {}
    }

    // Já analisada (approved/rejected): não sobrescreve a decisão da equipe.
    return {
      error: new Error('Já existe uma candidatura finalizada para este tutor.'),
      step: 'tutor_applications_existing',
    }
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
  const childId = crypto.randomUUID()
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

  if (childError) return { error: childError, step: 'children' }

  const { error: profileError } = await supabase.from('learning_profiles').insert({
    child_id: childId,
    preferred_formats: profile.preferredFormats,
    attention_span: profile.attentionSpan,
    math_difficulties: profile.mathDifficulties,
    motivators: profile.motivators,
    avoidances: profile.avoidances,
  })

  if (profileError) return { error: profileError, step: 'learning_profiles' }

  const { error: consentError } = await supabase.from('consents').insert({
    guardian_id: guardianId,
    child_id: childId,
    data_use_accepted: consent.dataUseAccepted,
    contact_accepted: consent.contactAccepted,
    image_use_accepted: false,
    terms_version: consent.termsVersion,
    accepted_at: new Date().toISOString(),
  })

  if (consentError) return { error: consentError, step: 'consents' }

  return { childId }
}
