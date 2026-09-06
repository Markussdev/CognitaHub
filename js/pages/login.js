import { supabase } from '../lib/supabase.js'
import { isBlockedStatus, signIn, redirectByRole, resendConfirmationEmail } from '../lib/auth.js'
import { completePendingSignup } from '../lib/pending-signup.js'
import { getTutorRegistrationState } from '../data/tutor-registration.js'

const form = document.querySelector('[data-login-form]')
const emailInput = document.querySelector('[data-login-email]')
const passwordInput = document.querySelector('[data-login-password]')
const errorBox = document.querySelector('[data-login-error]')
const resendBtn = document.querySelector('[data-resend-confirmation]')
const retryBtn = document.querySelector('[data-login-retry]')

let pendingConfirmEmail = null
let pendingRetry = null

function showLoginMessage(message, type = 'error', { resendEmail = null, retry = null } = {}) {
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
  pendingRetry = retry
  if (resendBtn) {
    resendBtn.hidden = !resendEmail
    resendBtn.disabled = false
    resendBtn.textContent = 'Reenviar e-mail de confirmação'
  }
  if (retryBtn) {
    retryBtn.hidden = !retry
    retryBtn.disabled = false
    retryBtn.textContent = 'Tentar novamente'
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
  pendingRetry = null
  if (resendBtn) resendBtn.hidden = true
  if (retryBtn) retryBtn.hidden = true
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

if (retryBtn) {
  retryBtn.addEventListener('click', async () => {
    if (!pendingRetry) return
    retryBtn.disabled = true
    retryBtn.textContent = 'Verificando…'
    await pendingRetry()
    retryBtn.disabled = false
    retryBtn.textContent = 'Tentar novamente'
  })
}

// Sessão barrada por e-mail não confirmado (ver requireRole em auth.js) —
// não sabemos o e-mail aqui (o redirect não carrega isso de propósito),
// então só orienta a entrar de novo, onde o fluxo normal de reenvio aparece.
if (new URLSearchParams(location.search).get('confirmar') === '1') {
  showLoginMessage('Confirme seu e-mail para continuar. Entre novamente para receber a opção de reenviar a confirmação.', 'warn')
}

// Link de confirmação expirado/já usado: o Supabase redireciona pra cá
// (emailRedirectTo) com o erro nos parâmetros da URL em vez de criar
// sessão — sem tratar isso, a pessoa só via a tela de login normal, sem
// entender por que clicou no link e "não aconteceu nada". O formato varia
// (hash no fluxo implícito, query no PKCE), então checa os dois.
function readAuthUrlError() {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(location.search)
  const errorCode = hashParams.get('error_code') || searchParams.get('error_code')
  const error = hashParams.get('error') || searchParams.get('error')
  return error || errorCode ? { error, errorCode } : null
}

const authUrlError = readAuthUrlError()
if (authUrlError) {
  showLoginMessage(
    authUrlError.errorCode === 'otp_expired'
      ? 'Este link de confirmação expirou ou já foi usado. Entre com seu e-mail e senha abaixo — se ainda faltar confirmar, a opção de reenviar aparece aqui.'
      : 'Não foi possível confirmar por esse link. Entre com seu e-mail e senha para tentar de novo.',
    'warn'
  )
  // Limpa a URL pra não repetir a mensagem se a pessoa atualizar a página.
  history.replaceState(null, '', location.pathname)
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

async function routeAuthenticatedUser(user, profile) {
  const pendingResult = await completePendingSignup(user)
  if (pendingResult.error) {
    showLoginMessage(
      'Sua conta foi acessada, mas não foi possível concluir uma gravação pendente. Nenhum dado foi interpretado como ausente.',
      'error',
      { retry: () => routeAuthenticatedUser(user, profile) }
    )
    return
  }

  if (isBlockedStatus(profile.status)) {
    await supabase.auth.signOut()
    showLoginMessage(getStatusMessage(profile.status), 'warn')
    return
  }

  if (profile.role === 'tutor') {
    const registration = await getTutorRegistrationState(user.id)
    if (registration.error) {
      console.error(`Erro ao verificar cadastro do tutor (${registration.step}):`, registration.error)
      showLoginMessage(
        'Não foi possível consultar sua candidatura agora. Tente novamente; sua conta continua conectada.',
        'error',
        { retry: () => routeAuthenticatedUser(user, profile) }
      )
      return
    }

    window.location.href = registration.complete
      ? '/pages/tutor.html'
      : '/pages/candidatura-tutor.html'
    return
  }

  redirectByRole(profile.role)
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

  const profile = await getProfile(user.id)

  if (!profile) {
    await supabase.auth.signOut()
    return
  }

  await routeAuthenticatedUser(user, profile)
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

    await routeAuthenticatedUser(user, profile)
  })
}
