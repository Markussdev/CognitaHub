// Tela Início: a home antes de entrar no acompanhamento de uma criança.
import { getCycleSessions } from '../../data/sessions.js'
import { logoIconSrc } from '../../lib/asset-urls.js'
import { greeting, initials, el } from '../../lib/ui.js'
import { buildLibraryHref, pickSuggestedActivity } from './biblioteca.js'
import { currentCycleMonth, firstName, formatLastSession, monthsBetween, simpleHead, toList } from './helpers.js'
import { current, session } from './state.js'
import { openSupportDrawer } from './suporte.js'

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

export async function buildHomeView(state, cycle, openRecord) {
  const panel = el('section', 'panel')
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}

  const head = el('div', 'home-head')
  const mascot = document.createElement('img')
  mascot.className = 'mascot'
  mascot.src = logoIconSrc
  mascot.alt = ''
  const headCopy = el('div')
  headCopy.append(
    el('p', 'kicker', 'Hoje'),
    el('h1', null, greeting(session.profile.name || 'tutor')),
    el('p', null, HOME_SUMMARY[state] ?? HOME_SUMMARY.cycle_active)
  )
  head.append(mascot, headCopy)
  panel.append(head)

  const { data, error } = await getCycleSessions(cycle.id)
  const rows = error ? [] : (data ?? [])
  const last = rows[0]
  current.recentSessions = rows

  const difficulties = toList(lp.math_difficulties).length ? lp.math_difficulties : child.main_difficulties
  const activity = pickSuggestedActivity(difficulties)

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
    buildStat('Atividade sugerida', activity.title)
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

  const biblio = el('a', 'shortcut-item')
  biblio.href = buildLibraryHref(cycle)
  biblio.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
  biblio.append(document.createTextNode('Biblioteca'))
  shortcuts.append(biblio)

  const teamShortcut = el('button', 'shortcut-item')
  teamShortcut.type = 'button'
  teamShortcut.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`
  teamShortcut.append(document.createTextNode('Falar com equipe'))
  teamShortcut.addEventListener('click', () => openSupportDrawer(firstName(child.name)))
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
