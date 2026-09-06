import { submitGuardianRegistration } from '../data/signup.js'
import { recordLegalAcceptances } from '../data/legal-acceptances.js'

// Quando a confirmação de email está LIGADA no Supabase, o signUp não
// retorna sessão — e sem sessão o RLS bloqueia os inserts. Para não perder
// dados, guardamos os aceites da conta do tutor ou o cadastro do responsável
// e o login.js conclui essa gravação no primeiro acesso autenticado.

const KEY = 'cognita:pending-signup'
const TUTOR_APPLICATION_DRAFT_KEY = 'cognita:draft:candidatura-tutor'
const TUTOR_ACCOUNT_DOCUMENT_KEYS = ['privacy_policy', 'terms_of_use']

export function stashPendingSignup(kind, email, payload) {
  const nextPayload = { ...payload }
  if (kind === 'guardian' && !nextPayload.childId) {
    nextPayload.childId = crypto.randomUUID()
  }

  localStorage.setItem(KEY, JSON.stringify({ kind, email, payload: nextPayload }))
}

export function stashPendingTutorAccount(email) {
  localStorage.setItem(KEY, JSON.stringify({
    kind: 'tutor_account',
    email,
    payload: { legalDocumentKeys: TUTOR_ACCOUNT_DOCUMENT_KEYS },
  }))
}

function valueAfterPrefix(lines, prefix) {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? ''
}

function migrateLegacyTutorApplication(payload) {
  if (!payload) return

  const [formation = '', situation = ''] = String(payload.formation ?? '').split(' / ')
  const experienceLines = String(payload.experience ?? '').split('\n')
  const availability = Array.isArray(payload.weeklyAvailability) ? payload.weeklyAvailability : []
  const hourOptions = ['1 hora/semana', '2 horas/semana', '3+ horas/semana']
  const periodOptions = ['Manhã', 'Tarde', 'Noite', 'Fins de semana']

  localStorage.setItem(TUTOR_APPLICATION_DRAFT_KEY, JSON.stringify({
    fields: {
      'tt-nasc': payload.birthDate ?? '',
      'ap-form': formation,
      'ap-exp': valueAfterPrefix(experienceLines, 'Experiência com ensino:'),
      'ap-motiv': payload.motivation ?? '',
      'ap-li': payload.linkedin ?? '',
    },
    radios: {
      situacao: situation,
      exp_criancas: valueAfterPrefix(experienceLines, 'Experiência com crianças:'),
      exp_tea: valueAfterPrefix(experienceLines, 'Contato com TEA:'),
      participacao: valueAfterPrefix(experienceLines, 'Condição de participação:'),
      roteiro: valueAfterPrefix(experienceLines, 'Roteiro pronto:'),
    },
    checkboxes: {
      'tt-termos': payload.legalDocumentKeys?.includes('tutor_terms') ?? false,
      'tt-legais': TUTOR_ACCOUNT_DOCUMENT_KEYS.every((key) => payload.legalDocumentKeys?.includes(key)),
    },
    chips: {
      'ap-dispon': hourOptions.map((option, index) => availability.includes(option) ? index : -1).filter((index) => index >= 0),
      'ap-periodos': periodOptions.map((option, index) => availability.includes(option) ? index : -1).filter((index) => index >= 0),
    },
    step: 0,
  }))
}

export async function completePendingSignup(user) {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { done: false }

  let pending
  try {
    pending = JSON.parse(raw)
  } catch {
    localStorage.removeItem(KEY)
    return { done: false }
  }

  if (!pending?.email || pending.email !== user.email) return { done: false }

  // Tutor novo: no primeiro acesso autenticado grava apenas os aceites da
  // criação da conta. A candidatura sempre fica para candidatura-tutor.html.
  // O bloco `tutor` migra rascunhos deixados pela versão anterior do fluxo.
  if (pending.kind === 'tutor_account' || pending.kind === 'tutor') {
    if (pending.kind === 'tutor') migrateLegacyTutorApplication(pending.payload)

    const documentKeys = TUTOR_ACCOUNT_DOCUMENT_KEYS.filter((key) =>
      pending.payload?.legalDocumentKeys?.includes(key)
    )
    const acceptance = await recordLegalAcceptances({
      userId: user.id,
      childId: null,
      documentKeys,
      source: 'tutor_signup',
      audience: 'tutor',
    })
    if (acceptance.error) {
      console.error('Erro ao registrar aceite da criação da conta:', acceptance.error)
      return { done: false, error: acceptance.error }
    }

    localStorage.removeItem(KEY)
    return { done: true, kind: pending.kind, migrated: pending.kind === 'tutor' }
  }

  if (pending.kind !== 'guardian') {
    localStorage.removeItem(KEY)
    return { done: false }
  }

  const result = await submitGuardianRegistration(user.id, pending.payload)

  if (result.error) {
    console.error(`Erro ao completar cadastro pendente (${result.step}):`, result.error)
    return { done: false, error: result.error }
  }

  // Os aceites do responsável são retomados separadamente do cadastro.
  if (pending.payload?.legalDocumentKeys?.length) {
    const acceptance = await recordLegalAcceptances({
      userId: user.id,
      childId: pending.payload.childId,
      documentKeys: pending.payload.legalDocumentKeys,
      source: 'guardian_signup',
      audience: 'guardian',
    })

    if (acceptance.error) {
      console.error('Erro ao registrar aceite de termos versionado:', acceptance.error)
      // Não apaga o localStorage — tenta de novo no próximo login. O cadastro
      // acima é idempotente por child_id, então o retry não duplica nada.
      return { done: false, error: acceptance.error }
    }
  }

  localStorage.removeItem(KEY)
  return { done: true, kind: pending.kind }
}
