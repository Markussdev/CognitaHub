import { signUp } from '../lib/auth.js'
import { stashPendingSignup } from '../lib/pending-signup.js'
import { submitTutorApplication } from '../data/signup.js'

const form = document.querySelector('[data-tutor-form]')
const errorBox = document.querySelector('[data-tutor-error]')
const successBox = document.querySelector('[data-tutor-success]')

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  errorBox.textContent = ''
  successBox.textContent = ''

  const formData = new FormData(form)

  const name = formData.get('name')?.trim()
  const email = formData.get('email')?.trim()
  const phone = formData.get('phone')?.trim()
  const password = formData.get('password')

  const application = {
    formation: formData.get('formation')?.trim(),
    experience: formData.get('experience')?.trim(),
    motivation: formData.get('motivation')?.trim(),
    linkedin: formData.get('linkedin')?.trim(),
    weeklyAvailability: [],
  }

  const { user, session, error } = await signUp({
    name,
    email,
    phone,
    password,
    role: 'tutor',
  })

  if (error) {
    errorBox.textContent = 'Não foi possível criar seu cadastro. Verifique os dados e tente novamente.'
    console.error(error)
    return
  }

  if (!session) {
    // Confirmação de email ligada: guarda a candidatura e completa no 1º login.
    stashPendingSignup('tutor', email, application)
    successBox.textContent =
      'Conta criada! Confirme seu email e entre no hub para concluir a inscrição de tutor.'
    form.reset()
    return
  }

  const { error: applicationError } = await submitTutorApplication(user.id, application)

  if (applicationError) {
    // Guarda a candidatura para o login tentar completar de novo.
    stashPendingSignup('tutor', email, application)
    errorBox.textContent =
      'Conta criada, mas não foi possível salvar a inscrição de tutor. Entre no hub para tentar novamente.'
    console.error(applicationError)
    return
  }

  successBox.textContent = 'Cadastro enviado! A equipe Cognita irá analisar sua inscrição.'
  form.reset()
})
