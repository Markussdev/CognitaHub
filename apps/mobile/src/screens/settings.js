import { escapeHtml } from '../utils/html.js'
import { getSettings, saveSettings } from '../services/settings.js'
import pkg from '../../package.json'

// Configurações da experiência da criança, não conta de usuário — a
// sessão é anônima por dispositivo, não tem "minha conta" pra ter aqui.
//
// Som e vibração ainda não têm efeito nenhum (não existe áudio nem
// haptics implementados ainda) — mas já persistem agora pra esses
// recursos não precisarem mexer em storage de novo quando entrarem.
// Movimento reduzido e texto grande também são só preferência salva por
// enquanto, sem aplicar no resto do app ainda.
//
// "Trocar dispositivo/criança" ficou de fora de propósito: precisa
// definir direito a revogação do pareamento antes de expor isso.

const ROWS = [
  { key: 'soundEnabled', label: 'Som', hint: 'Efeitos sonoros da jornada' },
  { key: 'hapticsEnabled', label: 'Vibração', hint: 'Resposta ao toque nos nós' },
  { key: 'reducedMotion', label: 'Movimento reduzido', hint: 'Menos animação no mapa' },
  { key: 'textSize', label: 'Texto grande', hint: 'Aumenta o texto da jornada', isTextSize: true },
]

export function renderSettings(root, { onBack }) {
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
        <h1 class="title">Configurações</h1>
      </header>

      <div class="settings-list">
        ${rowsHtml}
      </div>

      <div class="settings-list">
        <div class="settings-row settings-row--static">
          <span>Versão</span>
          <span>${escapeHtml(pkg.version)}</span>
        </div>
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
      renderSettings(root, { onBack })
    })
  })
}
