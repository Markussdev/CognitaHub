import { supabase } from '../lib/supabase.js'
import { isBlockedStatus, signIn, redirectByRole, resendConfirmationEmail } from '../lib/auth.js'
import { completePendingSignup } from '../lib/pending-signup.js'

const form = document.querySelector('[data-login-form]')
const emailInput = document.querySelector('[data-login-email]')
const passwordInput = document.querySelector('[data-login-password]')
const errorBox = document.querySelector('[data-login-error]')
const resendBtn = document.querySelector('[data-resend-confirmation]')

let pendingConfirmEmail = null

function showLoginMessage(message, type = 'error', { resendEmail = null } = {}) {
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

  pendingConfirmEmail = resendEmail
  if (resendBtn) {
    resendBtn.hidden = !resendEmail
    resendBtn.disabled = false
    resendBtn.textContent = 'Reenviar e-mail de confirmação'
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

  pendingConfirmEmail = null
  if (resendBtn) resendBtn.hidden = true
}

if (resendBtn) {
  resendBtn.addEventListener('click', async () => {
    if (!pendingConfirmEmail) return
    resendBtn.disabled = true
    resendBtn.textContent = 'Enviando…'
    const { error } = await resendConfirmationEmail(pendingConfirmEmail)
    resendBtn.textContent = error ? 'Não foi possível reenviar' : 'E-mail reenviado'
    if (!error) setTimeout(() => { resendBtn.disabled = false; resendBtn.textContent = 'Reenviar e-mail de confirmação' }, 4000)
    else resendBtn.disabled = false
  })
}

// Sessão barrada por e-mail não confirmado (ver requireRole em auth.js) —
// não sabemos o e-mail aqui (o redirect não carrega isso de propósito),
// então só orienta a entrar de novo, onde o fluxo normal de reenvio aparece.
if (new URLSearchParams(location.search).get('confirmar') === '1') {
  showLoginMessage('Confirme seu e-mail para continuar. Entre novamente para receber a opção de reenviar a confirmação.', 'warn')
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

  // Sessão anônima (dispositivo pareado da criança, Fase 13) não é "já
  // logado" no sentido que esta tela verifica — login.html é só pra
  // adulto com email/senha. Sem este corte, profile.role vem
  // 'child_device' (sem entrada em HOME_BY_ROLE), redirectByRole cai no
  // fallback... que é esta própria página — loop infinito de reload.
  if (user.is_anonymous) return

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

    const { user, profile, error, emailNotConfirmed } = await signIn(email, password)

    if (emailNotConfirmed) {
      showLoginMessage(
        'Confirme seu e-mail antes de entrar — enviamos um link de confirmação quando você se cadastrou.',
        'warn',
        { resendEmail: email }
      )
      return
    }

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
