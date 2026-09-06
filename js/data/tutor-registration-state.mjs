export const REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS = [
  'privacy_policy',
  'terms_of_use',
  'tutor_terms',
]

const REQUIRED_APPLICATION_FIELDS = {
  birth_date: 'data de nascimento',
  formation: 'formação',
  experience: 'experiência',
  motivation: 'motivação',
  weekly_availability: 'disponibilidade',
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasAvailability(value) {
  return Array.isArray(value) && value.length >= 2
}

function missingApplicationFields(application) {
  if (!application) return Object.values(REQUIRED_APPLICATION_FIELDS)

  return Object.entries(REQUIRED_APPLICATION_FIELDS)
    .filter(([field]) => field === 'weekly_availability'
      ? !hasAvailability(application[field])
      : !hasText(application[field]))
    .map(([, label]) => label)
}

export function evaluateTutorRegistration(
  application,
  acceptedDocumentKeys = [],
  requiredDocumentKeys = REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS
) {
  const accepted = new Set(acceptedDocumentKeys)
  const missingFields = missingApplicationFields(application)
  const missingLegalDocumentKeys = requiredDocumentKeys.filter((key) => !accepted.has(key))
  const applicationComplete = Boolean(application) && missingFields.length === 0
  const acceptancesComplete = missingLegalDocumentKeys.length === 0
  const finalized = ['approved', 'rejected'].includes(application?.status)
  const complete = finalized || (applicationComplete && acceptancesComplete)

  let state = 'incomplete'
  if (!application) state = 'missing'
  else if (finalized) state = application.status
  else if (complete) state = 'pending'

  return {
    state,
    complete,
    canReview: application?.status === 'pending' && applicationComplete && acceptancesComplete,
    applicationComplete,
    acceptancesComplete,
    missingFields,
    missingLegalDocumentKeys,
  }
}
