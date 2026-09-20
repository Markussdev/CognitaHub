import { el } from '../../lib/ui.js'
import { hasActiveTutorCycle } from '../../lib/library-access.mjs'
import { openSupportDrawer } from './support.js'
import { firstName, formatLastSession, buildLibraryHref, ACTIVITY_LIBRARY } from './shared.js'

// Busca / command palette (local, V1 só navega dentro da própria tela) —
// extraído de js/pages/tutor.js. Nada do comportamento mudou nesta
// extração — só o arquivo que contém o código.
//
// Este módulo não conhece `currentDerived`, `RECORD_STATES`, `goRecord` nem
// outras funções internas da navegação/máquina de estados de tutor.js — que
// continuam lá (não fazem parte desta missão). O que precisava delas virou
// parâmetro/callback explícito, resolvido uma vez em wireCommandPalette():
//
// - getCycle(): tutor.js passa uma função que devolve o cycle atual (ou
//   null fora de um record) — substitui o antigo
//   `hasRecord = RECORD_STATES.includes(currentDerived.state)` lido direto;
// - goRecord: mesma function declaration de tutor.js, passada por
//   referência — este módulo não decide navegação, só a aciona;
// - recentSessionsCache é estado PRÓPRIO deste módulo agora (era `let`
//   solto em tutor.js, escrito pelo Início e por Sessões, lido só aqui).
//   tutor.js empurra atualizações via setRecentSessions(rows) em vez de
//   atribuir a uma variável compartilhada.
//
// openSupportDrawer (tutor/support.js) e buildLibraryHref/ACTIVITY_LIBRARY
// (tutor/shared.js) são importados direto — não são internos de tutor.js,
// são módulos-irmãos/utilitários puros.

const CMDK_ICONS = {
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>`,
  book: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  team: `<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  history: `<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>`,
}

let recentSessionsCache = []

// Chamado por tutor.js sempre que Início ou Sessões recarregam a lista de
// sessões do ciclo — mesmo dado que antes era gravado direto na variável
// module-level `recentSessionsCache` de tutor.js.
export function setRecentSessions(rows) {
  recentSessionsCache = rows ?? []
}

let getCycle = () => null
let goRecord = () => {}

function getCommandGroups() {
  const cycle = getCycle()
  const hasRecord = !!cycle
  const libraryAvailable = hasActiveTutorCycle(cycle)
  const childName = cycle ? firstName(cycle.children?.name) : null

  const quick = []
  if (hasRecord) {
    quick.push({ label: 'Registrar sessão', icon: CMDK_ICONS.plus, action: () => goRecord('sessions') })
    quick.push({ label: 'Ver perfil pedagógico', icon: CMDK_ICONS.user, action: () => { window.location.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}` } })
  }
  if (libraryAvailable) {
    quick.push({ label: 'Abrir biblioteca de atividades', icon: CMDK_ICONS.book, action: () => {
      window.location.href = buildLibraryHref(cycle)
    } })
  }
  quick.push({ label: 'Falar com a equipe', icon: CMDK_ICONS.team, action: () => openSupportDrawer(childName) })

  const groups = [{ label: 'Ações rápidas', items: quick }]

  if (hasRecord) {
    groups.push({
      label: 'Acompanhamentos',
      items: [{ label: cycle.children?.name ?? 'Criança', icon: CMDK_ICONS.user, action: () => goRecord() }],
    })

    if (libraryAvailable) {
      groups.push({
        label: 'Atividades',
        items: Object.values(ACTIVITY_LIBRARY).map((activity) => ({
          label: activity.title,
          icon: CMDK_ICONS.book,
          action: () => { window.location.href = buildLibraryHref(cycle) },
        })),
      })
    }

    if (recentSessionsCache.length) {
      groups.push({
        label: 'Sessões recentes',
        items: recentSessionsCache.slice(0, 4).map((r) => ({
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

// Wiring dos triggers (botão, backdrop, input de busca) — chamado uma vez
// por tutor.js no bootstrap, com os callbacks resolvidos. Não roda como
// efeito colateral do import (diferente de tutor/support.js) porque
// depende de getCycle/goRecord, que só tutor.js sabe fornecer.
export function wireCommandPalette({ getCycle: getCycleFn, goRecord: goRecordFn }) {
  getCycle = getCycleFn
  goRecord = goRecordFn
  document.querySelector('[data-cmdk-trigger]')?.addEventListener('click', openCommandPalette)
  document.querySelector('[data-cmdk-backdrop]')?.addEventListener('click', closeCommandPalette)
  document.querySelector('[data-cmdk-input]')?.addEventListener('input', (e) => renderCommandResults(e.target.value))
}
