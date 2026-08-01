const EMBLEMA_BASE = '/assets/trilha/emblemas/'
const MASCOTE_BASE = '/assets/trilha/mascote/'
const ESPACO_BASE = '/assets/trilha/espaco/'

function publicAssetUrl(base, nome) {
  if (!nome) return ''
  return `${base}${nome}.webp`
}

export function emblemaUrl(nome) {
  return publicAssetUrl(EMBLEMA_BASE, nome)
}

export function mascoteUrl(nome) {
  return publicAssetUrl(MASCOTE_BASE, nome)
}

export function espacoUrl(nome) {
  return publicAssetUrl(ESPACO_BASE, nome)
}
