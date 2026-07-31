import { submitTutorApplication, submitGuardianRegistration } from '../data/signup.js'
import { recordLegalAcceptances } from '../data/legal-acceptances.js'

// Quando a confirmação de email está LIGADA no Supabase, o signUp não
// retorna sessão — e sem sessão o RLS bloqueia os inserts do cadastro
// (candidatura do tutor / criança do responsável). Para não perder esses
// dados, o formulário guarda o payload aqui e o login.js completa a
// gravação no primeiro acesso autenticado.

const KEY = 'cognita:pending-signup'

export function stashPendingSignup(kind, email, payload) {
  const nextPayload = { ...payload }
  if (kind === 'guardian' && !nextPayload.childId) {
    nextPayload.childId = crypto.randomUUID()
  }

  localStorage.setItem(KEY, JSON.stringify({ kind, email, payload: nextPayload }))
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

  let result
  if (pending.kind === 'tutor') {
    result = await submitTutorApplication(user.id, pending.payload)
  } else if (pending.kind === 'guardian') {
    result = await submitGuardianRegistration(user.id, pending.payload)
  } else {
    localStorage.removeItem(KEY)
    return { done: false }
  }

  if (result.error) {
    console.error(`Erro ao completar cadastro pendente (${result.step}):`, result.error)
    return { done: false, error: result.error }
  }

  // Só registra aceite quando a candidatura/cadastro realmente aconteceu
  // agora — se alreadyFinalized (já tinha sido aprovada/rejeitada antes),
  // não é o momento em que a pessoa aceitou nada, é só uma sobra de
  // pending-signup velha no localStorage. Em paralelo com `consents`
  // (legado, já gravado dentro de submitGuardianRegistration) — não
  // bloqueia a conclusão do cadastro se falhar.
  if (result.alreadyFinalized !== true && pending.payload?.legalDocumentKeys?.length) {
    const acceptance = await recordLegalAcceptances({
      userId: user.id,
      childId: pending.kind === 'guardian' ? pending.payload.childId : null,
      documentKeys: pending.payload.legalDocumentKeys,
      source: pending.kind === 'guardian' ? 'guardian_signup' : 'tutor_signup',
    })
    if (acceptance.error) {
      console.error('Erro ao registrar aceite de termos versionado:', acceptance.error)
    }
  }

  localStorage.removeItem(KEY)
  return { done: true, kind: pending.kind, alreadyFinalized: result.alreadyFinalized === true }
}
