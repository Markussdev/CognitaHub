import { supabase } from './supabase.js'

const AVATAR_BUCKET = 'profile-photos'

export async function getAvatarUrl(path) {
  if (!path) return null

  const { data, error } = await supabase
    .storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 3600)

  if (error) {
    console.warn('Erro ao carregar avatar:', error)
    return null
  }

  return data.signedUrl
}

export function setAvatarImage(nodeOrSelector, url) {
  const node = typeof nodeOrSelector === 'string'
    ? document.querySelector(nodeOrSelector)
    : nodeOrSelector

  if (!node || !url) return

  node.textContent = ''
  const img = document.createElement('img')
  img.src = url
  img.alt = ''
  node.append(img)
}
