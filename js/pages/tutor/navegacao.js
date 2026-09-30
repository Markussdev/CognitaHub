// Navegação Início ↔ Acompanhamento ↔ Perfil e carga inicial dos ciclos do tutor.
// Guarda a view atual; o que as outras partes precisam saber (ciclo derivado,
// sessões recentes) fica em state.js.
import { getTutorCycles } from '../../data/tutor.js'
import { el } from '../../lib/ui.js'
import { RECORD_STATES, deriveTutorState, renderNoRecord } from './estados.js'
import { firstName } from './helpers.js'
import { buildHomeView } from './home.js'
import { buildProfileView } from './perfil.js'
import { renderRecord } from './record.js'
import { renderCrumb, renderRail, setActiveNav } from './shell.js'
import { current, handoffs, session } from './state.js'

export const stateBox = document.querySelector('[data-tutor-state]')

let currentView = 'home'
let pendingTab = null

export async function renderCurrentView() {
  if (!current.derived || !stateBox) return

  if (currentView === 'profile') {
    setActiveNav('profile')
    renderCrumb('profile', '')
    stateBox.replaceChildren(buildProfileView())
    return
  }

  const hasRecord = RECORD_STATES.includes(current.derived.state)

  if (!hasRecord) {
    setActiveNav('home')
    renderCrumb('home', '')
    stateBox.replaceChildren(renderNoRecord(current.derived.state, bootstrap))
    return
  }

  const childName = current.derived.cycle.children?.name ?? 'Criança'
  setActiveNav(currentView)
  renderCrumb(currentView, childName)

  if (currentView === 'record') {
    const tab = pendingTab
    pendingTab = null
    stateBox.replaceChildren(renderRecord(current.derived.state, current.derived.cycle, tab))
  } else {
    stateBox.replaceChildren(el('div', 'skel skel-rec'), el('div', 'skel skel-panel'))
    const frag = await buildHomeView(current.derived.state, current.derived.cycle, (tab) => goRecord(tab))
    stateBox.replaceChildren(frag)
  }
}

export function goHome() {
  if (!current.derived) return
  currentView = 'home'
  renderCurrentView()
}

export function goRecord(tabId) {
  if (!current.derived || !RECORD_STATES.includes(current.derived.state)) return
  currentView = 'record'
  pendingTab = tabId ?? null
  renderCurrentView()
}

export function goProfile() {
  if (!current.derived) return
  currentView = 'profile'
  renderCurrentView()
}

export async function bootstrap() {
  if (!stateBox) return

  stateBox.replaceChildren(el('div', 'skel skel-rec'), el('div', 'skel skel-panel'))
  renderRail(false, '', goRecord)
  renderCrumb('home', '')

  const { data: cycles, error } = await getTutorCycles(session.user.id)

  if (error) {
    current.derived = { state: 'error' }
    stateBox.replaceChildren(renderNoRecord('error', bootstrap))
    return
  }

  current.derived = deriveTutorState(session.profile.status, cycles)
  const hasRecord = RECORD_STATES.includes(current.derived.state)
  renderRail(hasRecord, hasRecord ? firstName(current.derived.cycle.children?.name) : '', goRecord)
  const _urlParams = new URLSearchParams(location.search)
  const _viewParam = _urlParams.get('view')
  if (_viewParam === 'profile') {
    currentView = 'profile'
  } else if (handoffs.activity && hasRecord) {
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
    if (_planParam && _stepParam) handoffs.etapa = { planId: _planParam, stepId: _stepParam }
  } else {
    currentView = 'home'
  }
  await renderCurrentView()
}
