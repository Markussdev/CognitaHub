// Casca da tela: identidade da conta, rail lateral, breadcrumb e troca de abas.
// Nada aqui navega sozinho — quem decide para onde ir é navegacao.js; os
// atalhos do rail recebem as funções de navegação por parâmetro (wireRail).
import { getAvatarUrl, setAvatarImage } from '../../lib/avatar.js'
import { initials, el } from '../../lib/ui.js'
import { buildLibraryHref } from './biblioteca.js'
import { RECORD_STATES } from './estados.js'
import { firstName } from './helpers.js'
import { current, session } from './state.js'
import { openSupportDrawer } from './suporte.js'

// ── Identidade (uma vez por sessão) ──────────────────────────────────────────

export function fillIdentity() {
  const name = session.profile.name || 'Tutor'
  const set = (sel, val) => { const n = document.querySelector(sel); if (n) n.textContent = val }
  set('[data-account-name]', name)
  set('[data-account-avatar]', initials(name))
  set('[data-topbar-avatar]', initials(name))
  set('[data-account-email]', session.user.email ?? '')
  if (session.profile.avatar_path) {
    getAvatarUrl(session.profile.avatar_path).then((url) => {
      if (!url) return
      setAvatarImage('[data-account-avatar]', url)
      setAvatarImage('[data-topbar-avatar]', url)
    })
  }
}

// ── Rail / breadcrumb ─────────────────────────────────────────────────────────

export function renderRail(hasRecord, childName, goRecord) {
  const group = document.querySelector('[data-rail-acomp-group]')
  const slot = document.querySelector('[data-rail-child-slot]')
  const sessionsLink = document.querySelector('[data-rail-sessions]')
  if (!slot) return

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
  link.addEventListener('click', (e) => { e.preventDefault(); goRecord() })
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

// Atalhos do rail (Início, Sessões, Biblioteca, Equipe, Perfil). goHome/goRecord/
// goProfile chegam de navegacao.js — o shell não importa a navegação.
export function wireRail({ goHome, goRecord, goProfile }) {
  document.querySelector('[data-rail-home]')?.addEventListener('click', (e) => { e.preventDefault(); goHome() })
  document.querySelector('[data-rail-sessions]')?.addEventListener('click', (e) => { e.preventDefault(); goRecord('sessions') })
  document.querySelector('[data-rail-library]')?.addEventListener('click', (e) => {
    e.preventDefault()
    window.location.href = buildLibraryHref(current.derived?.cycle)
  })
  document.querySelector('[data-rail-team]')?.addEventListener('click', (e) => {
    e.preventDefault()
    const hasRecord = current.derived && RECORD_STATES.includes(current.derived.state)
    openSupportDrawer(hasRecord ? firstName(current.derived.cycle.children?.name) : null)
  })
  document.querySelector('[data-rail-profile]')?.addEventListener('click', (e) => { e.preventDefault(); goProfile() })
}
