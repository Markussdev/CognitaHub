// Acompanhamento de uma criança: cabeçalho, abas e os quatro painéis
// (Resumo, Sessões, Atividades, Jornada).
import { PLANOS_REGISTRO } from '../../data/planos-registro.js'
import { initials, ageFrom, el } from '../../lib/ui.js'
import { buildActivitiesPanel } from './atividades.js'
import { currentCycleMonth, monthsBetween } from './helpers.js'
import { buildPlanPanel } from './jornada.js'
import { buildResumoPanel } from './resumo.js'
import { renderSessionForm } from './sessao-wizard.js'
import { buildSessionsPanel } from './sessoes.js'
import { switchTab, wireTabs } from './shell.js'
import { current, handoffs } from './state.js'

// ── Record completo (estado com ciclo) ───────────────────────────────────────

function renderRecordHeader(cycle, state) {
  const child = cycle.children ?? {}
  const name = child.name ?? 'Criança'
  const age = ageFrom(child.birth_date)

  const header = el('header', 'record')
  const top = el('div', 'rec-top')

  top.append(el('div', 'rec-id', initials(name)))

  const main = el('div', 'rec-main')
  main.append(el('div', 'rec-name', name))

  const meta = el('div', 'rec-meta')
  if (age != null) meta.append(el('span', 'meta-chip', `${age} anos`))
  if (child.school_year) meta.append(el('span', 'meta-chip', child.school_year))

  const STATUS_CHIP = {
    cycle_active: { dot: 'ok', text: `Ciclo ativo · Mês ${currentCycleMonth(cycle.start_date, cycle.end_date)}/${monthsBetween(cycle.start_date, cycle.end_date)}` },
    cycle_planned: { dot: 'info', text: 'Ciclo planejado' },
    cycle_paused: { dot: 'warn', text: 'Ciclo pausado' },
    cycle_completed: { dot: 'ok', text: 'Ciclo concluído' },
  }
  const sc = STATUS_CHIP[state] ?? STATUS_CHIP.cycle_active
  const statusChip = el('span', 'meta-chip')
  const dot = el('span', `dot ${sc.dot}`)
  statusChip.append(dot, document.createTextNode(sc.text))
  meta.append(statusChip)
  main.append(meta)

  // Cabeçalho é só identidade e consulta — a ação dominante mora na mesa de
  // trabalho do Resumo (docs/TELA-RESUMO-PAINEL-TUTOR.md §2.2). Sem "Registrar
  // sessão"/"Preparar atividade" aqui: CTA repetido é ruído, não ênfase.
  const actions = el('div', 'rec-actions')
  const profileLink = el('a', 'btn btn-ghost', 'Ver perfil')
  profileLink.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
  actions.append(profileLink)

  top.append(main, actions)
  header.append(top)
  return header
}

function renderTabs(sessionCount, activitiesCount) {
  const tabs = el('div', 'tabs')
  tabs.setAttribute('role', 'tablist')
  ;[
    { id: 'overview', label: 'Resumo' },
    { id: 'sessions', label: 'Sessões', badge: sessionCount },
    { id: 'activities', label: 'Atividades', badge: activitiesCount },
    { id: 'plan', label: 'Jornada' },
  ].forEach(({ id, label, badge }, i) => {
    const tab = el('button', `tab${i === 0 ? ' active' : ''}`)
    tab.type = 'button'; tab.dataset.tab = id; tab.setAttribute('role', 'tab')
    tab.append(document.createTextNode(label))
    if (badge != null) tab.append(el('span', 'badge num', String(badge)))
    tabs.append(tab)
  })
  return tabs
}

export function renderRecord(state, cycle, initialTab) {
  const frag = document.createDocumentFragment()

  let sessionForm
  const refreshSessions = async () => {
    const rows = await sessionsPanel.loadTable()
    current.recentSessions = rows
    const badge = tabs.querySelector('[data-tab="sessions"] .badge')
    if (badge) badge.textContent = String(rows.length)
    resumoPanel.reload?.()
  }

  const refreshActivities = async () => {
    const rows = await activitiesPanel.loadTable()
    const badge = tabs.querySelector('[data-tab="activities"] .badge')
    if (badge) badge.textContent = String(rows.length)
  }

  const openForm = () => {
    switchTab('sessions')
    if (sessionForm) {
      sessionForm.open = true
      requestAnimationFrame(() => sessionForm.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  if (state === 'cycle_active') {
    sessionForm = renderSessionForm(cycle, refreshSessions)
  }

  const header = renderRecordHeader(cycle, state)
  const tabs = renderTabs(0, 0)
  const resumoPanel = buildResumoPanel(cycle, { openForm })
  const sessionsPanel = buildSessionsPanel(cycle, state, sessionForm)
  const activitiesPanel = buildActivitiesPanel(cycle, state, refreshActivities)
  const planPanel = buildPlanPanel(cycle, state)

  frag.append(header, tabs, resumoPanel, sessionsPanel, activitiesPanel, planPanel)

  queueMicrotask(() => {
    wireTabs()
    refreshSessions()
    refreshActivities()
    planPanel.loadStatus?.()
    if (initialTab && initialTab !== 'overview') switchTab(initialTab)
    if (handoffs.activity && sessionForm) {
      const act = handoffs.activity
      handoffs.activity = null
      sessionForm.fillSuggestedActivity(act)
      requestAnimationFrame(() => sessionForm.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    // Vem da Biblioteca via "Personalizar para Mateus" (?preset=<slug>).
    if (handoffs.preset && activitiesPanel.openPreset) {
      const preset = handoffs.preset
      handoffs.preset = null
      activitiesPanel.openPreset(preset)
    }
    // Volta de trilha.html (?plan=&step=): mesma ponte que "Preparar
    // atividade desta etapa" sempre usou, só que a etapa veio por query
    // string em vez de já estar em memória (a trilha grande vive numa
    // página separada, não pode passar o objeto direto).
    if (handoffs.etapa) {
      const { planId, stepId } = handoffs.etapa
      handoffs.etapa = null
      const etapa = PLANOS_REGISTRO[planId]?.etapas.find((e) => e.id === stepId)
      if (etapa) activitiesPanel.prefillFromPlano?.(etapa)
    }
  })

  return frag
}
