import { escapeHtml } from '../utils/html.js'

// Ícones próprios (traço grosso, pontas arredondadas, no máximo duas
// cores via currentColor) — nada de emoji. Emoji muda de desenho por
// Android/navegador/fabricante; os landmarks e gatos do Cognita têm
// identidade visual própria, então o menu de configurações precisa da
// mesma linguagem, não de um símbolo genérico de sistema.

// Rosto de gato — Meu perfil.
const CAT_SVG = `
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M6 8L4.6 3.8 9 6.2M18 8l1.4-4.2L15 6.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="12" cy="13" r="6.4" stroke="currentColor" stroke-width="2.2" />
    <path d="M9.4 13.6c.4.9 1.3 1.5 2.6 1.5s2.2-.6 2.6-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <path d="M9.6 12h.01M14.4 12h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
  </svg>
`

// "Aa" com uma centelha — texto/tamanho + um toque de movimento. Minha experiência.
const TEXT_SVG = `
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
    <text x="1.5" y="17.5" font-size="15" font-weight="800" fill="currentColor" font-family="sans-serif">A</text>
    <text x="12.5" y="17.5" font-size="10" font-weight="800" fill="currentColor" font-family="sans-serif">a</text>
    <path d="M19.4 3.6l.55 1.4 1.4.55-1.4.55-.55 1.4-.55-1.4-1.4-.55 1.4-.55z" fill="currentColor" />
  </svg>
`

// Escudo com check — Para responsáveis.
const SHIELD_SVG = `
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M12 3.4l7 2.6v5.1c0 4.6-2.9 7.8-7 9.3-4.1-1.5-7-4.7-7-9.3V6z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
    <path d="M9 12.2l2.1 2.1 4-4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`

// Menu principal de Configurações — três botões grandes, função de cada
// um clara sem precisar entrar.
const ITEMS = [
  {
    key: 'profile',
    variant: 'profile',
    icon: CAT_SVG,
    title: 'Meu perfil',
    hint: 'Meu nome e meu gatinho',
    enabled: true,
  },
  {
    key: 'experience',
    variant: 'experience',
    icon: TEXT_SVG,
    title: 'Minha experiência',
    hint: 'Texto e movimento',
    enabled: true,
  },
  {
    key: 'guardians',
    variant: 'guardians',
    icon: SHIELD_SVG,
    title: 'Para responsáveis',
    hint: 'Área protegida',
    enabled: true,
  },
]

export function renderSettings(root, { childName, childAvatar, onBack, onOpenProfile, onOpenExperience, onOpenGuardians }) {
  const itemsHtml = ITEMS.map((item) => {
    const trailing = item.enabled
      ? `<span class="settings-menu-item__chevron" aria-hidden="true">›</span>`
      : `<span class="settings-menu-item__badge">Em breve</span>`

    return `
      <button
        class="settings-menu-item settings-menu-item--${item.variant}${item.enabled ? '' : ' is-disabled'}"
        type="button"
        data-settings-item="${item.key}"
        ${item.enabled ? '' : 'disabled'}
      >
        <span class="settings-menu-item__icon" aria-hidden="true">${item.icon}</span>
        <span class="settings-menu-item__copy">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.hint)}</span>
        </span>
        ${trailing}
      </button>
    `
  }).join('')

  // Hero azul (mesma família visual da jornada) com a identidade da
  // criança — a tela deixa de ser um menu genérico e vira "a área dela"
  // dentro do Cognita. Painel creme curvo por baixo mantém a legibilidade
  // dos cards. Nenhum asset novo: só cor, forma e os ícones acima.
  root.innerHTML = `
    <div class="screen screen--settings screen--settings-home">
      <div class="settings-hero">
        <div class="settings-hero__top">
          <button class="settings-hero__back" type="button" aria-label="Voltar">‹</button>
          <h1 class="settings-hero__title">Configurações</h1>
        </div>
        <div class="settings-hero__identity">
          <img class="settings-hero__avatar" src="${childAvatar}" alt="" />
          <div class="settings-hero__copy">
            <strong>Oi, ${escapeHtml(childName)}!</strong>
            <span>Deixe tudo do seu jeito.</span>
          </div>
        </div>
      </div>

      <div class="settings-panel">
        <div class="settings-menu">
          ${itemsHtml}
        </div>
      </div>
    </div>
  `

  root.querySelector('.settings-hero__back')?.addEventListener('click', () => onBack?.())
  root.querySelector('[data-settings-item="profile"]')?.addEventListener('click', () => onOpenProfile?.())
  root.querySelector('[data-settings-item="experience"]')?.addEventListener('click', () => onOpenExperience?.())
  root.querySelector('[data-settings-item="guardians"]')?.addEventListener('click', () => onOpenGuardians?.())
}
