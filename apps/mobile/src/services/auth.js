import { supabase } from './supabase.js'

// Reaproveita a sessão anônima já persistida (supabase-js guarda no
// localStorage) — só chama signInAnonymously() se não houver nenhuma
// sessão, pra não acumular um usuário anônimo novo a cada tentativa de
// código digitado errado.
export async function ensureAnonymousSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (session) return session

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}
