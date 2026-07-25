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
}
