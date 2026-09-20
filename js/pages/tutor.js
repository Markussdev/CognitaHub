import { requireRole, signOut } from '../lib/auth.js'
import { initials, ageFrom, el } from '../lib/ui.js'
import { getAvatarUrl, setAvatarImage } from '../lib/avatar.js'
import { getTutorCycles } from '../data/tutor.js'
import { getActivityById } from '../data/activities.js'
import { PLANOS_REGISTRO } from '../data/planos-registro.js'
import { closeRailDrawer, wireRailToggle } from '../lib/rail.js'
import { DIGITAL_PRESETS } from '../data/digital-presets.js'
import { getTutorRegistrationState } from '../data/tutor-registration.js'
import { formatSchoolYear } from '../lib/school-year.js'
import { renderSessionForm, buildSessionsPanel } from './tutor/sessoes.js'
import { buildProfileView } from './tutor/perfil.js'
import { buildActivitiesPanel } from './tutor/atividades.js'
import { buildResumoPanel } from './tutor/resumo.js'
import { buildHomeView } from './tutor/home.js'
import { openSupportDrawer, closeSupportDrawer } from './tutor/support.js'
import { openCommandPalette, closeCommandPalette, wireCommandPalette, setRecentSessions } from './tutor/command-palette.js'
import { renderRail, setActiveNav, renderCrumb, switchTab, wireTabs } from './tutor/navigation.js'
import { buildPlanPanel } from './tutor/jornada.js'
import { firstName, formatDate, formatExecucaoQuando, simpleHead, REVIEW_STATUSES, formatLastSession, toList, monthsBetween, currentCycleMonth, buildLibraryHref, pickSuggestedActivity } from './tutor/shared.js'

const session = await requireRole('tutor')
const stateBox = document.querySelector('[data-tutor-state]')
const tutorRegistration = session ? await getTutorRegistrationState(session.user.id) : null
if (session && !tutorRegistration.error && !tutorRegistration.complete) {
  window.location.replace('/pages/candidatura-tutor.html')
}

// Detecta ?activity=<uuid> e pré-busca a atividade (vem da Biblioteca via "Usar no registro")
let pendingActivity = null
// Detecta ?plan=<id>&step=<id> (volta de trilha.html) — consumido em renderRecord
let pendingEtapaParams = null
{
  const _actParam = new URLSearchParams(location.search).get('activity')
  if (session && _actParam) {
    const { data: _actData } = await getActivityById(_actParam)
    if (_actData) {
      pendingActivity = {
        id: _actData.id,
        title: _actData.title,
        focus: _actData.skills?.label || '',
        nextStep: '',
      }
    }
  }
}

// Detecta ?preset=<slug> (vem da Biblioteca via "Personalizar para Mateus")
// — resolvido contra o registro local (js/data/digital-presets.js), sem
// round-trip ao banco. Consumido em renderRecord, abre o assistente de
// Atividades já no passo 2 com molde/tema/config prontos.
let pendingPreset = null
{
  const _presetSlug = new URLSearchParams(location.search).get('preset')
  if (_presetSlug && DIGITAL_PRESETS[_presetSlug]) pendingPreset = DIGITAL_PRESETS[_presetSlug]
}

// Detecta o retorno do Modo Condução (Biblioteca, atividade "com o tutor",
// js/pages/atividades.js) — handoff por sessionStorage, não URL: o payload
// pode ter texto livre (observação) e é consumo único (removido na leitura).
// Preenche o MESMO pendingActivity que "Usar no registro" já usa — só que
// com foco/próximo passo/duração vindos do que o tutor observou ao conduzir,
// não um fetch novo de activities.
{
  const _condKey = 'cognita:conducao-result'
  const _raw = sessionStorage.getItem(_condKey)
  if (_raw) {
    sessionStorage.removeItem(_condKey)
    try {
      const payload = JSON.parse(_raw)
      pendingActivity = {
        id: payload.activityId || null,
        title: payload.title || '',
        focus: payload.focus || '',
        nextStep: payload.nextStep || '',
        durationMinutes: payload.durationMinutes || null,
        observacaoInterna: payload.observacaoInterna || '',
      }
    } catch {
      // payload corrompido — ignora, o tutor cai no fluxo normal de registro.
    }
  }
}

document.querySelectorAll('[data-logout]').forEach((btn) => {
  btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
})

// goHome/goRecord/openSupportDrawer são function declarations definidas mais
// abaixo — hoisted, então o listener pode referenciá-las aqui sem problema de
// ordem (currentDerived é lido só no momento do clique, já populado).
document.querySelector('[data-rail-home]')?.addEventListener('click', (e) => { e.preventDefault(); goHome() })
document.querySelector('[data-rail-sessions]')?.addEventListener('click', (e) => { e.preventDefault(); goRecord('sessions') })

document.querySelector('[data-rail-library]')?.addEventListener('click', (e) => {
  e.preventDefault()
  const href = buildLibraryHref(currentDerived?.cycle)
  if (href) window.location.href = href
})
document.querySelector('[data-rail-team]')?.addEventListener('click', (e) => {
  e.preventDefault()
  const hasRecord = currentDerived && RECORD_STATES.includes(currentDerived.state)
  openSupportDrawer(hasRecord ? firstName(currentDerived.cycle.children?.name) : null)
})
document.querySelector('[data-rail-profile]')?.addEventListener('click', (e) => { e.preventDefault(); goProfile() })

// ── Drawer mobile do menu (rail) — Sprint 5A ─────────────────────────────────
// Drawer mobile do rail — wiring compartilhada em js/lib/rail.js (usada
// também por atividades.js). openRailDrawer/closeRailDrawer não moram mais
// aqui; closeRailDrawer segue importada porque o Escape abaixo precisa dela.
wireRailToggle()

// getCycle/goRecord resolvem, pro command palette, o que hoje é lido direto
// de currentDerived/RECORD_STATES/goRecord — nenhum dos três foi movido
// nesta missão, então o módulo recebe só o que precisa.
wireCommandPalette({
  getCycle: () => (currentDerived && RECORD_STATES.includes(currentDerived.state) ? currentDerived.cycle : null),
  goRecord,
})

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return }
  if (e.key === 'Escape') { closeSupportDrawer(); closeCommandPalette(); closeRailDrawer() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatList(value, fallback) {
  const list = toList(value)
  return list.length ? list.join(', ') : fallback
}

const ATTENTION_SPAN_LABEL = {
  short: 'Sessões bem curtas, de 5 a 10 minutos, com pausas frequentes.',
  medium: 'Sessões curtas, de 15 a 20 minutos, com pausas.',
  long: 'Consegue manter o foco por períodos mais longos, 30 minutos ou mais.',
}

function formatAttentionSpan(value, fallback) {
  if (!value) return fallback
  const label = ATTENTION_SPAN_LABEL[String(value).trim().toLowerCase()]
  return label ?? value
}

// ── Identidade (uma vez por sessão) ──────────────────────────────────────────

function fillIdentity() {
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

// ── Estados sem record (sem criança vinculada ainda) ──────────────────────────

function buildStatusCard({ kicker, title, desc, icon, tone = 'info' }) {
  const card = el('div', 'card status-state-card')
  const inner = el('div', 'status-card')
  const ico = el('div', `status-ico ${tone}`)
  ico.innerHTML = icon
  const body = el('div')
  body.append(
    el('p', 'status-kicker', kicker),
    el('h1', 'status-title', title),
    el('p', null, desc)
  )
  inner.append(ico, body)
  card.append(inner)
  return { card, body }
}

function renderPending() {
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'pending',
    title: 'Candidatura em análise',
    desc: 'A equipe Cognita vai revisar seu perfil e disponibilidade antes de liberar os pareamentos com crianças.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  })

  const steps = el('div', 'steps')
  steps.style.marginTop = '14px'
  ;[
    { n: '✓', label: 'Candidatura enviada', desc: 'Suas informações e seus aceites foram recebidos.', cls: 'done' },
    { n: '2', label: 'Revisão pela equipe', desc: 'A equipe analisa formação e disponibilidade.', cls: 'now' },
    { n: '3', label: 'Orientação inicial', desc: 'Encontro introdutório com a equipe Cognita.', cls: '' },
    { n: '4', label: 'Pareamento com criança', desc: 'Você recebe o perfil pedagógico e começa o acompanhamento.', cls: '' },
  ].forEach(({ n, label, desc, cls }) => {
    const step = el('div', `step${cls ? ` ${cls}` : ''}`)
    step.append(el('div', 'step-n', n))
    const copy = el('div')
    copy.append(el('b', null, label), el('p', null, desc))
    step.append(copy)
    steps.append(step)
  })
  body.append(steps)
  return card
}

function renderOrientationPending() {
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'pending',
    title: 'Orientação inicial pendente',
    desc: 'Antes do primeiro pareamento, a equipe Cognita faz uma orientação introdutória. Conclua as etapas abaixo.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  })

  const steps = el('div', 'steps')
  steps.style.marginTop = '14px'
  ;[
    { label: 'Ler os compromissos do tutor', desc: 'Leia e aceite o guia de atuação pedagógica inclusiva.' },
    { label: 'Treinar a escrita de resumo', desc: 'Pratique escrever resumos claros e respeitosos para os responsáveis.' },
    { label: 'Confirmar com a equipe', desc: 'Acuse recebimento da orientação com a equipe Cognita.' },
  ].forEach(({ label, desc }, i) => {
    const step = el('div', 'step')
    step.append(el('div', 'step-n', String(i + 1)))
    const copy = el('div')
    copy.append(el('b', null, label), el('p', null, desc))
    step.append(copy)
    steps.append(step)
  })
  body.append(steps)
  return card
}

function renderAvailable() {
  const { card } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'ok',
    title: 'Pronto para acompanhar',
    desc: 'Seu cadastro foi aprovado e a orientação inicial foi concluída. A equipe Cognita vai criar o pareamento quando houver compatibilidade de perfil e agenda.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
  })
  return card
}

function renderRejected() {
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'info',
    title: 'Candidatura recusada',
    desc: 'A equipe Cognita concluiu a análise e não foi possível aprovar sua candidatura neste momento.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8"/></svg>`,
  })
  body.append(el('p', 'card-copy', 'Se precisar entender a decisão ou os próximos passos, fale com a equipe Cognita.'))
  return card
}

function renderNoRecordError(retry) {
  const card = el('div', 'card')
  const inner = el('div', 'error-card')
  inner.append(
    el('strong', null, 'Não foi possível carregar os dados'),
    el('p', null, 'Verifique sua conexão e tente de novo.')
  )
  const btn = el('button', 'btn btn-ghost', 'Tentar novamente')
  btn.type = 'button'
  btn.addEventListener('click', retry)
  inner.append(btn)
  card.append(inner)
  return card
}

function renderNoRecord(state, retry) {
  const wrap = el('div', 'panel')
  if (state === 'pending') wrap.append(renderPending())
  else if (state === 'orientation_pending') wrap.append(renderOrientationPending())
  else if (state === 'application_rejected') wrap.append(renderRejected())
  else if (state === 'error') wrap.append(renderNoRecordError(retry))
  else wrap.append(renderAvailable())
  return wrap
}

// ── Painel: Visão geral ───────────────────────────────────────────────────────

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
  if (child.school_year) meta.append(el('span', 'meta-chip', formatSchoolYear(child.school_year)))

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
  // trabalho do Resumo. Sem "Registrar
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

function renderRecord(state, cycle, initialTab) {
  const frag = document.createDocumentFragment()

  let sessionForm
  const refreshSessions = async () => {
    const rows = await sessionsPanel.loadTable()
    setRecentSessions(rows)
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
  const resumoPanel = buildResumoPanel(cycle, {
    openForm,
    openPlan: () => switchTab('plan'),
    openSessions: () => switchTab('sessions'),
  })
  const sessionsPanel = buildSessionsPanel(cycle, state, sessionForm)
  const activitiesPanel = buildActivitiesPanel(cycle, state, { onSaved: refreshActivities, tutorId: session.user.id })
  const planPanel = buildPlanPanel(cycle, state)

  frag.append(header, tabs, resumoPanel, sessionsPanel, activitiesPanel, planPanel)

  queueMicrotask(() => {
    wireTabs()
    refreshSessions()
    refreshActivities()
    planPanel.loadStatus?.()
    if (initialTab && initialTab !== 'overview') switchTab(initialTab)
    if (pendingActivity && sessionForm) {
      const act = pendingActivity
      pendingActivity = null
      sessionForm.fillSuggestedActivity(act)
      requestAnimationFrame(() => sessionForm.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    // Vem da Biblioteca via "Personalizar para Mateus" (?preset=<slug>).
    if (pendingPreset && activitiesPanel.openPreset) {
      const preset = pendingPreset
      pendingPreset = null
      activitiesPanel.openPreset(preset)
    }
    // Volta de trilha.html (?plan=&step=): mesma ponte que "Preparar
    // atividade desta etapa" sempre usou, só que a etapa veio por query
    // string em vez de já estar em memória (a trilha grande vive numa
    // página separada, não pode passar o objeto direto).
    if (pendingEtapaParams) {
      const { planId, stepId } = pendingEtapaParams
      pendingEtapaParams = null
      const etapa = PLANOS_REGISTRO[planId]?.etapas.find((e) => e.id === stepId)
      if (etapa) activitiesPanel.prefillFromPlano?.(etapa)
    }
  })

  return frag
}

// ── Máquina de estados ────────────────────────────────────────────────────────

function deriveTutorState(profileStatus, cycles, applicationState) {
  if (applicationState === 'rejected') return { state: 'application_rejected' }
  if (REVIEW_STATUSES.includes(profileStatus)) return { state: 'pending' }
  if (profileStatus === 'orientation_pending') return { state: 'orientation_pending' } // TODO(wiring:profiles)

  if (!cycles?.length) return { state: 'available' }

  const active = cycles.find((c) => c.status === 'active')
  const planned = cycles.find((c) => c.status === 'planned')
  const paused = cycles.filter((c) => c.status === 'paused')
  const done = cycles.filter((c) => c.status === 'completed')

  if (active) return { state: 'cycle_active', cycle: active }
  if (planned) return { state: 'cycle_planned', cycle: planned }
  if (paused.length) return { state: 'cycle_paused', cycle: paused[0] }
  if (done.length) return { state: 'cycle_completed', cycle: done[0] }
  return { state: 'available' }
}

const RECORD_STATES = ['cycle_planned', 'cycle_active', 'cycle_paused', 'cycle_completed']

// ── Orquestrador / navegação Início ↔ Record ──────────────────────────────────

let currentDerived = null
let currentView = 'home'
let pendingTab = null

async function renderCurrentView() {
  if (!currentDerived || !stateBox) return

  if (currentView === 'profile') {
    setActiveNav('profile')
    renderCrumb('profile', '')
    stateBox.replaceChildren(buildProfileView(session, { cycleActive: currentDerived.state === 'cycle_active' }))
    return
  }

  const hasRecord = RECORD_STATES.includes(currentDerived.state)

  if (!hasRecord) {
    setActiveNav('home')
    renderCrumb('home', '')
    stateBox.replaceChildren(renderNoRecord(currentDerived.state, bootstrap))
    return
  }

  const childName = currentDerived.cycle.children?.name ?? 'Criança'
  setActiveNav(currentView)
  renderCrumb(currentView, childName)

  if (currentView === 'record') {
    const tab = pendingTab
    pendingTab = null
    stateBox.replaceChildren(renderRecord(currentDerived.state, currentDerived.cycle, tab))
  } else {
    stateBox.replaceChildren(el('div', 'skel skel-rec'), el('div', 'skel skel-panel'))
    const cycle = currentDerived.cycle
    const homeChild = cycle.children ?? {}
    const lp = homeChild.learning_profiles ?? {}
    const difficulties = toList(lp.math_difficulties).length ? lp.math_difficulties : homeChild.main_difficulties
    const frag = await buildHomeView(currentDerived.state, cycle, {
      tutorName: session.profile.name || 'tutor',
      openRecord: (tab) => goRecord(tab),
      openSupport: () => openSupportDrawer(firstName(homeChild.name)),
      libraryHref: buildLibraryHref(cycle),
      suggestedActivity: pickSuggestedActivity(difficulties).title,
      onSessionsLoaded: setRecentSessions,
    })
    stateBox.replaceChildren(frag)
  }
}

function goHome() {
  if (!currentDerived) return
  currentView = 'home'
  renderCurrentView()
}

function goRecord(tabId) {
  if (!currentDerived || !RECORD_STATES.includes(currentDerived.state)) return
  currentView = 'record'
  pendingTab = tabId ?? null
  renderCurrentView()
}

function goProfile() {
  if (!currentDerived) return
  currentView = 'profile'
  renderCurrentView()
}

async function bootstrap() {
  if (!stateBox) return

  stateBox.replaceChildren(el('div', 'skel skel-rec'), el('div', 'skel skel-panel'))
  renderRail(false, '', null, { openRecord: goRecord })
  renderCrumb('home', '')

  const { data: cycles, error } = await getTutorCycles(session.user.id)

  if (error) {
    currentDerived = { state: 'error' }
    stateBox.replaceChildren(renderNoRecord('error', bootstrap))
    return
  }

  currentDerived = deriveTutorState(session.profile.status, cycles, tutorRegistration.state)
  const hasRecord = RECORD_STATES.includes(currentDerived.state)
  renderRail(
    hasRecord,
    hasRecord ? firstName(currentDerived.cycle.children?.name) : '',
    currentDerived.state === 'cycle_active' ? currentDerived.cycle : null,
    { openRecord: goRecord }
  )
  const _urlParams = new URLSearchParams(location.search)
  const _viewParam = _urlParams.get('view')
  if (_viewParam === 'profile') {
    currentView = 'profile'
  } else if (pendingActivity && hasRecord) {
    currentView = 'record'
    pendingTab = 'sessions'
  } else if (_viewParam === 'record' && hasRecord) {
    // Volta do Modo Criança (?view=record&tab=sessions) — pousa direto na
    // aba pedida em vez de Início, pra "tutor registra a sessão" ser um
    // passo visível, não uma navegação escondida.
    currentView = 'record'
    pendingTab = _urlParams.get('tab') || null
    // Volta de trilha.html (?plan=<id>&step=<id>) — mesma ideia, mas pra
    // pré-preencher o form de "Preparar atividade" (ver renderRecord).
    const _planParam = _urlParams.get('plan')
    const _stepParam = _urlParams.get('step')
    if (_planParam && _stepParam) pendingEtapaParams = { planId: _planParam, stepId: _stepParam }
  } else {
    currentView = 'home'
  }
  await renderCurrentView()
}

if (session && stateBox && tutorRegistration?.error) {
  console.error(`Erro ao verificar candidatura do tutor (${tutorRegistration.step}):`, tutorRegistration.error)
  stateBox.replaceChildren(renderNoRecordError(() => window.location.reload()))
} else if (session && stateBox && tutorRegistration?.complete) {
  fillIdentity()
  await bootstrap()
}
