import { supabase } from './supabase.js'

const HOME_BY_ROLE = {
  guardian: '/pages/responsavel.html',
  tutor: '/pages/tutor.html',
  admin: '/pages/admin.html',
}

const BLOCKED_STATUSES = ['rejected', 'inactive']

export function isBlockedStatus(status) {
  return BLOCKED_STATUSES.includes(status)
}

export async function signUp({ email, password, name, phone, role }) {
  if (!['guardian', 'tutor'].includes(role)) {
    return { error: new Error('Tipo de cadastro invalido') }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        role,
      },
    },
  })

  if (error || !data?.user) {
    return {
      error: error ?? new Error('Nao foi possivel criar o usuario'),
    }
  }

  return { user: data.user, session: data.session }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data?.user) {
    return {
      error: error ?? new Error('Usuario nao autenticado'),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status, name, email, phone, avatar_path, tutor_presentation, tutor_formation, tutor_availability, tutor_preferences')
    .eq('id', data.user.id)
    .single()

  if (profileError) {
    return { error: profileError }
  }

  return { user: data.user, profile }
}

export function redirectByRole(role) {
  window.location.href = HOME_BY_ROLE[role] ?? '/pages/login.html'
}

export async function requireRole(...allowedRoles) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    window.location.replace('/pages/login.html')
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status, name, email, phone, avatar_path, tutor_presentation, tutor_formation, tutor_availability, tutor_preferences')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    window.location.replace('/pages/login.html')
    return null
  }

  if (!allowedRoles.includes(profile.role)) {
    redirectByRole(profile.role)
    return null
  }

  if (isBlockedStatus(profile.status)) {
    await supabase.auth.signOut()
    window.location.replace('/pages/login.html')
    return null
  }

  return { user, profile }
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/pages/login.html'
}
