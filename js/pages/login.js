import { supabase } from '../lib/supabase.js'
import { isBlockedStatus, signIn, redirectByRole } from '../lib/auth.js'
import { completePendingSignup } from '../lib/pending-signup.js'

const form = document.querySelector('[data-login-form]')
const emailInput = document.querySelector('[data-login-email]')
const passwordInput = document.querySelector('[data-login-password]')
const errorBox = document.querySelector('[data-login-error]')

function showLoginMessage(message, type = 'error') {
  if (!errorBox) return

  errorBox.dataset.type = type
  const title = errorBox.querySelector('[data-login-error-title]')
  const detail = errorBox.querySelector('[data-login-error-detail]')

  if (title && detail) {
    title.textContent = type === 'warn' ? 'Acesso em analise' : 'Nao foi possivel entrar'
    detail.textContent = message
  } else {
    errorBox.textContent = message
  }

  errorBox.classList.add('is-visible')
}

function clearLoginMessage() {
  if (!errorBox) return

  errorBox.classList.remove('is-visible')
  const title = errorBox.querySelector('[data-login-error-title]')
  const detail = errorBox.querySelector('[data-login-error-detail]')

  if (title && detail) {
    title.textContent = ''
    detail.textContent = ''
  } else {
    errorBox.textContent = ''
  }
}

function getStatusMessage(status) {
  const messages = {
    waiting_review: 'Seu cadastro esta em analise pela equipe Cognita.',
    tutor_pending: 'Sua candidatura de tutor esta em analise pela equipe Cognita.',
    pending: 'Seu cadastro ainda esta em analise pela equipe Cognita.',
    rejected: 'Seu cadastro nao foi aprovado. Entre em contato com a equipe Cognita.',
    inactive: 'Seu acesso esta inativo. Entre em contato com a equipe Cognita.',
  }

  return messages[status] ?? 'Seu acesso ainda nao esta liberado.'
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, status, name')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Erro ao buscar perfil:', error)
    return null
  }

  return data
}

async function redirectExistingSession() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const pendingResult = await completePendingSignup(user)

  if (pendingResult.error) {
    await supabase.auth.signOut()
    showLoginMessage(
      'Sua conta foi acessada, mas nao foi possivel concluir o cadastro. Tente novamente ou fale com a equipe Cognita.'
    )
    return
  }

  const profile = await getProfile(user.id)

  if (!profile) {
    await supabase.auth.signOut()
    return
  }

  if (isBlockedStatus(profile.status)) {
    await supabase.auth.signOut()
    showLoginMessage(getStatusMessage(profile.status), 'warn')
    return
  }

  redirectByRole(profile.role)
}

await redirectExistingSession()

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    clearLoginMessage()

    const email = emailInput.value.trim()
    const password = passwordInput.value

    const { user, profile, error } = await signIn(email, password)

    if (error || !profile) {
      showLoginMessage('E-mail ou senha incorretos. Tente novamente.')
      return
    }

    const pendingResult = await completePendingSignup(user)

    if (pendingResult.error) {
      await supabase.auth.signOut()
      showLoginMessage(
        'Sua conta foi acessada, mas nao foi possivel concluir o cadastro. Tente novamente ou fale com a equipe Cognita.'
      )
      return
    }

    if (isBlockedStatus(profile.status)) {
      await supabase.auth.signOut()
      showLoginMessage(getStatusMessage(profile.status), 'warn')
      return
    }

    redirectByRole(profile.role)
  })
}
