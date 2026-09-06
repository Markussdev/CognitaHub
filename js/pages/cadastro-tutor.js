import { signUp, resendConfirmationEmail } from '../lib/auth.js'
import { recordLegalAcceptances } from '../data/legal-acceptances.js'
import { stashPendingTutorAccount } from '../lib/pending-signup.js'
import { loadDraft, applyDraft, clearDraft, wireDraftAutosave } from '../lib/form-draft.js'
import { phoneToE164 } from '../lib/phone.js'

const DRAFT_KEY = 'cognita:draft:cadastro-tutor'
const APPLICATION_DRAFT_KEY = 'cognita:draft:candidatura-tutor'
const ACCOUNT_LEGAL_DOCUMENTS = ['privacy_policy', 'terms_of_use']
const form = document.querySelector('[data-tutor-account-form]')
const panels = [...document.querySelectorAll('[data-step-panel]')]
const stepItems = [...document.querySelectorAll('[data-step-item]')]
const counter = document.querySelector('[data-step-counter]')
const announce = document.querySelector('[data-step-announce]')
const submitButton = document.querySelector('[data-submit-account]')
const formMessage = document.querySelector('[data-form-message]')
const legalError = document.querySelector('[data-legal-error]')
let signedUpEmail = ''

function migrateInterruptedApplicationDraft(draft) {
  if (!draft?.fields?.['tt-nasc'] && !draft?.fields?.['ap-form']) return
  if (localStorage.getItem(APPLICATION_DRAFT_KEY)) return

  const applicationFieldIds = ['tt-nasc', 'ap-form', 'ap-exp', 'ap-motiv', 'ap-li']
  localStorage.setItem(APPLICATION_DRAFT_KEY, JSON.stringify({
    fields: Object.fromEntries(
      applicationFieldIds
        .filter((id) => Object.hasOwn(draft.fields ?? {}, id))
        .map((id) => [id, draft.fields[id]])
    ),
    radios: draft.radios ?? {},
    checkboxes: {
      'tt-termos': draft.checkboxes?.['tt-termos'] ?? false,
      'tt-legais': draft.checkboxes?.['tt-legais'] ?? false,
    },
    chips: {
      'ap-dispon': draft.chips?.['ap-dispon'] ?? [],
      'ap-periodos': draft.chips?.['ap-periodos'] ?? [],
    },
    step: 0,
  }))
}

function showMessage(message) {
  formMessage.textContent = message
  formMessage.classList.add('is-visible')
}

function clearMessage() {
  formMessage.textContent = ''
  formMessage.classList.remove('is-visible')
}

function showStep(index) {
  panels.forEach((panel, panelIndex) => panel.classList.toggle('is-active', panelIndex === index))
  stepItems.forEach((item, itemIndex) => {
    item.classList.toggle('is-active', itemIndex === index)
    item.classList.toggle('is-done', itemIndex < index)
    item.querySelector('.stepper-dot').textContent = itemIndex < index ? '✓' : String(itemIndex + 1)
  })
  counter.textContent = `Etapa ${index + 1} de 2`
  announce.textContent = index === 0 ? 'Etapa 1 de 2: sua conta' : 'Etapa 2 de 2: confirmar e-mail'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function validateAccount() {
  let valid = true
  form.querySelectorAll('input[required]:not([type="checkbox"]), input[pattern]').forEach((input) => {
    const invalid = !input.checkValidity()
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false')
    if (invalid) valid = false
  })

  const password = document.getElementById('tt-senha')
  const confirmation = document.getElementById('tt-senha2')
  const passwordError = document.getElementById('err-senha2')
  const passwordsMatch = password.value === confirmation.value
  confirmation.setAttribute('aria-invalid', passwordsMatch ? 'false' : 'true')
  passwordError.classList.toggle('is-visible', !passwordsMatch)
  if (!passwordsMatch) valid = false

  const legal = document.getElementById('tt-legais')
  legalError.classList.toggle('is-visible', !legal.checked)
  if (!legal.checked) valid = false

  if (!valid) {
    const firstInvalid = form.querySelector('[aria-invalid="true"]') || (!legal.checked ? legal : null)
    firstInvalid?.focus()
  }
  return valid
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault()
  clearMessage()
  if (!validateAccount()) return

  let phone
  try {
    phone = phoneToE164(document.getElementById('tt-tel').value.trim())
  } catch {
    showMessage('Telefone inválido. Confira o DDD e o número completo, ou deixe em branco.')
    document.getElementById('tt-tel').focus()
    return
  }

  const account = {
    name: document.getElementById('tt-nome').value.trim(),
    email: document.getElementById('tt-email').value.trim(),
    phone,
    password: document.getElementById('tt-senha').value,
    role: 'tutor',
  }

  submitButton.disabled = true
  submitButton.textContent = 'Criando conta…'
  const signup = await signUp(account)

  if (signup.error) {
    console.error('Erro ao criar conta de tutor:', signup.error)
    showMessage('Não foi possível criar a conta agora. Verifique os dados e tente novamente.')
    submitButton.disabled = false
    submitButton.textContent = 'Criar conta'
    return
  }

  signedUpEmail = account.email

  if (signup.session) {
    const acceptance = await recordLegalAcceptances({
      userId: signup.user.id,
      childId: null,
      documentKeys: ACCOUNT_LEGAL_DOCUMENTS,
      source: 'tutor_signup',
      audience: 'tutor',
    })
    if (acceptance.error) {
      console.error('Erro ao registrar os aceites da conta:', acceptance.error)
      stashPendingTutorAccount(account.email)
    }
  } else {
    stashPendingTutorAccount(account.email)
  }

  clearDraft(DRAFT_KEY)
  submitButton.disabled = false
  submitButton.textContent = 'Criar conta'

  if (signup.session) {
    document.querySelector('[data-confirmation-copy]').textContent = 'Sua conta está pronta. Agora complete a candidatura usando sua sessão autenticada.'
    const nextLink = document.querySelector('[data-account-next]')
    nextLink.href = 'candidatura-tutor.html'
    nextLink.textContent = 'Completar candidatura'
    document.querySelector('[data-resend]').hidden = true
  }

  showStep(1)
})

document.querySelector('[data-resend]')?.addEventListener('click', async (event) => {
  if (!signedUpEmail) return
  const button = event.currentTarget
  button.disabled = true
  button.textContent = 'Enviando…'
  const { error } = await resendConfirmationEmail(signedUpEmail)
  button.textContent = error ? 'Não foi possível reenviar' : 'E-mail reenviado'
  button.disabled = false
})

document.querySelectorAll('[data-toggle-pw]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePw)
    const showing = input.type === 'text'
    input.type = showing ? 'password' : 'text'
    button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha')
  })
})

document.querySelector('[data-phone-mask]')?.addEventListener('input', (event) => {
  let value = event.currentTarget.value.replace(/\D/g, '').slice(0, 11)
  if (value.length > 10) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
  else if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`
  else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`
  else if (value.length) value = `(${value}`
  event.currentTarget.value = value
})

document.querySelector('[data-pw-strength]')?.addEventListener('input', (event) => {
  const value = event.currentTarget.value
  let score = 0
  if (value.length >= 6) score++
  if (value.length >= 8) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/[0-9!@#$%^&*]/.test(value)) score++
  const classes = ['', 's1', 's2', 's3', 's4']
  document.querySelectorAll('[data-strength-bars="tt-senha"] [data-bar]').forEach((bar, index) => {
    bar.className = `pw-bar${index < score ? ` ${classes[score]}` : ''}`
  })
  const labels = ['', 'Muito fraca', 'Fraca', 'Boa', 'Forte']
  document.getElementById('pw-label-tutor').textContent = value ? `Senha ${labels[score]}` : ''
})

const accountDraft = loadDraft(DRAFT_KEY)
migrateInterruptedApplicationDraft(accountDraft)
applyDraft(form, accountDraft)
wireDraftAutosave(DRAFT_KEY, form)
