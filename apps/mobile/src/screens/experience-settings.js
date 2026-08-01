import { escapeHtml } from '../utils/html.js'
import { getSettings, saveSettings } from '../services/settings.js'

// Preferências da experiência da criança, não conta de usuário — a sessão
// é anônima por dispositivo, não tem "minha conta" pra ter aqui.
//
// Som e vibração ficam escondidos por enquanto — não existe áudio nem
// haptics implementados ainda, e não vale mostrar toggle de coisa que não
// faz nada. As chaves continuam no schema de settings.js (DEFAULT_SETTINGS)
// só pra não precisar de migração quando esses recursos existirem de
// verdade; elas voltam pra cá nesse momento.
//
// Movimento reduzido e texto grande já aplicam de verdade em todo o app —
// ver applySettings() em services/settings.js.
const ROWS = [
  { key: 'reducedMotion', label: 'Movimento reduzido', hint: 'Menos animação no mapa' },
  { key: 'textSize', label: 'Texto grande', hint: 'Aumenta o texto da jornada', isTextSize: true },
]

export function renderExperienceSettings(root, { onBack }) {
  const settings = getSettings()

  const rowsHtml = ROWS.map((row) => {
    const on = row.isTextSize ? settings.textSize === 'grande' : Boolean(settings[row.key])
    return `
      <div class="settings-row">
        <div class="settings-row__copy">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(row.hint)}</span>
        </div>
        <button
          class="settings-toggle ${on ? 'is-on' : ''}"
          type="button"
          role="switch"
          aria-checked="${on}"
          aria-label="${escapeHtml(row.label)}"
          data-setting="${row.key}"
        >
          <span class="settings-toggle__thumb"></span>
        </button>
      </div>
    `
  }).join('')

  root.innerHTML = `
    <div class="screen screen--settings">
      <header class="settings-header">
        <button class="settings-header__back" type="button" aria-label="Voltar">‹</button>
        <h1 class="title">Minha experiência</h1>
      </header>

      <div class="settings-list">
        ${rowsHtml}
      </div>
    </div>
  `

  root.querySelector('.settings-header__back')?.addEventListener('click', () => onBack?.())

  root.querySelectorAll('[data-setting]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.setting
      const current = getSettings()
      const next =
        key === 'textSize'
          ? { ...current, textSize: current.textSize === 'grande' ? 'normal' : 'grande' }
          : { ...current, [key]: !current[key] }

      saveSettings(next)
      renderExperienceSettings(root, { onBack })
    })
  })
}
