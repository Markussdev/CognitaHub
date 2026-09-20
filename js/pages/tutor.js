import { requireRole, signOut } from '../lib/auth.js'
import { initials, ageFrom, el } from '../lib/ui.js'
import { getAvatarUrl, setAvatarImage } from '../lib/avatar.js'
import { getTutorCycles, cancelTutorCycle } from '../data/tutor.js'
import { getActivityById } from '../data/activities.js'
import { PLANOS_REGISTRO } from '../data/planos-registro.js'
import {
  listPublishedTrailTemplates, getTrailTemplateWithModules, getLatestChildTrail,
  getChildTrailModules, getChildTrailMissions, assignChildTrail, releaseChildModule,
  advanceChildTrailModule, reopenChildTrailMission,
} from '../data/trilha-formal.js'
import { createPairingCode, listPairedDevices } from '../data/pareamento.js'
import { closeRailDrawer, wireRailToggle } from '../lib/rail.js'
import { DIGITAL_PRESETS } from '../data/digital-presets.js'
import { emblemaUrl, mascoteUrl } from '../lib/trilha-assets.js'
import { getModuleVisual } from '../data/module-visuals.js'
import { getTutorRegistrationState } from '../data/tutor-registration.js'
import { hasActiveTutorCycle } from '../lib/library-access.mjs'
import { formatSchoolYear } from '../lib/school-year.js'
import { renderSessionForm, buildSessionsPanel } from './tutor/sessoes.js'
import { buildProfileView } from './tutor/perfil.js'
import { buildActivitiesPanel } from './tutor/atividades.js'
import { buildResumoPanel } from './tutor/resumo.js'
import { buildHomeView } from './tutor/home.js'
import { firstName, formatDate, formatExecucaoQuando, simpleHead, REVIEW_STATUSES, kebabMenu, MISSION_STATUS_LABEL, formatLastSession, toList, monthsBetween, currentCycleMonth } from './tutor/shared.js'

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
// Href pra Biblioteca com o contexto completo da criança — usado pelo link
// do rail e pelo atalho "Abrir biblioteca de atividades" do ⌘K (antes cada
// um montava um subconjunto diferente de params; child_id sozinho já
// quebrava "Personalizar para Mateus"/recomendações se faltasse).
function buildLibraryHref(cycle) {
  if (!hasActiveTutorCycle(cycle)) return null
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const params = new URLSearchParams()
  const childFirst = firstName(child.name)
  if (childFirst) params.set('child', childFirst)
  if (child.id) params.set('child_id', child.id)
  if (cycle.id) params.set('cycle_id', cycle.id)
  const age = ageFrom(child.birth_date)
  if (age != null) params.set('age', String(age))
  // Sinais pra "Recomendadas" da Biblioteca (regra explícita, sem IA) — dado
  // que o painel já carregou, zero query extra em atividades.js.
  const difficulties = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
  if (difficulties.length) params.set('focus', difficulties.join(','))
  const formats = toList(lp.preferred_formats)
  if (formats.length) params.set('pref', formats.join(','))
  return 'atividades.html?' + params.toString()
}

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

document.querySelector('[data-cmdk-trigger]')?.addEventListener('click', openCommandPalette)
document.querySelector('[data-cmdk-backdrop]')?.addEventListener('click', closeCommandPalette)
document.querySelector('[data-cmdk-input]')?.addEventListener('input', (e) => renderCommandResults(e.target.value))
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

// Biblioteca local enxuta: a sugestão muda conforme o foco do ciclo em vez
// de ser sempre a mesma atividade fixa. TODO(wiring:activities): trocar por
// consulta à tabela activities quando ela existir.
const ACTIVITY_LIBRARY = {
  contagem: {
    title: 'Blocos de contagem coloridos', skill: 'contagem até 10',
    focus: 'contagem, adição simples e comparação de quantidades', time: '15-20 min',
    materials: 'blocos, tampinhas ou objetos pequenos',
    why: 'Combina com apoio visual e dura pouco — bom para sessões curtas.',
    nextStep: 'Repetir contagem até 10 com apoio visual e comparar dois grupos pequenos.',
  },
  'adição simples': {
    title: 'Soma com objetos concretos', skill: 'adição até 10',
    focus: 'adição simples com apoio visual', time: '15-20 min',
    materials: 'objetos pequenos ou desenhos',
    why: 'Trabalha a adição de forma concreta antes do cálculo abstrato.',
    nextStep: 'Avançar para somas com dois dígitos quando estiver confiante.',
  },
  'comparação de quantidades': {
    title: 'Qual grupo tem mais?', skill: 'comparação de quantidades',
    focus: 'comparar dois grupos de objetos', time: '10-15 min',
    materials: 'objetos pequenos de duas cores',
    why: 'Prepara o terreno para maior/menor antes da adição e subtração.',
    nextStep: 'Introduzir os símbolos de maior e menor depois da comparação visual.',
  },
  'sequência numérica': {
    title: 'Trilha numérica', skill: 'sequência de 1 a 10',
    focus: 'ordem numérica e reconhecimento dos números', time: '15-20 min',
    materials: 'cartões numerados ou trilha desenhada',
    why: 'Reforça a ordem dos números com movimento, bom para manter o foco.',
    nextStep: 'Aumentar a trilha até 20 quando a sequência até 10 estiver firme.',
  },
  subtração: {
    title: 'Tirando da coleção', skill: 'subtração até 10',
    focus: 'subtração simples com apoio concreto', time: '15-20 min',
    materials: 'objetos pequenos para retirar do grupo',
    why: 'Mostra a subtração como ação física antes do símbolo no papel.',
    nextStep: 'Registrar a subtração por escrito quando a ação concreta estiver clara.',
  },
}
const DEFAULT_ACTIVITY = ACTIVITY_LIBRARY.contagem

function pickSuggestedActivity(difficulties) {
  const list = toList(difficulties).map((d) => d.toLowerCase())
  const match = Object.keys(ACTIVITY_LIBRARY).find((key) =>
    list.some((d) => d.includes(key) || key.includes(d))
  )
  return match ? ACTIVITY_LIBRARY[match] : DEFAULT_ACTIVITY
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

// ── Rail / breadcrumb ─────────────────────────────────────────────────────────

function renderRail(hasRecord, childName, activeCycle = null) {
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
  link.addEventListener('click', (e) => { e.preventDefault(); goRecord() })
  slot.replaceChildren(link)
}

function setActiveNav(view) {
  const homeLink = document.querySelector('[data-rail-home]')
  const childLink = document.querySelector('[data-rail-child-slot] .rail-link')
  if (homeLink) homeLink.classList.toggle('active', view === 'home')
  if (childLink) childLink.classList.toggle('active', view === 'record')
}

function renderCrumb(view, childName) {
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

// ── Troca de aba ──────────────────────────────────────────────────────────────

function switchTab(id) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id))
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== id })
  if (id !== 'overview') return
  requestAnimationFrame(() => {
    document.querySelector('[data-panel="overview"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function wireTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  })
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

// ── Painel: Plano — resumo compacto (o mapa grande mora em trilha.html) ─────
// Não é navegação livre da criança — é o tutor decidindo a próxima etapa.
// Dado pedagógico e cálculo de status moram em data/planos-registro.js.
// Esta aba não tenta mostrar o mapa inteiro em um card compacto — responde rápido
// "qual é o plano, quanto já foi feito, qual a próxima ação", com um botão
// pra abrir a exploração de verdade em tela própria.

const MODULE_STATUS_LABEL = {
  bloqueado: 'Bloqueado',
  liberado: 'Liberado',
  aguardando_revisao: 'Aguardando revisão',
  concluido: 'Concluído',
}

// Sprint 6A ("modo demonstração") — reusa a sessão do tutor, sem
// pareamento próprio ainda. Sem ?demo=1 o app.js do app-crianca não teria
// como saber que é um teste do tutor, não a credencial final da criança.
function appendChildAppLink(container, cycle, label) {
  const link = el('a', 'btn btn-ghost btn-sm', label)
  link.href = `preview-crianca.html?${new URLSearchParams({ cycle_id: cycle.id }).toString()}`
  container.append(link)
}

// Currículo formal (Trilha → Módulo → Missão). Passagem funcional,
// sem redesenhar o mapa visual ainda (isso
// é a "Fase 6 — mapa de mundos" do roadmap, só depois de provar o dado
// real ponta a ponta). PLANOS_REGISTRO/trilha-plano.js/trilha.html
// continuam existindo mas não são mais alimentados por este painel.
function buildPlanPanel(cycle, state) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'plan'
  panel.hidden = true

  const podePreparar = state === 'cycle_active'
  const bloqueadoMsg = {
    cycle_planned: 'A jornada libera quando a equipe ativar o ciclo.',
    cycle_paused: 'A jornada fica bloqueada enquanto o ciclo estiver pausado.',
    cycle_completed: 'Este ciclo já foi concluído — a jornada abaixo fica só como histórico.',
  }[state]

  const childFirst = firstName(cycle.children?.name) || 'a criança'

  // Cabeçalho estável (identidade da jornada) + área de conteúdo (body) +
  // card de pareamento como utilitário SEPARADO — pareamento não pertence ao
  // ato de atribuir jornada, é ação à parte sobre o aparelho da criança.
  const container = el('div', 'journey')
  const header = el('header', 'journey-head')
  const headerText = el('div', 'journey-head-text')
  headerText.append(el('h3', 'journey-title', `Jornada de ${childFirst}`))
  const headerSub = el('p', 'journey-sub')
  headerText.append(headerSub)
  const mascot = el('img', 'journey-mascot')
  mascot.src = mascoteUrl('planejar')
  mascot.alt = ''
  mascot.hidden = true // só no estado vazio — dá identidade Cognita aos dois caminhos

  const journeyActions = el('div', 'journey-head-actions')

  if (['planned', 'active', 'paused'].includes(cycle.status)) {
    journeyActions.append(
      kebabMenu([
        {
          label: 'Cancelar ciclo',
          tone: 'bad',
          run: async () => {
            const confirmed = window.confirm(
              `Cancelar o acompanhamento de ${childFirst}?\n\n` +
              'O ciclo deixará de aparecer como ativo, mas os registros já feitos serão preservados.'
            )

            if (!confirmed) return

            const { error } = await cancelTutorCycle(cycle.id)

            if (error) {
              console.error('Erro ao cancelar ciclo:', error)
              window.alert(
                'Não foi possível cancelar o ciclo agora. Nenhuma alteração foi feita.'
              )
              return
            }

            window.location.reload()
          },
        },
      ])
    )
  }

  header.append(headerText, journeyActions, mascot)
  const body = el('div', 'journey-body')
  const deviceCard = renderDeviceCard()
  container.append(header, body, deviceCard)
  panel.append(container)

  function renderDeviceCard() {
    const card = el('div', 'card journey-device')
    const row = el('div', 'journey-device-row')
    const info = el('div', 'journey-device-info')
    info.append(el('p', 'journey-device-label', 'Dispositivo da criança'))
    const statusEl = el('p', 'journey-device-status', 'Verificando dispositivo…')
    info.append(statusEl)
    // Status REAL, não fixo: a criança pode já ter um aparelho pareado.
    listPairedDevices(cycle.child_id).then(({ data, error }) => {
      if (error) { statusEl.textContent = 'Conecte ou gerencie o dispositivo infantil'; return }
      const ativos = (data ?? []).filter((d) => !d.revoked_at)
      if (!ativos.length) { statusEl.textContent = 'Nenhum dispositivo conectado'; return }
      statusEl.textContent = ativos.length > 1
        ? `${ativos.length} dispositivos conectados`
        : `${ativos[0].device_name || 'Dispositivo'} conectado`
    })
    const pairBtn = el('button', 'btn btn-ghost btn-sm', 'Conectar dispositivo')
    pairBtn.type = 'button'
    row.append(info, pairBtn)
    card.append(row)

    const pairResult = el('div', 'trilha-pair-result')
    pairResult.hidden = true
    card.append(pairResult)

    pairBtn.addEventListener('click', async () => {
      pairBtn.disabled = true
      pairResult.hidden = true
      const { data: codigo, error: pairError } = await createPairingCode(cycle.child_id)
      pairBtn.disabled = false
      pairResult.hidden = false
      pairResult.replaceChildren()
      if (pairError) {
        const err = el('p', 'card-copy', 'Não foi possível gerar o código agora.')
        err.style.color = 'var(--bad)'
        pairResult.append(err)
        return
      }
      pairResult.append(el('p', 'trilha-pair-label', 'Código de pareamento — válido por 10 minutos'))
      pairResult.append(el('p', 'trilha-pair-code', codigo))
      pairResult.append(el('p', 'trilha-pair-hint', 'Digite este código na tela de pareamento do aparelho da criança.'))
    })
    return card
  }

  function blockedNoteEl() {
    if (!bloqueadoMsg) return null
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(bloqueadoMsg))
    return note
  }

  // Stepper dos módulos da criança (dado real): posição + status colorido.
  function renderStepper(modules, currentId) {
    const stepper = el('div', 'journey-stepper')
    modules.forEach((cm) => {
      const tm = cm.trail_modules
      const isCurrent = cm.id === currentId
      const node = el('div', `journey-step journey-step--${cm.status}${isCurrent ? ' journey-step--current' : ''}`)
      node.append(el('span', 'journey-step-dot', cm.status === 'concluido' ? '✓' : String(tm.position)))
      node.append(el('span', 'journey-step-label', tm.title))
      stepper.append(node)
    })
    return stepper
  }

  function renderErrorLine(container, message) {
    const err = el('p', 'card-copy', message)
    err.style.color = 'var(--bad)'
    container.append(err)
  }

  async function renderAssign() {
    mascot.hidden = false
    headerSub.textContent = 'Escolha um percurso recomendado ou monte um plano personalizado.'
    body.replaceChildren(el('p', 'card-copy journey-loading', 'Carregando percursos…'))

    const { data: templates, error } = await listPublishedTrailTemplates()
    if (error) {
      body.replaceChildren(el('p', 'card-copy', 'Não foi possível carregar os percursos agora.'))
      return
    }

    const choices = el('div', 'journey-choices')

    // Renderiza TODOS os percursos publicados (não só o primeiro) — quando
    // existir mais de uma jornada oficial, cada uma vira um card recomendado.
    // oficiais (todas) + privadas do tutor SÓ desta criança (defensivo — a
    // RLS já não devolve as de outra criança/outro tutor).
    const relevantes = (templates ?? []).filter((t) =>
      t.visibility !== 'private' || t.target_child_id === cycle.child_id)
    const comModulos = await Promise.all(
      relevantes.map((t) =>
        getTrailTemplateWithModules(t.id).then((r) => ({ template: t, modules: r.data ?? [] }))
      )
    )
    const renderaveis = comModulos.filter((x) => x.modules.length)

    if (!renderaveis.length) {
      const none = el('div', 'card journey-choice')
      none.append(el('h4', 'journey-choice-title', 'Nenhum percurso recomendado ainda'))
      none.append(el('p', 'journey-choice-desc', 'A equipe Cognita ainda não publicou um percurso — mas você pode montar uma jornada personalizada.'))
      choices.append(none, renderCustomJourneyCard())
      body.replaceChildren(choices)
      return
    }

    // oficiais (Recomendada) antes das privadas (Sua jornada)
    renderaveis.sort((a, b) =>
      (a.template.visibility === 'private' ? 1 : 0) - (b.template.visibility === 'private' ? 1 : 0))
    renderaveis.forEach(({ template, modules }) => {
      const badge = template.visibility === 'private' ? 'Sua jornada' : 'Recomendada'
      choices.append(renderRecommendedJourneyCard(template, modules, badge))
    })
    choices.append(renderCustomJourneyCard())
    body.replaceChildren(choices)
  }

  function renderRecommendedJourneyCard(template, modules, badgeLabel = 'Recomendada') {
    const card = el('div', 'card journey-choice journey-choice--recommended')
    card.append(el('span', 'journey-badge', badgeLabel))
    card.append(el('h4', 'journey-choice-title', template.title))
    if (template.description) card.append(el('p', 'journey-choice-desc', template.description))

    const totalMissoes = modules.reduce((s, m) => s + (m.mission_templates?.length || 0), 0)
    const meta = [
      `${modules.length} ${modules.length === 1 ? 'módulo' : 'módulos'}`,
      `${totalMissoes} ${totalMissoes === 1 ? 'missão' : 'missões'}`,
    ]
    if (template.age_min && template.age_max) meta.push(`${template.age_min}–${template.age_max} anos`)
    card.append(el('p', 'journey-choice-meta', meta.join(' · ')))

    card.append(el('p', 'journey-field-label', 'Começar em'))
    const radios = el('div', 'journey-radios')
    let selectedModuleId = modules[0]?.id
    modules.forEach((m, i) => {
      const opt = el('label', 'journey-radio')
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = `journey-start-module-${template.id}`
      input.value = m.id
      if (i === 0) input.checked = true
      input.addEventListener('change', () => { selectedModuleId = m.id })
      const visual = getModuleVisual(m.visual_key, i)
      const txt = el('span', 'journey-radio-text')
      txt.append(el('span', 'journey-radio-title', `Módulo ${m.position} — ${m.title}`))
      txt.append(el('span', 'journey-radio-sub', [visual.label, m.objective].filter(Boolean).join(' · ')))
      opt.append(input, txt)
      radios.append(opt)
    })
    card.append(radios)

    const bn = blockedNoteEl()
    if (bn) card.append(bn)

    if (podePreparar) {
      const btn = el('button', 'btn btn-accent journey-cta', `Começar jornada com ${childFirst}`)
      btn.type = 'button'
      btn.addEventListener('click', async () => {
        btn.disabled = true
        const { error: assignError } = await assignChildTrail({
          childId: cycle.child_id,
          cycleId: cycle.id,
          trailTemplateId: template.id,
          startingModuleId: selectedModuleId,
        })
        if (assignError) {
          btn.disabled = false
          renderErrorLine(card, assignError.message)
          return
        }
        load()
      })
      card.append(btn)
    }
    return card
  }

  // Porta pro builder (Fase 15). Faixa full-width abaixo dos percursos — é
  // uma AÇÃO (criar), não um percurso a atribuir, então não divide o grid.
  function renderCustomJourneyCard() {
    const card = el('div', 'card journey-choice journey-choice--custom')
    const txt = el('div', 'journey-custom-text')
    txt.append(el('h4', 'journey-choice-title', 'Criar jornada personalizada'))
    txt.append(el('p', 'journey-choice-desc', 'Organize suas atividades preparadas em módulos e missões.'))
    card.append(txt)
    const p = new URLSearchParams({ child_id: cycle.child_id ?? '', child_name: childFirst })
    if (cycle.id) p.set('cycle_id', cycle.id)
    const link = el('a', 'btn btn-ghost journey-cta', 'Criar jornada')
    link.href = `builder-jornada.html?${p.toString()}`
    card.append(link)
    return card
  }

  // Lista só os módulos CONCLUÍDOS como histórico compacto; o módulo atual
  // ganha um card próprio, único (antes o mesmo módulo aparecia duas vezes
  // — uma na lista "achatada" de todos os módulos, outra no card de
  // detalhe — o que ficava especialmente estranho quando só existe 1
  // módulo materializado, ex.: criança que começou direto no Módulo 2).
  async function renderTrail(childTrail) {
    const [{ data: modules, error }, { data: templateModules }] = await Promise.all([
      getChildTrailModules(childTrail.id),
      getTrailTemplateWithModules(childTrail.trail_template_id),
    ])
    if (error) {
      body.replaceChildren(el('p', 'card-copy', 'Não foi possível carregar os módulos.'))
      return
    }

    const totalModulos = templateModules?.length || modules.length

    body.replaceChildren()
    mascot.hidden = true
    headerSub.textContent = childTrail.trail_templates?.title || 'Jornada'

    if (childTrail.status === 'concluida') {
      body.append(el('p', 'trilha-complete-banner', 'Jornada concluída! 🎉'))
    } else if (childTrail.status === 'pausada') {
      body.append(el('p', 'card-copy', 'Esta jornada está pausada.'))
    }

    const bn = blockedNoteEl()
    if (bn) body.append(bn)

    const current = modules.find((cm) => cm.status !== 'concluido')

    // Progresso + stepper. A contagem de missões ("N de M") é preenchida
    // adiante, quando o módulo atual estiver liberado e as missões carregarem.
    const currentPos = current?.trail_modules?.position ?? totalModulos
    const progressEl = el('p', 'journey-progress', `Módulo ${currentPos} de ${totalModulos}`)
    body.append(progressEl)
    body.append(renderStepper(modules, current?.id))

    if (childTrail.status === 'concluida') {
      appendChildAppLink(body, cycle, 'Ver jornada concluída')
      // Só existe 1 jornada oficial hoje, então "de novo" = a mesma — variar
      // o que a criança refaz é decisão de currículo pra quando existir 2ª.
      if (podePreparar) {
        const denovoBtn = el('button', 'btn btn-accent btn-sm', 'Atribuir jornada de novo')
        denovoBtn.type = 'button'
        denovoBtn.addEventListener('click', () => renderAssign())
        body.append(denovoBtn)
      }
    }

    if (!current) return

    const tm = current.trail_modules
    const currentCard = el('div', 'trilha-current-card journey-current')
    const currentHead = el('div', 'trilha-current-head')
    currentHead.append(el('span', 'trilha-current-kicker', `Módulo atual · ${tm.position} de ${totalModulos}`))
    currentHead.append(el('span', `trilha-formal-status trilha-formal-status--${current.status}`, MODULE_STATUS_LABEL[current.status] || current.status))
    currentCard.append(currentHead)
    currentCard.append(el('h4', null, tm.title))
    if (tm.objective) currentCard.append(el('p', 'card-copy', tm.objective))

    if (current.status === 'bloqueado') {
      if (podePreparar) {
        // Jornada privada: as missões já carregam rodadas/nível definidos na
        // criação de cada atividade — perguntar de novo aqui duplicava a
        // configuração e criava conflito (qual valor vale, o da atividade ou
        // o da liberação?). Só a jornada oficial do Cognita mantém o ajuste
        // aqui, porque as missões dela não têm configuração própria por trás.
        const isPrivate = childTrail.trail_templates?.visibility === 'private'
        let rodadasInput = null
        let nivelInput = null

        if (!isPrivate) {
          const adaptRow = el('div', 'trilha-adapt-row')
          const rodadasField = el('div', 'trilha-adapt-field')
          rodadasField.append(el('label', null, 'Rodadas por missão'))
          rodadasInput = el('input')
          rodadasInput.type = 'number'
          rodadasInput.min = '1'
          rodadasInput.placeholder = 'Padrão'
          rodadasField.append(rodadasInput)
          adaptRow.append(rodadasField)

          const nivelField = el('div', 'trilha-adapt-field')
          nivelField.append(el('label', null, 'Nível'))
          nivelInput = el('input')
          nivelInput.type = 'number'
          nivelInput.min = '1'
          nivelInput.placeholder = 'Padrão'
          nivelField.append(nivelInput)
          adaptRow.append(nivelField)

          adaptRow.append(el('span', 'trilha-adapt-hint', 'Deixe vazio pra usar o padrão do currículo'))
          currentCard.append(adaptRow)
        }

        const btn = el('button', 'btn btn-accent btn-sm', 'Liberar módulo')
        btn.type = 'button'
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const adaptations = {}
          if (rodadasInput?.value) adaptations.rodadas = Number(rodadasInput.value)
          if (nivelInput?.value) adaptations.nivel = Number(nivelInput.value)
          const { error: releaseError } = await releaseChildModule({ childTrailModuleId: current.id, adaptations })
          if (releaseError) {
            btn.disabled = false
            renderErrorLine(currentCard, releaseError.message)
            return
          }
          load()
        })
        currentCard.append(btn)
      }
    } else {
      const { data: missions, error: missionsError } = await getChildTrailMissions(current.id)
      const podeReabrir = current.status === 'aguardando_revisao' && podePreparar
      let reopenPanel
      if (!missionsError && missions) {
        const missionsList = el('div', 'trilha-formal-missions')
        const concluidasN = missions.filter((m) => m.status === 'concluida').length
        progressEl.append(document.createTextNode(` · ${concluidasN} de ${missions.length} missões`))
        missions.forEach((cmi) => {
          const mt = cmi.mission_templates
          const row = el('div', 'trilha-formal-mission-row')
          const left = el('span', 'trilha-formal-mission-left')
          if (mt.emblema) {
            const emblem = el('img', 'journey-mission-emblem')
            emblem.src = emblemaUrl(mt.emblema)
            emblem.alt = ''
            left.append(emblem)
          }
          left.append(document.createTextNode(`${mt.position}. ${mt.title}`))
          row.append(left)
          row.append(el('span', `trilha-formal-status trilha-formal-status--${cmi.status}`, MISSION_STATUS_LABEL[cmi.status] || cmi.status))
          // Só faz sentido escolher uma missão pra repetir/adaptar quando o
          // módulo inteiro está em revisão (todas concluídas) — não durante
          // o módulo ainda em andamento.
          if (podeReabrir && cmi.status === 'concluida') {
            row.classList.add('trilha-formal-mission-row--selecionavel')
            row.tabIndex = 0
            row.setAttribute('role', 'button')
            row.addEventListener('click', () => abrirReopenPanel(cmi))
            row.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abrirReopenPanel(cmi) }
            })
          }
          missionsList.append(row)
        })
        currentCard.append(missionsList)
      }

      // Painel de repetir/adaptar — some até o tutor clicar numa missão
      // concluída da lista acima. Repetir/adaptar não são o caminho
      // principal (isso é "Avançar"); por isso ficam escondidos até
      // pedidos, não expostos por padrão.
      function abrirReopenPanel(missao) {
        reopenPanel.hidden = false
        reopenPanel.replaceChildren()
        reopenPanel.append(el('p', 'card-copy', `Repetir: ${missao.mission_templates.title}`))

        const adaptRow = el('div', 'trilha-adapt-row')
        const rodadasField = el('div', 'trilha-adapt-field')
        rodadasField.append(el('label', null, 'Rodadas'))
        const rodadasInput = el('input')
        rodadasInput.type = 'number'
        rodadasInput.min = '1'
        rodadasInput.placeholder = 'Padrão'
        rodadasField.append(rodadasInput)
        adaptRow.append(rodadasField)

        const nivelField = el('div', 'trilha-adapt-field')
        nivelField.append(el('label', null, 'Nível'))
        const nivelInput = el('input')
        nivelInput.type = 'number'
        nivelInput.min = '1'
        nivelInput.placeholder = 'Padrão'
        nivelField.append(nivelInput)
        adaptRow.append(nivelField)
        reopenPanel.append(adaptRow)

        const actionsRow = el('div', 'trilha-adapt-row')
        const repetirBtn = el('button', 'btn btn-ghost btn-sm', 'Repetir igual')
        repetirBtn.type = 'button'
        const adaptarBtn = el('button', 'btn btn-accent btn-sm', 'Adaptar e repetir')
        adaptarBtn.type = 'button'

        async function reabrir(adaptations) {
          repetirBtn.disabled = true
          adaptarBtn.disabled = true
          const { error: reopenError } = await reopenChildTrailMission({ missionId: missao.id, adaptations })
          if (reopenError) {
            repetirBtn.disabled = false
            adaptarBtn.disabled = false
            renderErrorLine(reopenPanel, reopenError.message)
            return
          }
          load()
        }

        repetirBtn.addEventListener('click', () => reabrir({}))
        adaptarBtn.addEventListener('click', () => {
          const adaptations = {}
          if (rodadasInput.value) adaptations.rodadas = Number(rodadasInput.value)
          if (nivelInput.value) adaptations.nivel = Number(nivelInput.value)
          reabrir(adaptations)
        })
        actionsRow.append(repetirBtn, adaptarBtn)
        reopenPanel.append(actionsRow)
      }

      if (podeReabrir) {
        reopenPanel = el('div', 'trilha-reopen-panel')
        reopenPanel.hidden = true
        currentCard.append(reopenPanel)
      }

      if (current.status === 'aguardando_revisao' && podePreparar) {
        const btn = el('button', 'btn btn-accent btn-sm', 'Avançar módulo')
        btn.type = 'button'
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const { error: advanceError } = await advanceChildTrailModule({ childTrailModuleId: current.id })
          if (advanceError) {
            btn.disabled = false
            renderErrorLine(currentCard, advanceError.message)
            return
          }
          load()
        })
        currentCard.append(btn)
      }
    }

    appendChildAppLink(currentCard, cycle, 'Pré-visualizar como criança')
    body.append(currentCard)
  }

  async function load() {
    body.replaceChildren(el('p', 'card-copy', 'Carregando…'))
    const { data: childTrail, error } = await getLatestChildTrail(cycle.child_id, cycle.id)
    if (error) {
      body.replaceChildren(el('p', 'card-copy', 'Não foi possível carregar a jornada agora.'))
      return
    }
    if (!childTrail) {
      await renderAssign()
      return
    }
    await renderTrail(childTrail)
  }

  panel.loadStatus = load

  return panel
}

// ── Central Cognita: drawer global de suporte ─────────────────────────────────
// Suporte é utilitário global (qualquer tela pode abrir), não um recurso do
// acompanhamento de uma criança — por isso vive num slide-over, não numa aba.

function buildSupportDrawerContent(childName) {
  const frag = document.createDocumentFragment()

  if (childName) {
    const ctx = el('div', 'support-context')
    ctx.append(document.createTextNode('Sobre: '), el('b', null, childName))
    frag.append(ctx)
  }

  // Contato honesto: sem o formulário que não persistia (o antigo "Enviar
  // para equipe" só guardava local). Enquanto não existir fluxo de
  // support_requests, o canal real é e-mail/WhatsApp da equipe Cognita.
  frag.append(el('p', 'card-copy', 'Precisa de ajuda com o acompanhamento? Fale direto com a equipe Cognita. Tempo médio de resposta: até 48h.'))

  const contactActions = el('div', 'rec-actions')
  contactActions.style.cssText = 'gap:8px;flex-direction:column;align-items:stretch'
  const mail = el('a', 'btn btn-accent btn-sm', 'Enviar e-mail')
  mail.href = `mailto:cognitahub1@gmail.com?subject=${encodeURIComponent(childName ? `Ajuda no ciclo de ${childName}` : 'Ajuda no Cognita Hub')}`
  const whats = el('a', 'btn btn-ghost btn-sm', 'Chamar no WhatsApp')
  whats.href = 'https://wa.me/559182050907'
  whats.target = '_blank'; whats.rel = 'noopener'
  contactActions.append(mail, whats)
  frag.append(contactActions)

  return frag
}

function openSupportDrawer(childName) {
  const body = document.querySelector('[data-support-body]')
  const drawer = document.querySelector('[data-support-drawer]')
  const backdrop = document.querySelector('[data-support-backdrop]')
  if (!body || !drawer || !backdrop) return
  body.replaceChildren(buildSupportDrawerContent(childName))
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

function closeSupportDrawer() {
  document.querySelector('[data-support-drawer]')?.classList.remove('open')
  document.querySelector('[data-support-backdrop]')?.classList.remove('open')
  document.querySelector('[data-support-drawer]')?.setAttribute('aria-hidden', 'true')
}

document.querySelector('[data-support-close]')?.addEventListener('click', closeSupportDrawer)
document.querySelector('[data-support-backdrop]')?.addEventListener('click', closeSupportDrawer)

// ── Busca / command palette (local, V1 só navega dentro da própria tela) ─────

let recentSessionsCache = []

const CMDK_ICONS = {
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>`,
  book: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  team: `<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  history: `<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>`,
}

function getCommandGroups() {
  const hasRecord = currentDerived && RECORD_STATES.includes(currentDerived.state)
  const cycle = hasRecord ? currentDerived.cycle : null
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

function openCommandPalette() {
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

function closeCommandPalette() {
  document.querySelector('[data-cmdk]')?.classList.remove('open')
  document.querySelector('[data-cmdk-backdrop]')?.classList.remove('open')
}

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
    recentSessionsCache = rows
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
      onSessionsLoaded: (rows) => { recentSessionsCache = rows },
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
  renderRail(false, '', null)
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
    currentDerived.state === 'cycle_active' ? currentDerived.cycle : null
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
