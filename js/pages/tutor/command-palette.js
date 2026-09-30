// Busca / command palette (Ctrl+K). Local: V1 só navega dentro da própria tela.
import { el } from '../../lib/ui.js'
import { ACTIVITY_LIBRARY, buildLibraryHref } from './biblioteca.js'
import { RECORD_STATES } from './estados.js'
import { firstName, formatLastSession } from './helpers.js'
import { goRecord } from './navegacao.js'
import { current } from './state.js'
import { openSupportDrawer } from './suporte.js'

const CMDK_ICONS = {
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>`,
  book: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  team: `<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  history: `<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>`,
}

function getCommandGroups() {
  const hasRecord = current.derived && RECORD_STATES.includes(current.derived.state)
  const cycle = hasRecord ? current.derived.cycle : null
  const childName = cycle ? firstName(cycle.children?.name) : null

  const quick = []
  if (hasRecord) {
    quick.push({ label: 'Registrar sessão', icon: CMDK_ICONS.plus, action: () => goRecord('sessions') })
    quick.push({ label: 'Ver perfil pedagógico', icon: CMDK_ICONS.user, action: () => { window.location.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}` } })
  }
  quick.push({ label: 'Abrir biblioteca de atividades', icon: CMDK_ICONS.book, action: () => {
    window.location.href = buildLibraryHref(hasRecord ? current.derived.cycle : null)
  } })
  quick.push({ label: 'Falar com a equipe', icon: CMDK_ICONS.team, action: () => openSupportDrawer(childName) })

  const groups = [{ label: 'Ações rápidas', items: quick }]

  if (hasRecord) {
    groups.push({
      label: 'Acompanhamentos',
      items: [{ label: cycle.children?.name ?? 'Criança', icon: CMDK_ICONS.user, action: () => goRecord() }],
    })

    groups.push({
      label: 'Atividades',
      items: Object.values(ACTIVITY_LIBRARY).map((activity) => ({
        label: activity.title,
        icon: CMDK_ICONS.book,
        action: () => { window.location.href = 'atividades.html' },
      })),
    })

    if (current.recentSessions.length) {
      groups.push({
        label: 'Sessões recentes',
        items: current.recentSessions.slice(0, 4).map((r) => ({
          label: `${r.activity_title ?? 'Sessão'} — ${formatLastSession(r.date)}`,
          icon: CMDK_ICONS.history,
          action: () => goRecord('sessions'),
        })),
      })
    }
  }

  return groups
}

function renderCommandResults(query) {
  const results = document.querySelector('[data-cmdk-results]')
  if (!results) return
  const q = query.trim().toLowerCase()

  const groups = getCommandGroups()
    .map((g) => ({ ...g, items: q ? g.items.filter((i) => i.label.toLowerCase().includes(q)) : g.items }))
    .filter((g) => g.items.length)

  if (!groups.length) {
    results.replaceChildren(el('div', 'cmdk-empty', 'Nada encontrado por aqui.'))
    return
  }

  const frag = document.createDocumentFragment()
  groups.forEach((g) => {
    frag.append(el('div', 'cmdk-group-label', g.label))
    g.items.forEach((item) => {
      const btn = el('button', 'cmdk-item')
      btn.type = 'button'
      btn.innerHTML = item.icon
      btn.append(document.createTextNode(item.label))
      btn.addEventListener('click', () => { closeCommandPalette(); item.action() })
      frag.append(btn)
    })
  })
  results.replaceChildren(frag)
}

export function openCommandPalette() {
  const panel = document.querySelector('[data-cmdk]')
  const backdrop = document.querySelector('[data-cmdk-backdrop]')
  const input = document.querySelector('[data-cmdk-input]')
  if (!panel || !backdrop) return
  panel.classList.add('open')
  backdrop.classList.add('open')
  if (input) {
    input.value = ''
    renderCommandResults('')
    requestAnimationFrame(() => input.focus())
  }
}

export function closeCommandPalette() {
  document.querySelector('[data-cmdk]')?.classList.remove('open')
  document.querySelector('[data-cmdk-backdrop]')?.classList.remove('open')
}

export function wireCommandPalette() {
  document.querySelector('[data-cmdk-trigger]')?.addEventListener('click', openCommandPalette)
  document.querySelector('[data-cmdk-backdrop]')?.addEventListener('click', closeCommandPalette)
  document.querySelector('[data-cmdk-input]')?.addEventListener('input', (e) => renderCommandResults(e.target.value))
}
