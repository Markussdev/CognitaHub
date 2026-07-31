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

// Isto SÓ funciona com "Confirm email" ligado no painel do Supabase
// (Authentication → Providers → Email). Com a opção desligada, o próprio
// Supabase considera o e-mail implicitamente confirmado e já preenche
// email_confirmed_at no signUp — não sobra nenhum sinal aqui pro app
// distinguir "confirmou de verdade" de "nunca confirmou". O código abaixo
// cobre os dois formatos de recusa que o Supabase pode devolver com a
// opção ligada (login rejeitado sem sessão, ou — mais raro — sessão criada
// com email_confirmed_at nulo) e desfaz a sessão nesse segundo caso, pra
// não deixar ninguém "meio-logado". Mas a trava de verdade é a config do
// painel: sem ela ligada, este bloco não impede nada.
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const isUnconfirmed = error.code === 'email_not_confirmed'
      || /email not confirmed/i.test(error.message || '')
    return { error, emailNotConfirmed: isUnconfirmed, email }
  }

  if (!data?.user) {
    return { error: new Error('Usuario nao autenticado') }
  }

  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut()
    return { error: new Error('E-mail nao confirmado'), emailNotConfirmed: true, email: data.user.email }
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

// Sem sessão exigida — chamado tanto do login (e-mail errado, sem conta
// ainda) quanto da tela pós-cadastro (sessão pode nem existir se Confirm
// email estiver ligado). O Supabase reenvia o mesmo link de confirmação.
export async function resendConfirmationEmail(email) {
  return supabase.auth.resend({ type: 'signup', email })
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

  // Mesma trava de signIn(), redundante aqui pra sessão que já existia
  // (ex.: aba aberta de antes). Só pega o caso raro de sessão criada sem
  // email_confirmed_at com "Confirm email" ligado — não substitui a
  // configuração do painel (ver comentário em signIn()).
  if (!user.is_anonymous && !user.email_confirmed_at) {
    await supabase.auth.signOut()
    window.location.replace('/pages/login.html?confirmar=1')
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

// Fase 13 — dispositivo infantil pareado (auth anônimo do Supabase, ver
// docs/supabase-fase-13-pareamento-dispositivo.sql). Diferente de
// requireRole: não redireciona pro login quando falha — "sem sessão
// pareada" é o estado normal de um dispositivo novo, quem chama decide
// mostrar a tela de pareamento, não uma tela de erro.
export async function requirePairedDevice() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || !user.is_anonymous) return null
  return { user }
}
