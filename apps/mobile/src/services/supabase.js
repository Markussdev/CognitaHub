import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variaveis do Supabase nao encontradas. Confira o arquivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Chave própria pra não reaproveitar a sessão do painel web (tutor/admin)
    // quando os dois rodam no mesmo host/localStorage.
    storageKey: 'cognita-mobile-child-auth-v1',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
