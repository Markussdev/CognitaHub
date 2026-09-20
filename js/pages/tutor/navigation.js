import { el } from '../../lib/ui.js'
import { hasActiveTutorCycle } from '../../lib/library-access.mjs'

// UI/wiring visual de navegação (rail, breadcrumb, tabs) — extraído de
// js/pages/tutor.js. Nada do comportamento mudou nesta extração — só o
// arquivo que contém o código.
//
// Este módulo é só DOM e comportamento visual: não conhece `currentDerived`,
// `currentView`, `pendingTab`, a máquina de estados nem as funções do
// orquestrador (`goHome`/`goRecord`/`goProfile`/`renderCurrentView`/
// `bootstrap`) — esses decidem ONDE o usuário está e continuam em
// tutor.js; navigation.js só desenha o resultado dessa decisão.
//
// `renderRail` chamava `goRecord()` direto ao clicar no link da criança —
// única dependência implícita do bloco. Virou o callback `openRecord`:
// `renderRail(hasRecord, childName, activeCycle, { openRecord })`, com
// tutor.js passando `{ openRecord: goRecord }`.
//
// `switchTab`/`wireTabs` não tinham dependência nenhuma além de DOM —
// `switchTab` continua exportado porque outros painéis já extraídos
// (resumo.js) recebem `openPlan`/`openSessions` que fecham sobre
// `switchTab` do lado de tutor.js; o próprio `switchTab` não circula entre
// módulos.

export function renderRail(hasRecord, childName, activeCycle = null, { openRecord } = {}) {
  const group = document.querySelector('[data-rail-acomp-group]')
  const slot = document.querySelector('[data-rail-child-slot]')
  const resourcesGroup = document.querySelector('[data-rail-resources-group]')
  const libraryLink = document.querySelector('[data-rail-library]')
  const sessionsLink = document.querySelector('[data-rail-sessions]')
  if (!slot) return

  const libraryAvailable = hasActiveTutorCycle(activeCycle)
  libraryLink.hidden = !libraryAvailable
  resourcesGroup.hidden = !libraryAvailable && !hasRecord

  // "Falar com equipe" é suporte global — fica sempre visível, com ou sem ciclo.
  if (!hasRecord) {
    group.hidden = true
    slot.replaceChildren()
    sessionsLink.hidden = true
    return
  }

  group.hidden = false
  sessionsLink.hidden = false

  const link = el('a', 'rail-link')
  link.href = '#'
  link.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>`
  link.append(document.createTextNode(childName))
  link.addEventListener('click', (e) => { e.preventDefault(); openRecord?.() })
  slot.replaceChildren(link)
}

export function setActiveNav(view) {
  const homeLink = document.querySelector('[data-rail-home]')
  const childLink = document.querySelector('[data-rail-child-slot] .rail-link')
  if (homeLink) homeLink.classList.toggle('active', view === 'home')
  if (childLink) childLink.classList.toggle('active', view === 'record')
}

export function renderCrumb(view, childName) {
  const crumb = document.querySelector('[data-crumb]')
  if (!crumb) return
  crumb.replaceChildren()
  if (view === 'record' && childName) {
    crumb.append(document.createTextNode('Acompanhamento / '), el('b', null, childName))
  } else if (view === 'profile') {
    crumb.append(document.createTextNode('Meu perfil'))
  } else {
    crumb.append(document.createTextNode('Painel do tutor'))
  }
}

export function switchTab(id) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id))
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== id })
  if (id !== 'overview') return
  requestAnimationFrame(() => {
    document.querySelector('[data-panel="overview"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

export function wireTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  })
}
