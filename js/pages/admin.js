import { requireRole, signOut } from '../lib/auth.js'

const session = await requireRole('admin')

if (session) {
  console.log('Admin autenticado:', session.profile.name)
}

const logoutButtons = document.querySelectorAll('[data-logout]')

logoutButtons.forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault()
    await signOut()
  })
})
