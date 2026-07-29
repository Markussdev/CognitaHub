// Preferências da experiência da criança — sessão anônima por dispositivo,
// não tem conta pra sincronizar em servidor nenhum. Fica só no aparelho.
const SETTINGS_KEY = 'cognita-child-settings-v1'

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
  textSize: 'normal',
}

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(nextSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings))
  applySettings(nextSettings)
}

// Reflete a preferência no <html> via atributo, pra CSS global reagir sem
// nenhuma tela precisar saber que "movimento reduzido"/"texto grande"
// existem. Chamado no boot (main.js, antes da primeira tela) e de novo
// aqui dentro de saveSettings — assim o toggle já vale no próprio toque,
// sem esperar re-render de tela nenhuma.
export function applySettings(settings = getSettings()) {
  const root = document.documentElement
  root.dataset.reducedMotion = String(Boolean(settings.reducedMotion))
  root.dataset.textSize = settings.textSize
}
