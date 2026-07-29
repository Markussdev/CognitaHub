import { escapeHtml } from '../utils/html.js'
import pkg from '../../package.json'

// Menu principal de Configurações — três botões grandes, função de cada
// um clara sem precisar entrar.
const ITEMS = [
  {
    key: 'profile',
    emoji: '🐱',
    title: 'Meu perfil',
    hint: 'Meu nome e meu gatinho',
    enabled: true,
  },
  {
    key: 'experience',
    emoji: '✨',
    title: 'Minha experiência',
    hint: 'Texto e movimento',
    enabled: true,
  },
  {
    key: 'guardians',
    emoji: '🛡',
    title: 'Para responsáveis',
    hint: 'Conexão, aparelhos e ajuda',
    enabled: true,
  },
]

export function renderSettings(root, { onBack, onOpenProfile, onOpenExperience, onOpenGuardians }) {
  const itemsHtml = ITEMS.map((item) => {
    const trailing = item.enabled
      ? `<span class="settings-menu-item__chevron" aria-hidden="true">›</span>`
      : `<span class="settings-menu-item__badge">Em breve</span>`

    return `
      <button
        class="settings-menu-item${item.enabled ? '' : ' is-disabled'}"
        type="button"
        data-settings-item="${item.key}"
        ${item.enabled ? '' : 'disabled'}
      >
        <span class="settings-menu-item__icon" aria-hidden="true">${item.emoji}</span>
        <span class="settings-menu-item__copy">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.hint)}</span>
        </span>
        ${trailing}
      </button>
    `
  }).join('')

  root.innerHTML = `
    <div class="screen screen--settings">
      <header class="settings-header">
        <button class="settings-header__back" type="button" aria-label="Voltar">‹</button>
        <h1 class="title">Configurações</h1>
      </header>

      <div class="settings-menu">
        ${itemsHtml}
      </div>

      <p class="settings-version">Versão ${escapeHtml(pkg.version)}</p>
    </div>
  `

  root.querySelector('.settings-header__back')?.addEventListener('click', () => onBack?.())
  root.querySelector('[data-settings-item="profile"]')?.addEventListener('click', () => onOpenProfile?.())
  root.querySelector('[data-settings-item="experience"]')?.addEventListener('click', () => onOpenExperience?.())
  root.querySelector('[data-settings-item="guardians"]')?.addEventListener('click', () => onOpenGuardians?.())
}
