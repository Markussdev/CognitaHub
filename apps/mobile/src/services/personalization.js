import { supabase } from './supabase.js'

// Nunca faz update() direto em children — toda alteração passa pela RPC
// segura (valida tamanho do nome e avatar_key contra o check constraint
// no banco antes de gravar).
export async function saveChildPersonalization({ childId, preferredName, avatarKey }) {
  const { data, error } = await supabase.rpc('set_child_personalization', {
    p_child_id: childId,
    p_preferred_name: preferredName,
    p_avatar_key: avatarKey,
  })

  if (error) throw error
  return data?.[0] ?? null
}
