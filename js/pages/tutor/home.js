import { el, initials, greeting } from '../../lib/ui.js'
import { getCycleSessions } from '../../data/sessions.js'
import { simpleHead, formatLastSession, monthsBetween, currentCycleMonth } from './shared.js'

// Domínio Início (Home antes do record) — extraído de js/pages/tutor.js.
// Contrato com o resto da tela (renderCurrentView em tutor.js):
// buildHomeView(state, cycle, { tutorName, openRecord, openSupport,
// libraryHref, suggestedActivity, onSessionsLoaded }) devolve uma Promise
// de <section>. Nada disso mudou nesta extração — só o arquivo que contém
// o código. Este módulo não conhece `session`, `currentDerived`,
// `recentSessionsCache`, a command palette nem outras funções internas de
// tutor.js — o que precisava delas virou parâmetro/callback explícito:
//
// - tutorName: session.profile.name || 'tutor' (era lido de `session` direto);
// - openSupport(): tutor.js fecha sobre openSupportDrawer(firstName(...)) —
//   este módulo não importa openSupportDrawer nem firstName;
// - libraryHref: já é a URL pronta (ou null); tutor.js calcula via
//   buildLibraryHref(cycle) — este módulo não sabe montar a URL da
//   Biblioteca nem precisa de hasActiveTutorCycle;
// - suggestedActivity: já é o título pronto (string). ACTIVITY_LIBRARY e
//   pickSuggestedActivity continuam em tutor.js porque a command palette
//   também os usa hoje — mover os dois é decisão para quando o cmdk for
//   extraído, não desta missão;
// - onSessionsLoaded(rows): este módulo carrega as sessões do ciclo (pra
//   "Última sessão"), mas quem grava em recentSessionsCache (consumida pela
//   command palette) é tutor.js, via este callback.

const logoIconSrc = '/assets/logo-icon-transparent.png'

const HOME_SUMMARY = {
  cycle_active: 'Você tem 1 acompanhamento ativo.',
  cycle_planned: 'Seu próximo acompanhamento ainda não começou.',
  cycle_paused: 'Seu acompanhamento está pausado no momento.',
  cycle_completed: 'Seu acompanhamento foi concluído — obrigado pelo cuidado.',
}

const NEXT_ACTION_LABEL = {
  cycle_active: 'Registrar a sessão desta semana',
  cycle_planned: 'Aguardando a equipe ativar o ciclo',
  cycle_paused: 'Ciclo pausado — fale com a equipe',
  cycle_completed: 'Nenhuma — ciclo concluído',
}

const CYCLE_LABEL = {
  cycle_active: 'Ciclo ativo',
  cycle_planned: 'Ciclo planejado',
  cycle_paused: 'Ciclo pausado',
  cycle_completed: 'Ciclo concluído',
}

export async function buildHomeView(state, cycle, {
  tutorName,
  openRecord,
  openSupport,
  libraryHref,
  suggestedActivity,
  onSessionsLoaded,
} = {}) {
  const panel = el('section', 'panel')
  const child = cycle.children ?? {}

  const head = el('div', 'home-head')
  const mascot = document.createElement('img')
  mascot.className = 'mascot'
  mascot.src = logoIconSrc
  mascot.alt = ''
  const headCopy = el('div')
  headCopy.append(
    el('p', 'kicker', 'Hoje'),
    el('h1', null, greeting(tutorName)),
    el('p', null, HOME_SUMMARY[state] ?? HOME_SUMMARY.cycle_active)
  )
  head.append(mascot, headCopy)
  panel.append(head)

  const { data, error } = await getCycleSessions(cycle.id)
  const rows = error ? [] : (data ?? [])
  const last = rows[0]
  onSessionsLoaded?.(rows)

  const stack = el('div', 'stack')
  stack.style.cssText = 'padding:18px 26px 60px'

  const buildStat = (label, value, accent) => {
    const stat = el('div', `card home-stat${accent ? ' card--accent' : ''}`)
    stat.append(el('div', 'lbl', label), el('div', 'val', value))
    return stat
  }

  const statsRow = el('div', 'home-stats')
  statsRow.append(
    buildStat('Próxima ação', NEXT_ACTION_LABEL[state] ?? NEXT_ACTION_LABEL.cycle_active, true),
    buildStat('Última sessão', last
      ? `${formatLastSession(last.date)} · ${last.activity_title ?? 'sessão registrada'}`
      : 'Ainda sem sessões registradas.'),
    buildStat('Atividade sugerida', suggestedActivity)
  )
  stack.append(statsRow)

  const accCard = el('div', 'card')
  accCard.append(simpleHead('Acompanhamentos'))
  const accBody = el('div', 'card-b')
  const list = el('div', 'home-list')

  const item = el('button', 'home-item')
  item.type = 'button'
  const av = el('div', 'av', initials(child.name ?? 'Criança'))
  const tx = el('div', 'tx')
  const monthText = state === 'cycle_active'
    ? ` · Mês ${currentCycleMonth(cycle.start_date, cycle.end_date)}/${monthsBetween(cycle.start_date, cycle.end_date)}`
    : ''
  const pendingText = state === 'cycle_active' && !rows.length ? ' · sessão pendente' : ''
  tx.append(
    el('b', null, child.name ?? 'Criança'),
    el('span', null, `${CYCLE_LABEL[state] ?? ''}${monthText}${pendingText}`)
  )
  const chevron = document.createElement('span')
  chevron.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`
  item.append(av, tx, chevron.firstElementChild)
  item.addEventListener('click', () => openRecord())
  list.append(item)

  accBody.append(list)
  accCard.append(accBody)
  stack.append(accCard)

  const shortcutsCard = el('div', 'card')
  shortcutsCard.append(simpleHead('Atalhos'))
  const shortcutsBody = el('div', 'card-b')
  const shortcuts = el('div', 'shortcut-list')

  if (libraryHref) {
    const biblio = el('a', 'shortcut-item')
    biblio.href = libraryHref
    biblio.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
    biblio.append(document.createTextNode('Biblioteca'))
    shortcuts.append(biblio)
  }

  const teamShortcut = el('button', 'shortcut-item')
  teamShortcut.type = 'button'
  teamShortcut.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`
  teamShortcut.append(document.createTextNode('Falar com equipe'))
  teamShortcut.addEventListener('click', () => openSupport())
  shortcuts.append(teamShortcut)

  const sessionsShortcut = el('button', 'shortcut-item')
  sessionsShortcut.type = 'button'
  sessionsShortcut.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>`
  sessionsShortcut.append(document.createTextNode('Ver sessões'))
  sessionsShortcut.addEventListener('click', () => openRecord('sessions'))
  shortcuts.append(sessionsShortcut)

  shortcutsBody.append(shortcuts)
  shortcutsCard.append(shortcutsBody)
  stack.append(shortcutsCard)

  panel.append(stack)
  return panel
}
