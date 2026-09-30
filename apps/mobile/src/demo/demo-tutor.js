import '../styles/school-demo.css'

import { escapeHtml } from '../utils/html.js'
import { getSchoolDemoState, hasPendingExecution } from './school-demo-store.js'
import { DEMO_CHILD } from './school-demo-data.js'
import { renderResumoTab } from './tutor/resumo.js'
import { renderAtividadesTab } from './tutor/atividades.js'
import { renderJornadaTab } from './tutor/jornada.js'
import { renderSessoesTab } from './tutor/sessoes.js'

const TABS = [
  { key: 'resumo', label: 'Resumo', render: renderResumoTab },
  { key: 'atividades', label: 'Atividades', render: renderAtividadesTab },
  { key: 'jornada', label: 'Jornada', render: renderJornadaTab },
  { key: 'sessoes', label: 'Sessões', render: renderSessoesTab },
]

// Painel do mediador (demo da Cognita Escola). Só a casca: cabeçalho, abas e
// qual aba está aberta. O conteúdo de cada aba vive em demo/tutor/ e todas
// leem/escrevem o mesmo school-demo-store.js — o que o mediador prepara chega
// na criança, e o que a criança faz volta aqui como "aguardando registro".
// Nada disso chama Supabase.
export function renderDemoTutorExperience(root, { onExit, onOpenChild, initialTab = 'resumo' } = {}) {
  let tab = TABS.some((item) => item.key === initialTab) ? initialTab : 'resumo'
  let tabOptions = {}

  render()

  function scrollToTop() {
    const screen = root.querySelector('.demo-screen')
    if (screen) screen.scrollTop = 0
  }

  // As abas trocam de conteúdo por aqui (ex.: Resumo → Sessões já no assistente).
  function goTab(next, options = {}) {
    tab = next
    tabOptions = options
    render()
    scrollToTop()
  }

  function render() {
    const pending = hasPendingExecution() ? getSchoolDemoState().execution.total : 0

    root.innerHTML = `
      <div class="demo-screen">
        <header class="demo-header">
          <button class="demo-back" type="button" data-demo-back aria-label="Voltar ao Cognita Escola">
            <span aria-hidden="true">‹</span> Cognita Escola
          </button>
          <span class="demo-eyebrow">Mediador</span>
          <h1>${escapeHtml(DEMO_CHILD.name)}</h1>
          <p>${DEMO_CHILD.age} anos · ciclo ativo</p>
        </header>

        <div class="demo-tabs" role="tablist" aria-label="Painel do mediador">
          ${TABS.map(
            (item) => `
              <button class="demo-tabs__tab" type="button" role="tab" id="demo-tab-${item.key}"
                aria-selected="${item.key === tab}" aria-controls="demo-tab-panel" data-tab="${item.key}">
                ${item.label}
                ${item.key === 'sessoes' && pending ? `<span class="demo-tabs__badge" aria-label="${pending} aguardando registro">${pending}</span>` : ''}
              </button>
            `,
          ).join('')}
        </div>

        <div class="demo-tab-panel" id="demo-tab-panel" role="tabpanel" aria-labelledby="demo-tab-${tab}"></div>

        <p class="demo-note">Demonstração com dados fictícios.</p>
      </div>
    `

    root.querySelector('[data-demo-back]')?.addEventListener('click', () => onExit?.())

    root.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.tab !== tab) goTab(button.dataset.tab)
      })
    })

    // Com 4 abas em tela estreita a barra rola de lado — traz a aberta pra vista.
    const tabsEl = root.querySelector('.demo-tabs')
    const selected = tabsEl.querySelector('[aria-selected="true"]')
    tabsEl.scrollLeft = Math.max(0, selected.offsetLeft - (tabsEl.clientWidth - selected.offsetWidth) / 2)

    const active = TABS.find((item) => item.key === tab)
    active.render(root.querySelector('#demo-tab-panel'), {
      goTab,
      onOpenChild,
      scrollToTop,
      options: tabOptions,
    })
  }
}
