import { supabase } from '../lib/supabase.js'
import { signIn, redirectByRole } from '../lib/auth.js'

const {
  data: { user },
} = await supabase.auth.getUser()

if (user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status, name')
    .eq('id', user.id)
    .single()

  if (profile) {
    redirectByRole(profile.role)
  }
}

const form = document.querySelector('[data-login-form]')
const emailInput = document.querySelector('[data-login-email]')
const passwordInput = document.querySelector('[data-login-password]')
const errorBox = document.querySelector('[data-login-error]')

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  errorBox.textContent = ''

  const email = emailInput.value.trim()
  const password = passwordInput.value

  const { profile, error } = await signIn(email, password)

  if (error) {
    errorBox.textContent = 'E-mail ou senha incorretos. Tente novamente.'
    return
  }

  if (profile.status === 'pending') {
    errorBox.textContent = 'Seu cadastro ainda está em análise pela equipe Cognita.'
    return
  }

  redirectByRole(profile.role)
})
