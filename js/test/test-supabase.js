import { supabase } from './lib/supabase.js'

async function testarSupabase() {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .limit(6)

  if (error) {
    console.error('Erro ao buscar atividades:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return
  }

  console.log('Atividades vindas do Supabase:', data)
}

testarSupabase()
