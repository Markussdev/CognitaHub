import { supabase } from './supabase.js'

// Reaproveita a sessão anônima já persistida (supabase-js guarda no
// localStorage) — só chama signInAnonymously() se não houver nenhuma
// sessão, pra não acumular um usuário anônimo novo a cada tentativa de
// código digitado errado.
export async function ensureAnonymousSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  if (session?.user?.is_anonymous === true) return session

  // Sessão não-anônima (tutor/responsável/admin) não serve pro app infantil.
  if (session) {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}
