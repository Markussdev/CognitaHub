import { requireRole, signOut } from '../lib/auth.js'
import { submitTutorApplication } from '../data/signup.js'
import { recordLegalAcceptances } from '../data/legal-acceptances.js'
import {
  getTutorRegistrationState,
  REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS,
} from '../data/tutor-registration.js'
import { completePendingSignup } from '../lib/pending-signup.js'
import { loadDraft, applyDraft, clearDraft, wireDraftAutosave } from '../lib/form-draft.js'

const DRAFT_KEY = 'cognita:draft:candidatura-tutor'
const session = await requireRole('tutor')
const loading = document.querySelector('[data-page-loading]')
const errorPage = document.querySelector('[data-page-error]')
const form = document.querySelector('[data-tutor-application-form]')
const stepper = document.querySelector('[data-candidatura-stepper]')
const panels = [...document.querySelectorAll('[data-step-panel]')]
const stepItems = [...document.querySelectorAll('[data-step-item]')]
const formMessage = document.querySelector('[data-form-message]')
const submitButton = document.querySelector('[data-submit-application]')
let currentStep = 0
let draftWired = false

function valueOf(selector) {
  return document.querySelector(selector)?.value.trim() ?? ''
}

function radioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? ''
}

function pressedChips(groupId) {
  return [...document.querySelectorAll(`#${groupId} .chip[aria-pressed="true"]`)]
    .map((chip) => chip.textContent.trim())
}

function experienceValue(lines, prefix) {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? ''
}

function setRadio(name, value) {
  if (!value) return
  const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`)
  if (input) input.checked = true
}

function setChips(groupId, values) {
  form.querySelectorAll(`#${groupId} .chip`).forEach((chip) => {
    chip.setAttribute('aria-pressed', values.includes(chip.textContent.trim()) ? 'true' : 'false')
  })
}

function hydrateApplication(application) {
  if (!application) return

  document.getElementById('tt-nasc').value = application.birth_date ?? ''
  const [formation = '', situation = ''] = String(application.formation ?? '').split(' / ')
  document.getElementById('ap-form').value = formation
  setRadio('situacao', situation)

  const lines = String(application.experience ?? '').split('\n')
  const teachingExperience = experienceValue(lines, 'Experiência com ensino:')
  document.getElementById('ap-exp').value = teachingExperience === 'não informado' ? '' : teachingExperience
  setRadio('exp_criancas', experienceValue(lines, 'Experiência com crianças:'))
  setRadio('exp_tea', experienceValue(lines, 'Contato com TEA:'))
  setRadio('participacao', experienceValue(lines, 'Condição de participação:'))
  setRadio('roteiro', experienceValue(lines, 'Roteiro pronto:'))

  document.getElementById('ap-motiv').value = application.motivation ?? ''
  document.getElementById('ap-li').value = application.linkedin ?? ''
  const availability = Array.isArray(application.weekly_availability)
    ? application.weekly_availability
    : []
  setChips('ap-dispon', availability)
  setChips('ap-periodos', availability)
}

function hydrateAcceptances(acceptedKeys) {
  const accepted = new Set(acceptedKeys)
  const accountAccepted = ['privacy_policy', 'terms_of_use'].every((key) => accepted.has(key))
  const legalCheckbox = document.getElementById('tt-legais')
  if (accountAccepted) {
    legalCheckbox.checked = true
    legalCheckbox.disabled = true
  }

  const tutorTermsCheckbox = document.getElementById('tt-termos')
  const tutorTermsAccepted = accepted.has('tutor_terms')
  if (tutorTermsAccepted) {
    tutorTermsCheckbox.checked = true
    tutorTermsCheckbox.disabled = true
  }
}

function showStep(index) {
  currentStep = index
  panels.forEach((panel, panelIndex) => panel.classList.toggle('is-active', panelIndex === index))
  stepItems.forEach((item, itemIndex) => {
    item.classList.toggle('is-active', itemIndex === index)
    item.classList.toggle('is-done', itemIndex < index)
    item.querySelector('.stepper-dot').textContent = itemIndex < index ? '✓' : String(itemIndex + 1)
  })
  document.querySelector('[data-step-counter]').textContent = `Etapa ${index + 1} de 2`
  document.querySelector('[data-step-announce]').textContent = index === 0
    ? 'Etapa 1 de 2: sobre você'
    : 'Etapa 2 de 2: termos de atuação'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function ageFromBirthDate(value) {
  const birth = new Date(`${value}T00:00:00`)
  const today = new Date()
  if (Number.isNaN(birth.getTime()) || birth > today) return null
  let age = today.getFullYear() - birth.getFullYear()
  const birthdayPending = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (birthdayPending) age--
  return age
}

function validateBirthDate() {
  const input = document.getElementById('tt-nasc')
  const alert = document.getElementById('age-alert-tutor')
  const detail = alert.querySelector('[data-age-detail]')
  if (!input.value) {
    alert.classList.remove('is-visible')
    return false
  }

  const age = ageFromBirthDate(input.value)
  if (age === null || age < 18) {
    alert.classList.add('is-visible')
    detail.textContent = age === null
      ? 'Confira a data informada.'
      : `Com ${age} anos, a candidatura não pode ser concluída.`
    input.setAttribute('aria-invalid', 'true')
    return false
  }

  alert.classList.remove('is-visible')
  input.setAttribute('aria-invalid', 'false')
  return true
}

function validateApplicationPanel() {
  let valid = validateBirthDate()
  panels[0].querySelectorAll('input[required], select[required], textarea[required]').forEach((field) => {
    const invalid = !field.checkValidity()
    field.setAttribute('aria-invalid', invalid ? 'true' : 'false')
    if (invalid) valid = false
  })
  panels[0].querySelectorAll('.radio-group').forEach((group) => {
    const groupValid = Boolean(group.querySelector('input[type="radio"]:checked'))
    group.classList.toggle('is-invalid', !groupValid)
    if (!groupValid) valid = false
  })
  ;[['ap-dispon', 'err-ap-dispon'], ['ap-periodos', 'err-ap-periodos']].forEach(([groupId, errorId]) => {
    const group = document.getElementById(groupId)
    const groupValid = Boolean(group.querySelector('[aria-pressed="true"]'))
    group.classList.toggle('is-invalid', !groupValid)
    document.getElementById(errorId).classList.toggle('is-visible', !groupValid)
    if (!groupValid) valid = false
  })

  if (!valid) {
    panels[0].querySelector('[aria-invalid="true"], .radio-group.is-invalid input, .chip-group.is-invalid .chip')?.focus()
  }
  return valid
}

function validateTerms() {
  const checkboxes = [document.getElementById('tt-termos'), document.getElementById('tt-legais')]
  const valid = checkboxes.every((checkbox) => checkbox.checked)
  document.querySelector('[data-terms-error]').classList.toggle('is-visible', !valid)
  if (!valid) checkboxes.find((checkbox) => !checkbox.checked)?.focus()
  return valid
}

function buildApplication() {
  return {
    birthDate: valueOf('#tt-nasc'),
    formation: `${valueOf('#ap-form')} / ${radioValue('situacao')}`,
    experience: [
      `Experiência com ensino: ${valueOf('#ap-exp') || 'não informado'}`,
      `Experiência com crianças: ${radioValue('exp_criancas')}`,
      `Contato com TEA: ${radioValue('exp_tea')}`,
      `Condição de participação: ${radioValue('participacao')}`,
      `Roteiro pronto: ${radioValue('roteiro')}`,
    ].join('\n'),
    motivation: valueOf('#ap-motiv'),
    linkedin: valueOf('#ap-li'),
    weeklyAvailability: [
      ...pressedChips('ap-dispon'),
      ...pressedChips('ap-periodos'),
    ],
  }
}

function showFormMessage(message) {
  formMessage.textContent = message
  formMessage.classList.add('is-visible')
  formMessage.focus?.()
}

function showFatal(message) {
  loading.hidden = true
  form.hidden = true
  stepper.hidden = true
  errorPage.hidden = false
  document.querySelector('[data-page-error-copy]').textContent = message
}

async function bootstrap() {
  if (!session) return
  loading.hidden = false
  errorPage.hidden = true
  form.hidden = true
  stepper.hidden = true

  const pendingResult = await completePendingSignup(session.user)
  if (pendingResult.error) {
    showFatal('Não foi possível concluir os aceites guardados na criação da conta. Seus dados continuam preservados; tente novamente.')
    return
  }

  const registration = await getTutorRegistrationState(session.user.id)
  if (registration.error) {
    console.error(`Erro ao verificar candidatura (${registration.step}):`, registration.error)
    showFatal('Não foi possível consultar a candidatura. Isso não foi tratado como cadastro ausente; tente novamente.')
    return
  }

  if (registration.complete) {
    window.location.replace('/pages/tutor.html')
    return
  }

  document.querySelector('[data-account-name]').textContent = session.profile.name ?? ''
  hydrateApplication(registration.application)
  const draft = loadDraft(DRAFT_KEY)
  applyDraft(form, draft)
  // Aceites já persistidos no banco prevalecem sobre um rascunho antigo.
  hydrateAcceptances(registration.acceptedLegalDocumentKeys)

  const today = new Date()
  const birthInput = document.getElementById('tt-nasc')
  birthInput.max = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().slice(0, 10)
  birthInput.min = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()).toISOString().slice(0, 10)

  const savedStep = draft?.step
  showStep(savedStep === 1 ? 1 : 0)
  if (!draftWired) {
    wireDraftAutosave(DRAFT_KEY, form, () => ({ step: currentStep }))
    draftWired = true
  }

  loading.hidden = true
  form.hidden = false
  stepper.hidden = false
}

document.querySelector('[data-page-retry]')?.addEventListener('click', bootstrap)
document.querySelector('[data-logout]')?.addEventListener('click', signOut)
document.querySelector('[data-next]')?.addEventListener('click', () => {
  if (validateApplicationPanel()) showStep(1)
})
document.querySelector('[data-prev]')?.addEventListener('click', () => showStep(0))
document.getElementById('tt-nasc')?.addEventListener('change', validateBirthDate)

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
  })
})

form?.addEventListener('submit', async (event) => {
  event.preventDefault()
  formMessage.classList.remove('is-visible')

  if (!validateApplicationPanel()) {
    showStep(0)
    return
  }
  if (!validateTerms()) return

  submitButton.disabled = true
  submitButton.textContent = 'Salvando candidatura…'

  const applicationResult = await submitTutorApplication(session.user.id, buildApplication())
  if (applicationResult.error) {
    console.error(`Erro ao salvar candidatura (${applicationResult.step}):`, applicationResult.error)
    showFormMessage('Não foi possível salvar a candidatura. Seu rascunho continua neste dispositivo; tente novamente.')
    submitButton.disabled = false
    submitButton.textContent = 'Enviar candidatura'
    return
  }

  const acceptanceResult = await recordLegalAcceptances({
    userId: session.user.id,
    childId: null,
    documentKeys: REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS,
    source: 'tutor_signup',
    audience: 'tutor',
  })
  if (acceptanceResult.error) {
    console.error('Erro ao registrar aceites da candidatura:', acceptanceResult.error)
    showFormMessage('A candidatura foi salva, mas ainda falta confirmar os aceites no banco. Tente novamente; a candidatura não será duplicada.')
    submitButton.disabled = false
    submitButton.textContent = 'Tentar concluir novamente'
    return
  }

  const confirmation = await getTutorRegistrationState(session.user.id)
  if (confirmation.error) {
    console.error(`Erro ao confirmar candidatura (${confirmation.step}):`, confirmation.error)
    showFormMessage('Os dados foram enviados, mas não foi possível confirmar a conclusão. Tente novamente antes de sair.')
    submitButton.disabled = false
    submitButton.textContent = 'Confirmar novamente'
    return
  }
  if (!confirmation.complete) {
    showFormMessage('Ainda há dados ou aceites pendentes. Revise o formulário e tente novamente.')
    submitButton.disabled = false
    submitButton.textContent = 'Enviar candidatura'
    return
  }

  clearDraft(DRAFT_KEY)
  submitButton.textContent = 'Candidatura enviada!'
  window.location.href = '/pages/tutor.html'
})

await bootstrap()
