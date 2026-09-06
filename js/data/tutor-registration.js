import { supabase } from '../lib/supabase.js'
import {
  evaluateTutorRegistration,
  REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS,
} from './tutor-registration-state.mjs'

export { evaluateTutorRegistration, REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS }

async function getRequiredLegalDocuments() {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('id, document_key')
    .eq('audience', 'tutor')
    .eq('is_active', true)
    .in('document_key', REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS)

  if (error) return { error, step: 'legal_documents_query' }

  const missing = REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS.filter(
    (key) => !data?.some((document) => document.document_key === key)
  )
  if (missing.length) {
    return {
      error: new Error(`Documentos legais ativos não configurados: ${missing.join(', ')}`),
      step: 'legal_documents_configuration',
    }
  }

  return { data }
}

async function getAcceptedDocumentKeys(tutorIds, documents) {
  if (!tutorIds.length) return { data: new Map() }

  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('user_id, legal_document_id')
    .in('user_id', tutorIds)
    .in('legal_document_id', documents.map((document) => document.id))
    .is('child_id', null)
    .is('revoked_at', null)

  if (error) return { error, step: 'legal_acceptances_query' }

  const keyByDocumentId = new Map(documents.map((document) => [document.id, document.document_key]))
  const keysByTutorId = new Map(tutorIds.map((id) => [id, []]))
  ;(data ?? []).forEach((acceptance) => {
    const key = keyByDocumentId.get(acceptance.legal_document_id)
    if (key) keysByTutorId.get(acceptance.user_id)?.push(key)
  })

  return { data: keysByTutorId }
}

export async function evaluateTutorRegistrations(tutorIds, applicationsByTutorId) {
  const uniqueTutorIds = [...new Set((tutorIds ?? []).filter(Boolean))]
  if (!uniqueTutorIds.length) return { data: new Map() }

  const documentsResult = await getRequiredLegalDocuments()
  if (documentsResult.error) return documentsResult

  const acceptancesResult = await getAcceptedDocumentKeys(uniqueTutorIds, documentsResult.data)
  if (acceptancesResult.error) return acceptancesResult

  const states = new Map()
  uniqueTutorIds.forEach((tutorId) => {
    const application = applicationsByTutorId.get(tutorId) ?? null
    const acceptedLegalDocumentKeys = acceptancesResult.data.get(tutorId) ?? []
    states.set(tutorId, {
      ...evaluateTutorRegistration(application, acceptedLegalDocumentKeys),
      application,
      acceptedLegalDocumentKeys,
    })
  })

  return { data: states }
}

export async function getTutorRegistrationState(tutorId) {
  if (!tutorId) {
    return { error: new Error('Tutor não informado.'), step: 'tutor_id' }
  }

  const { data: application, error } = await supabase
    .from('tutor_applications')
    .select(`
      id, tutor_id, birth_date, formation, experience, motivation, linkedin,
      weekly_availability, status, reviewed_at, created_at
    `)
    .eq('tutor_id', tutorId)
    .maybeSingle()

  if (error) return { error, step: 'tutor_application_query' }

  const applications = new Map()
  if (application) applications.set(tutorId, application)
  const result = await evaluateTutorRegistrations([tutorId], applications)
  if (result.error) return result

  return result.data.get(tutorId)
}
