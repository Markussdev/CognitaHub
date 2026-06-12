import { submitTutorApplication, submitGuardianRegistration } from '../data/signup.js'

// Quando a confirmação de email está LIGADA no Supabase, o signUp não
// retorna sessão — e sem sessão o RLS bloqueia os inserts do cadastro
// (candidatura do tutor / criança do responsável). Para não perder esses
// dados, o formulário guarda o payload aqui e o login.js completa a
// gravação no primeiro acesso autenticado.

const KEY = 'cognita:pending-signup'

export function stashPendingSignup(kind, email, payload) {
  localStorage.setItem(KEY, JSON.stringify({ kind, email, payload }))
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

  localStorage.removeItem(KEY)
  return { done: true, kind: pending.kind }
}
