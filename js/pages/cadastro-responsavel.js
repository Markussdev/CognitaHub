import { signUp } from '../lib/auth.js'
import { stashPendingSignup } from '../lib/pending-signup.js'
import { submitGuardianRegistration } from '../data/signup.js'

const form = document.querySelector('[data-guardian-form]')
const errorBox = document.querySelector('[data-guardian-error]')
const successBox = document.querySelector('[data-guardian-success]')

const TERMS_VERSION = 'mvp-2026-06'

// Vocabulário do banco (docs/DATABASE.md) ← valores do formulário
const FORMAT_MAP = {
  imagens: 'visual',
  'objetos-concretos': 'concrete',
  jogos: 'game',
  historias: 'story',
  'passo-a-passo': 'step_by_step',
}

const ATTENTION_MAP = {
  'ate-5': 'short',
  '5-10': 'medium',
  'mais-10': 'long',
  'nao-sei': 'unknown',
}

const MATH_DIFFICULTY_MAP = {
  'reconhecer-numeros': 'number_recognition',
  contar: 'counting',
  'comparar-quantidades': 'quantity_comparison',
  somar: 'addition',
  subtrair: 'subtraction',
  'formas-geometricas': 'geometry',
}

function ageInYears(birthDate) {
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
}

function buildRegistration(formData) {
  const acompanhamento = formData.get('acompanhamento')

  return {
    child: {
      name: formData.get('crianca-nome')?.trim(),
      birthDate: formData.get('crianca-nascimento'),
      schoolYear: formData.get('etapa-escolar'),
      mainDifficulties: formData.get('dificuldades')?.trim() || null,
      sensoryNotes: formData.get('preferencias')?.trim() || null,
      routineNotes: acompanhamento
        ? `Já possui acompanhamento educacional/terapêutico: ${acompanhamento}`
        : null,
    },
    learningProfile: {
      preferredFormats: formData.getAll('aprende-melhor').map((v) => FORMAT_MAP[v] ?? v),
      attentionSpan: ATTENTION_MAP[formData.get('tempo-concentracao')] ?? 'unknown',
      mathDifficulties: formData.getAll('conteudos-dificeis').map((v) => MATH_DIFFICULTY_MAP[v] ?? v),
      motivators: formData.get('motivadores')?.trim() || null,
      avoidances: formData.get('dificultadores')?.trim() || null,
    },
    consent: {
      dataUseAccepted: formData.get('consentimento-dados') != null,
      contactAccepted: formData.get('consentimento-contato') != null,
      termsVersion: TERMS_VERSION,
    },
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  errorBox.textContent = ''
  successBox.textContent = ''

  const formData = new FormData(form)

  const name = formData.get('responsavel-nome')?.trim()
  const email = formData.get('responsavel-email')?.trim()
  const phone = formData.get('responsavel-telefone')?.trim()
  const password = formData.get('responsavel-senha')

  const birthDate = formData.get('crianca-nascimento')
  const age = ageInYears(birthDate)
  if (age < 5 || age > 9) {
    errorBox.textContent =
      'O Cognita atende crianças de 5 a 9 anos. Confira a data de nascimento informada.'
    return
  }

  const registration = buildRegistration(formData)

  const { user, session, error } = await signUp({
    name,
    email,
    phone,
    password,
    role: 'guardian',
  })

  if (error) {
    errorBox.textContent = 'Não foi possível criar seu cadastro. Verifique os dados e tente novamente.'
    console.error(error)
    return
  }

  if (!session) {
    // Confirmação de email ligada: guarda o cadastro e completa no 1º login.
    stashPendingSignup('guardian', email, registration)
    successBox.textContent =
      'Conta criada! Confirme seu email e entre no hub para concluir o cadastro da criança.'
    form.reset()
    return
  }

  const { error: registrationError, step } = await submitGuardianRegistration(user.id, registration)

  if (registrationError) {
    // Guarda o cadastro para o login tentar completar de novo.
    stashPendingSignup('guardian', email, registration)
    errorBox.textContent =
      'Sua conta foi criada, mas não foi possível concluir o cadastro da criança. Entre no hub para tentar novamente.'
    console.error(`Erro ao gravar cadastro (${step}):`, registrationError)
    return
  }

  successBox.textContent =
    'Cadastro enviado! A equipe Cognita irá analisar as informações e entrará em contato.'
  form.reset()
})
