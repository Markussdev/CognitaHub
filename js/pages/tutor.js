import { supabase } from '../lib/supabase.js'
import { requireRole, signOut } from '../lib/auth.js'
import { greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getAvatarUrl, setAvatarImage } from '../lib/avatar.js'
import { getTutorCycles } from '../data/tutor.js'
import { getCycleSessions, createSessionWithExecucoes } from '../data/sessions.js'
import { getActivityById } from '../data/activities.js'
import { createChildActivity, listChildActivities, updateChildActivity, archiveChildActivity } from '../data/child-activities.js'
import { listPendingExecucoes, listRecentExecucoes } from '../data/atividade-execucao.js'
import { MOLDES_REGISTRO, buildContractFromParts, formatConfigResumo } from '../data/moldes-registro.js'
import { PLANOS_REGISTRO } from '../data/planos-registro.js'
import {
  listPublishedTrailTemplates, getTrailTemplateWithModules, getLatestChildTrail,
  getChildTrailModules, getChildTrailMissions, assignChildTrail, releaseChildModule,
  advanceChildTrailModule, reopenChildTrailMission,
} from '../data/trilha-formal.js'
import { createPairingCode, listPairedDevices } from '../data/pareamento.js'
import { derivarEstadoResumo, ESTADOS_RESUMO, moduloAtualDe } from './resumo-estado.js'

const session = await requireRole('tutor')
const stateBox = document.querySelector('[data-tutor-state]')
const profileReturn = new URLSearchParams(location.search).get('return') || ''

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
  const cycle = currentDerived?.cycle
  if (!cycle) { window.location.href = 'atividades.html'; return }
  const params = new URLSearchParams()
  const childFirst = firstName(cycle.children?.name)
  if (childFirst) params.set('child', childFirst)
  if (cycle.id) params.set('cycle_id', cycle.id)
  window.location.href = 'atividades.html?' + params.toString()
})
document.querySelector('[data-rail-team]')?.addEventListener('click', (e) => {
  e.preventDefault()
  const hasRecord = currentDerived && RECORD_STATES.includes(currentDerived.state)
  openSupportDrawer(hasRecord ? firstName(currentDerived.cycle.children?.name) : null)
})
document.querySelector('[data-rail-profile]')?.addEventListener('click', (e) => { e.preventDefault(); goProfile() })

// ── Drawer mobile do menu (rail) — Sprint 5A ─────────────────────────────────
// O CSS (@media em tutor.html) já escondia o rail fora da tela em ≤940px,
// mas não existia como reabri-lo — o tutor no celular ficava preso na tela
// Início. É só um toggle: no desktop o botão nem aparece (display:none fora
// da media query), então .open nunca é aplicada lá e o menu não muda.
function openRailDrawer() {
  document.querySelector('[data-rail]')?.classList.add('open')
  document.querySelector('[data-rail-backdrop]')?.classList.add('open')
  document.querySelector('[data-rail-toggle]')?.setAttribute('aria-expanded', 'true')
  document.body.classList.add('rail-drawer-open')
  document.querySelector('[data-rail] .rail-link')?.focus()
}

// returnFocus:false quando fecha por ter escolhido um link/botão de verdade
// (a ação clicada já vai levar o foco pra outro lugar); true nos outros casos
// (backdrop, Escape, toggle) — aí faz sentido devolver o foco pro hambúrguer.
function closeRailDrawer({ returnFocus = true } = {}) {
  document.querySelector('[data-rail]')?.classList.remove('open')
  document.querySelector('[data-rail-backdrop]')?.classList.remove('open')
  document.querySelector('[data-rail-toggle]')?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('rail-drawer-open')
  if (returnFocus) document.querySelector('[data-rail-toggle]')?.focus()
}

document.querySelector('[data-rail-toggle]')?.addEventListener('click', () => {
  const rail = document.querySelector('[data-rail]')
  if (rail?.classList.contains('open')) closeRailDrawer()
  else openRailDrawer()
})
document.querySelector('[data-rail-backdrop]')?.addEventListener('click', () => closeRailDrawer())
// Delegado: qualquer link/botão dentro do rail fecha o drawer, sem precisar
// tocar nos handlers de Início/criança/Biblioteca/Sessões/equipe/perfil.
document.querySelector('[data-rail]')?.addEventListener('click', (e) => {
  if (e.target.closest('a, button')) closeRailDrawer({ returnFocus: false })
})

document.querySelector('[data-cmdk-trigger]')?.addEventListener('click', openCommandPalette)
document.querySelector('[data-cmdk-backdrop]')?.addEventListener('click', closeCommandPalette)
document.querySelector('[data-cmdk-input]')?.addEventListener('input', (e) => renderCommandResults(e.target.value))
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return }
  if (e.key === 'Escape') { closeSupportDrawer(); closeCommandPalette(); closeRailDrawer() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

// ── Avatar (Supabase Storage, bucket privado) ─────────────────────────────────

function getFileExt(file) {
  return file.name.split('.').pop()?.toLowerCase() || 'png'
}

function validateAvatarFile(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WEBP.')
  if (file.size > 2 * 1024 * 1024) throw new Error('A imagem precisa ter até 2MB.')
}

async function uploadTutorAvatar(file) {
  validateAvatarFile(file)
  const filePath = `${session.user.id}/avatar-${Date.now()}.${getFileExt(file)}`
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(filePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_path: filePath })
    .eq('id', session.user.id)
  if (profileError) throw profileError
  session.profile.avatar_path = filePath
  return filePath
}

function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00Z`)
  return isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

function formatLastSession(value) {
  if (!value) return 'sem registro'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return formatDate(value) ?? 'sem registro'

  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.max(0, Math.round((base - date) / 86400000))
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays <= 30) return `há ${diffDays} dias`
  return formatDate(value) ?? 'sem registro'
}

// Timestamp completo (com hora) das execuções do Modo Criança — diferente
// de formatLastSession, que só lida com datas puras (coluna `date` de
// sessions). "hoje às 14:32" em vez de só "hoje", porque o tutor pode
// registrar mais de uma execução no mesmo dia e precisa diferenciá-las.
function formatExecucaoQuando(isoTimestamp) {
  if (!isoTimestamp) return null
  const d = new Date(isoTimestamp)
  if (isNaN(d.getTime())) return null

  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((base - dayOnly) / 86400000)

  if (diffDays === 0) return `hoje às ${hora}`
  if (diffDays === 1) return `ontem às ${hora}`
  const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
  return `${dataCurta} às ${hora}`
}

function formatDuracaoAprox(segundos) {
  if (!segundos) return null
  if (segundos < 60) return `${segundos}s`
  return `${Math.round(segundos / 60)} min`
}

const COMO_ENCERROU_LABEL = {
  crianca_concluiu: 'Concluída',
  adulto_encerrou: 'Encerrada pelo adulto',
  pausa: 'Pausada',
  recusa: 'Recusada',
}

function monthsBetween(start, end) {
  if (!start || !end) return 6
  const s = new Date(`${start}T00:00:00Z`), e = new Date(`${end}T00:00:00Z`)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 6
  return Math.max(1, (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()))
}

function currentCycleMonth(start, end) {
  if (!start) return 1
  const now = new Date(), s = new Date(`${start}T00:00:00Z`)
  if (isNaN(s.getTime())) return 1
  const total = monthsBetween(start, end)
  const elapsed = (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + (now.getUTCMonth() - s.getUTCMonth()) + 1
  return Math.min(Math.max(elapsed, 1), total)
}

function firstName(fullName) {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'criança'
}

// Supabase embute relação 1:1 via FK (child_activities em atividade_execucao)
// ora como objeto, ora como array de 1 — normaliza pros dois formatos.
function pickEmbedded(value) {
  return Array.isArray(value) ? value[0] : value
}

function simpleHead(title) {
  const head = el('div', 'card-h')
  head.append(el('h3', null, title))
  return head
}

function renderFeedItems(container, items) {
  container.replaceChildren()
  items.forEach((item) => {
    const row = el('div', 'feed-item')
    const ico = el('div', `feed-ico ${item.tone}`)
    ico.innerHTML = item.icon
    const tx = el('div', 'feed-tx')
    tx.innerHTML = item.html
    if (item.sub) tx.append(el('span', 'sub', item.sub))
    row.append(ico, tx)
    if (item.time) row.append(el('div', 'feed-time', item.time))
    container.append(row)
  })
}

// Normaliza valores que podem chegar como array real, JSON stringificado
// ("[\"a\",\"b\"]") ou literal de array do Postgres ("{a,\"b c\"}") — o
// schema real mistura os três conforme a coluna foi preenchida.
function toList(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value !== 'string') return [String(value)]

  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1)
    if (!inner) return []
    return (inner.match(/"(?:[^"\\]|\\.)*"|[^,]+/g) || [])
      .map((s) => s.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'))
      .filter(Boolean)
  }
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch { /* não era JSON válido — trata como texto simples abaixo */ }
  }
  return [trimmed]
}

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

function renderRail(hasRecord, childName) {
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
  const card = el('div', 'card')
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
    { n: '✓', label: 'Cadastro enviado', desc: 'Suas informações foram recebidas.', cls: 'done' },
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
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'ok',
    title: 'Pronto para acompanhar',
    desc: 'Seu cadastro foi aprovado e a orientação inicial foi concluída. A equipe Cognita vai criar o pareamento quando houver compatibilidade de perfil e agenda.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
  })
  const link = el('a', 'lib-link', 'Explorar biblioteca de atividades →')
  link.href = 'atividades.html'
  body.append(link)
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
  else if (state === 'error') wrap.append(renderNoRecordError(retry))
  else wrap.append(renderAvailable())
  return wrap
}

// ── Escalas do formulário de sessão ──────────────────────────────────────────

function makeScaleGroup(options) {
  const group = el('div', 'scale')
  group.setAttribute('role', 'radiogroup')
  let value = ''
  const buttons = []

  options.forEach(({ label, val, tone }) => {
    const cls = ['scale-btn', tone ? `scale-btn--${tone}` : ''].filter(Boolean).join(' ')
    const btn = el('button', cls, label)
    btn.type = 'button'
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('selected'))
      btn.classList.add('selected')
      value = val
    })
    buttons.push(btn)
    group.append(btn)
  })

  return {
    group,
    getValue: () => value,
    reset: () => { value = ''; buttons.forEach((b) => b.classList.remove('selected')) },
  }
}

const LOCK_SVG = '<svg class="scale-btn-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>'

// Igual a makeScaleGroup, mas com suporte a opção desabilitada (cadeado +
// "em breve") — precisa disso pros moldes/temas que ainda não existem
// aparecerem no form sem serem clicáveis. selectedId escolhe o item ativo
// de largada.
function makeChoiceButtons(options, selectedId, onChange) {
  const group = el('div', 'scale')
  group.setAttribute('role', 'radiogroup')
  let value = selectedId
  const entries = []

  // Compartilhada entre o clique real e o setValue programático (Duplicar/
  // Editar pré-preenchendo o form) — as duas vias precisam do mesmo efeito
  // colateral (destacar visualmente e disparar onChange pra reconstruir
  // tema/config na cascata).
  function select(id) {
    const entry = entries.find((e) => e.id === id)
    if (!entry || entry.disabled) return
    entries.forEach((e) => e.btn.classList.remove('selected'))
    entry.btn.classList.add('selected')
    value = id
    onChange?.(id)
  }

  options.forEach(({ id, label, disabled }) => {
    const btn = el('button', 'scale-btn')
    btn.type = 'button'
    btn.disabled = !!disabled
    if (disabled) {
      btn.innerHTML = LOCK_SVG
      btn.append(document.createTextNode(`${label} · em breve`))
    } else {
      btn.textContent = label
    }
    if (id === selectedId) btn.classList.add('selected')
    btn.addEventListener('click', () => select(id))
    entries.push({ id, disabled, btn })
    group.append(btn)
  })

  return { group, getValue: () => value, setValue: select }
}

// Slider — pra faixas largas ("de sensação contínua", ex.: quantos itens).
function makeSlider({ label, min, max, value, onChange }) {
  const field = el('div', 'field')
  const head = el('div', 'slider-head')
  head.append(el('label', null, label))
  const valueBox = el('span', 'slider-value num', String(value))
  head.append(valueBox)
  field.append(head)

  const input = document.createElement('input')
  input.type = 'range'
  input.className = 'slider-input'
  input.min = String(min)
  input.max = String(max)
  input.value = String(value)

  let current = value
  function setValue(v) {
    current = Number(v)
    input.value = String(current)
    valueBox.textContent = String(current)
    onChange?.(current)
  }
  input.addEventListener('input', () => setValue(input.value))

  field.append(input)
  return { field, getValue: () => current, setValue }
}

// Pills numeradas — pra faixas curtas e precisas (ex.: nível, rodadas).
function makePillSelector({ label, min, max, value, onChange }) {
  const field = el('div', 'field')
  field.append(el('label', null, label))
  const row = el('div', 'pill-select-row')

  let current = value
  const buttons = []
  const values = []
  function setValue(n) {
    const idx = values.indexOf(n)
    if (idx === -1) return
    buttons.forEach((b) => b.classList.remove('selected'))
    buttons[idx].classList.add('selected')
    current = n
    onChange?.(current)
  }
  for (let n = min; n <= max; n += 1) {
    const btn = el('button', 'pill-num', String(n))
    btn.type = 'button'
    if (n === value) btn.classList.add('selected')
    btn.addEventListener('click', () => setValue(n))
    buttons.push(btn)
    values.push(n)
    row.append(btn)
  }

  field.append(row)
  return { field, getValue: () => current, setValue }
}

// ── Formulário de sessão (3 níveis) ──────────────────────────────────────────

function renderSessionForm(cycle, onSaved) {
  const details = el('details', 'card form')
  const childName = firstName(cycle.children?.name)
  let _selectedActivityId = null
  let _allPending = []

  const summary = document.createElement('summary')
  summary.append(document.createTextNode('Registro guiado — sessão desta semana'))
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  chevron.setAttribute('viewBox', '0 0 24 24')
  chevron.setAttribute('aria-hidden', 'true')
  chevron.innerHTML = '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  summary.append(chevron)
  details.append(summary)

  const body = el('div', 'form-body')

  body.append(el('div', 'lvl', '1 · Dados estruturados — aparecem para todos'))

  // Execuções do Modo Criança ainda sem registro (session_id nulo) — o
  // tutor escolhe uma em vez de digitar de novo o que a casca já gravou
  // sozinha em atividade_execucao (ver docs/supabase-fase-4c-registro-sessao.sql).
  const pendingWrap = el('div', 'pending-execucoes')
  pendingWrap.hidden = true
  body.append(pendingWrap)

  // Cada item mostra o suficiente pra diferenciar execuções que, no molde
  // contar/dinossauros de hoje, sempre têm a mesma cara (nível 1, mesmo
  // tema) — sem isso o tutor não sabe se são duas execuções de verdade ou
  // uma tela duplicada (ver docs/V2-DIRECAO.md §8, higiene de dados).
  function renderPendingExecucaoItem(execucao, checked) {
    const item = el('div', 'pending-execucao-item')
    const molde = MOLDES_REGISTRO[execucao.molde]
    const temaLabel = molde?.temas.find((t) => t.id === execucao.tema)?.label || execucao.tema
    const atividade = pickEmbedded(execucao.child_activities)
    const titulo = atividade?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || execucao.molde} · ${temaLabel}`

    const detalhes = [
      `Nível ${execucao.nivel_final ?? '—'}`,
      atividade?.config?.quantidade ? `${atividade.config.quantidade} itens` : null,
      atividade?.config?.rodadas ? `${atividade.config.rodadas} rodada${atividade.config.rodadas === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ')

    const quando = formatExecucaoQuando(execucao.created_at)
    const rodape = [
      quando ? `Feita ${quando}` : null,
      COMO_ENCERROU_LABEL[execucao.como_encerrou],
      formatDuracaoAprox(execucao.tempo_aproximado_segundos),
      execucao.precisou_mais_facil ? 'precisou de mais fácil' : null,
    ].filter(Boolean).join(' · ')

    // Checkbox em vez de "Usar esta execução" (singular): UMA sessão pode
    // cobrir VÁRIAS execuções — a criança faz várias missões numa experiência
    // e o tutor escreve uma devolutiva só. Ver docs/supabase-fase-14-*.sql.
    const check = el('label', 'pending-execucao-check')
    const cb = document.createElement('input')
    cb.type = 'checkbox'; cb.checked = checked; cb.dataset.execId = execucao.id
    cb.addEventListener('change', updateSelectionUI)
    check.append(cb, document.createTextNode('Incluir nesta sessão'))

    item.append(
      el('strong', null, titulo),
      el('p', 'pending-execucao-detalhes', detalhes),
      el('p', 'pending-execucao-rodape', rodape),
      check
    )
    return item
  }

  function collectCheckedExecucoes() {
    const ids = new Set([...pendingWrap.querySelectorAll('input[data-exec-id]:checked')].map((cb) => cb.dataset.execId))
    return _allPending.filter((e) => ids.has(e.id))
  }

  // Preenche o Nível 1 a partir do conjunto marcado. Com 1 execução, igual ao
  // antigo fillFromExecucao; com várias, título/foco/duração agregados.
  function fillFromExecucoes(execucoes) {
    if (!execucoes.length) return
    const tituloDe = (e) => {
      const molde = MOLDES_REGISTRO[e.molde]
      const temaLabel = molde?.temas.find((t) => t.id === e.tema)?.label || e.tema
      const atividade = pickEmbedded(e.child_activities)
      return atividade?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || e.molde} · ${temaLabel}`
    }
    const titulos = execucoes.map(tituloDe)
    actInput.value = execucoes.length === 1 ? titulos[0] : `${execucoes.length} atividades: ${titulos.join(', ')}`
    focusInput.value = [...new Set(execucoes.map((e) => MOLDES_REGISTRO[e.molde]?.label || e.molde))].join(', ')
    const totalSeg = execucoes.reduce((s, e) => s + (e.tempo_aproximado_segundos || 0), 0)
    if (totalSeg) durInput.value = String(Math.round(totalSeg / 60))
    _selectedActivityId = null
    details.open = true
    updateFamilyPreview()
  }

  const applyBtn = el('button', 'btn btn-ghost btn-sm', 'Preencher com a seleção')
  applyBtn.type = 'button'
  applyBtn.addEventListener('click', () => fillFromExecucoes(collectCheckedExecucoes()))

  function updateSelectionUI() {
    const n = collectCheckedExecucoes().length
    applyBtn.textContent = n > 0 ? `Preencher com a seleção (${n})` : 'Preencher com a seleção'
    applyBtn.disabled = n === 0
  }

  // Fica sempre visível (mesmo vazio) — estado vazio é direção, não
  // decoração (CLAUDE.md §11): o tutor precisa saber que essa área existe
  // antes mesmo da primeira execução aparecer nela.
  async function loadPendingExecucoes() {
    pendingWrap.replaceChildren()
    pendingWrap.hidden = false
    const { data, error } = await listPendingExecucoes(cycle.child_id, cycle.id)

    if (error) {
      pendingWrap.append(el('p', 'execucoes-msg', 'Não conseguimos carregar as execuções pendentes agora.'))
      return
    }

    pendingWrap.append(el('p', 'pending-execucoes-label', 'Execuções do Modo Criança aguardando registro'))
    _allPending = data ?? []
    if (!_allPending.length) {
      pendingWrap.append(el('p', 'execucoes-msg', 'Nenhuma execução pendente. Quando a criança concluir uma atividade, ela aparecerá aqui para virar registro de sessão.'))
      return
    }

    // Pré-marca as execuções do dia mais recente (uma "experiência"); o tutor
    // ajusta. A lista já vem desc por created_at (listPendingExecucoes).
    const topDay = new Date(_allPending[0].created_at).toDateString()
    pendingWrap.append(el('p', 'execucoes-msg', 'Marque as atividades desta sessão — várias podem virar um registro só. As do dia mais recente já vêm marcadas.'))
    _allPending.forEach((e) => {
      const doDia = new Date(e.created_at).toDateString() === topDay
      pendingWrap.append(renderPendingExecucaoItem(e, doDia))
    })
    pendingWrap.append(applyBtn)
    updateSelectionUI()
    fillFromExecucoes(collectCheckedExecucoes()) // auto-preenche com o cluster do dia
  }
  loadPendingExecucoes()

  const row1 = el('div', 'row')
  const dateField = el('div', 'field')
  const dateLabel = document.createElement('label')
  dateLabel.textContent = 'Data da sessão'
  const dateInput = document.createElement('input')
  dateInput.type = 'date'; dateInput.value = todayISO(); dateInput.required = true
  dateField.append(dateLabel, dateInput)

  const durField = el('div', 'field')
  const durLabel = document.createElement('label')
  durLabel.textContent = 'Duração (minutos)'
  const durInput = document.createElement('input')
  durInput.type = 'number'; durInput.min = '0'; durInput.placeholder = 'Ex.: 45'
  durField.append(durLabel, durInput)

  row1.append(dateField, durField)
  body.append(row1)

  const actField = el('div', 'field')
  const actLabel = document.createElement('label')
  actLabel.textContent = 'Atividade realizada *'
  const actInput = document.createElement('input')
  actInput.type = 'text'; actInput.required = true
  actInput.placeholder = 'Ex.: Soma com apoio visual — blocos de cores'
  actField.append(actLabel, actInput)
  body.append(actField)

  const focusField = el('div', 'field')
  const focusLabel = document.createElement('label')
  focusLabel.textContent = 'Foco trabalhado'
  const focusInput = document.createElement('input')
  focusInput.type = 'text'; focusInput.placeholder = 'Ex.: Contagem e correspondência 1-a-1'
  focusField.append(focusLabel, focusInput)
  body.append(focusField)

  const scaleRow = el('div', 'row3')

  const engField = el('div', 'field')
  engField.append(el('label', null, 'Engajamento'))
  const eng = makeScaleGroup([
    { label: 'Baixo', val: '1', tone: 'bad' },
    { label: 'Médio', val: '3', tone: 'warn' },
    { label: 'Alto', val: '5', tone: 'ok' },
    { label: 'Oscilou', val: '2', tone: '' },
  ])
  engField.append(eng.group)

  const diffField = el('div', 'field')
  diffField.append(el('label', null, 'Dificuldade percebida'))
  const diff = makeScaleGroup([
    { label: 'Baixa', val: '1', tone: 'ok' },
    { label: 'Média', val: '3', tone: 'warn' },
    { label: 'Alta', val: '5', tone: 'bad' },
    { label: 'Não foi possível', val: '0', tone: '' },
  ])
  diffField.append(diff.group)

  const resultField = el('div', 'field')
  resultField.append(el('label', null, 'Resultado'))
  const result = makeScaleGroup([
    { label: 'Avançou', val: 'improved', tone: 'ok' },
    { label: 'Manteve', val: 'stable', tone: '' },
    { label: 'Teve dificuldade', val: 'struggled', tone: 'bad' },
    { label: 'Não foi possível', val: 'not_completed', tone: '' },
  ])
  resultField.append(result.group)

  scaleRow.append(engField, diffField, resultField)
  body.append(scaleRow)

  const nextField = el('div', 'field')
  const nextLabel = document.createElement('label')
  nextLabel.textContent = 'Próximo passo'
  const nextInput = document.createElement('textarea')
  nextInput.placeholder = 'O que trabalhar na próxima sessão?'
  nextField.append(nextLabel, nextInput)
  body.append(nextField)

  body.append(el('div', 'lvl', '2 · Resumo para a família — aparece na hora'))

  const guide = el('div', 'guide')
  guide.innerHTML = `<strong>O que você escrever aqui aparece para o responsável.</strong>
    Descreva comportamentos observáveis — o que funcionou, o que foi difícil — em linguagem simples e respeitosa.
    <em>Exemplo: "Ana participou com entusiasmo dos blocos de cores. Teve dificuldade com sequências acima de 3 elementos, mas conseguiu com apoio visual. Focaremos nisso na próxima sessão."</em>`
  body.append(guide)

  const familyField = el('div', 'field')
  const familyLabel = document.createElement('label')
  familyLabel.textContent = 'Resumo para a família *'
  const familyInput = document.createElement('textarea')
  familyInput.placeholder = 'Descreva o que aconteceu na sessão...'
  familyInput.required = true; familyInput.maxLength = 800
  familyField.append(familyLabel, familyInput)

  const charCount = el('div', 'char-count', '0 / 800 caracteres')
  familyInput.addEventListener('input', () => { charCount.textContent = `${familyInput.value.length} / 800 caracteres` })
  familyField.append(charCount)
  body.append(familyField)

  const familyPreview = el('div', 'family-preview')
  const previewLabel = el('div', 'family-preview-label', 'Como a família verá')
  const previewTitle = el('strong', null, `${childName}: resumo da sessão`)
  const previewSummary = el('p')
  const previewNext = el('p')
  familyPreview.append(previewLabel, previewTitle, previewSummary, previewNext)

  const updateFamilyPreview = () => {
    const activity = actInput.value.trim()
    const focus = focusInput.value.trim()
    const summaryText = familyInput.value.trim()
    const next = nextInput.value.trim()

    previewSummary.textContent = summaryText ||
      `${childName} participou da atividade${activity ? ` "${activity}"` : ''}${focus ? ` com foco em ${focus}` : ''}. Escreva aqui o que funcionou, o que ficou difícil e qual apoio ajudou.`
    previewNext.textContent = `Próximo passo: ${next || 'a definir com base na sessão de hoje'}`
  }

  ;[actInput, focusInput, familyInput, nextInput].forEach((input) => {
    input.addEventListener('input', updateFamilyPreview)
  })
  updateFamilyPreview()
  body.append(familyPreview)

  const checklistTitle = el('p', null, 'Antes de salvar, confirme:')
  checklistTitle.style.cssText = 'font-size:.79rem;font-weight:700;color:var(--ink-soft);'

  const CHECKS = [
    { id: 'chk-obs', label: 'Descrevi comportamentos observáveis (não interpretações ou rótulos)' },
    { id: 'chk-what', label: 'Expliquei o que funcionou ou não funcionou' },
    { id: 'chk-next', label: 'Indiquei um próximo passo claro' },
    { id: 'chk-lang', label: 'Usei linguagem simples, respeitosa e educacional' },
  ]
  const checklist = el('ul', 'checklist')
  CHECKS.forEach(({ id, label }) => {
    const li = el('li')
    const cb = document.createElement('input')
    cb.type = 'checkbox'; cb.id = id
    const lbl = document.createElement('label')
    lbl.htmlFor = id; lbl.textContent = label
    li.append(cb, lbl); checklist.append(li)
  })
  body.append(checklistTitle, checklist)

  body.append(el('div', 'lvl', '3 · Nota interna — só você e a equipe veem'))

  const internalWrap = el('div', 'internal-note')
  const internalLabel = el('div', 'internal-note-label')
  internalLabel.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
  internalLabel.append(document.createTextNode('A família nunca tem acesso a esta nota'))
  const internalInput = document.createElement('textarea')
  internalInput.placeholder = 'Dúvidas técnicas, pontos para revisar com a equipe, observações confidenciais…'
  internalWrap.append(internalLabel, internalInput)
  body.append(internalWrap)

  const errorBox = el('p', 'form-error'); errorBox.hidden = true
  const okBox = el('p', 'form-ok'); okBox.hidden = true
  const saveBtn = el('button', 'btn btn-accent btn-sm', 'Salvar registro')
  saveBtn.type = 'button'

  saveBtn.addEventListener('click', async () => {
    errorBox.hidden = true; okBox.hidden = true

    const actTitle = actInput.value.trim()
    if (!actTitle) {
      errorBox.textContent = 'Informe a atividade realizada.'; errorBox.hidden = false
      actInput.focus(); return
    }
    const familySummary = familyInput.value.trim()
    if (!familySummary) {
      errorBox.textContent = 'Escreva o resumo para a família.'; errorBox.hidden = false
      familyInput.focus(); return
    }
    const allChecked = CHECKS.every(({ id }) => document.getElementById(id)?.checked)
    if (!allChecked) {
      errorBox.textContent = 'Confirme todos os itens da lista antes de salvar.'; errorBox.hidden = false; return
    }

    saveBtn.disabled = true; saveBtn.textContent = 'Salvando…'

    // TODO(wiring:sessions): adicionar engagement=eng.getValue(), perceived_difficulty=diff.getValue(),
    //   result=result.getValue() quando o schema for atualizado.

    // Uma sessão a partir de N execuções marcadas, atômico (RPC): cria o
    // registro e liga todas ao mesmo session_id, ou nada. Fim do vínculo que
    // falhava calado. Ver docs/supabase-fase-14-sessao-multi-execucao.sql.
    const execucoesSelecionadas = collectCheckedExecucoes()
    const { error } = await createSessionWithExecucoes({
      cycleId: cycle.id,
      activityId: _selectedActivityId,
      sessionDate: dateInput.value || todayISO(),
      durationMinutes: durInput.value ? Number(durInput.value) : null,
      activityTitle: actTitle,
      focusArea: focusInput.value.trim(),
      familySummary,
      notes: internalInput.value.trim() || null,
      nextStep: nextInput.value.trim(),
      execucaoIds: execucoesSelecionadas.map((e) => e.id),
    })

    saveBtn.disabled = false; saveBtn.textContent = 'Salvar registro'

    if (error) {
      errorBox.textContent = 'Não conseguimos salvar agora. Seu texto continua aqui para você tentar novamente.'
      errorBox.hidden = false
      return
    }

    _selectedActivityId = null
    ;[actInput, focusInput, familyInput, nextInput, internalInput].forEach((i) => { i.value = '' })
    durInput.value = ''; dateInput.value = todayISO()
    charCount.textContent = '0 / 800 caracteres'
    CHECKS.forEach(({ id }) => { const cb = document.getElementById(id); if (cb) cb.checked = false })
    eng.reset(); diff.reset(); result.reset()
    updateFamilyPreview()

    okBox.textContent = 'Sessão registrada. A família já consegue acompanhar o resumo.'; okBox.hidden = false
    details.open = false
    await loadPendingExecucoes()
    await onSaved()
  })

  const actions = el('div', 'form-actions')
  actions.append(errorBox, okBox, saveBtn)
  body.append(actions)
  details.append(body)

  details.fillSuggestedActivity = (activity = DEFAULT_ACTIVITY) => {
    actInput.value = activity.title
    focusInput.value = activity.focus
    if (!nextInput.value.trim()) nextInput.value = activity.nextStep || ''
    _selectedActivityId = activity.id || null
    details.open = true
    updateFamilyPreview()
    actInput.focus()
  }

  return details
}

// ── Sessões: tabela de histórico ─────────────────────────────────────────────

function renderSessionRow(record, index) {
  const tr = document.createElement('tr')

  const dateTd = document.createElement('td')
  dateTd.className = 'num'
  dateTd.textContent = formatDate(record.date) ?? '—'

  const actTd = document.createElement('td')
  actTd.textContent = record.activity_title ?? '—'

  const focusTd = document.createElement('td')
  focusTd.className = 'muted'
  focusTd.textContent = record.focus_area || '—'

  const durTd = document.createElement('td')
  durTd.className = 'num muted'
  durTd.textContent = record.duration_minutes ? `${record.duration_minutes} min` : '—'

  const famTd = document.createElement('td')
  const pill = el('span', 'pill pill-ok', 'Visível')
  famTd.append(pill)

  tr.append(dateTd, actTd, focusTd, durTd, famTd)
  return tr
}

async function loadSessionsTable(cycleId, tbody, emptyWrap, table) {
  tbody.replaceChildren()
  const { data, error } = await getCycleSessions(cycleId)
  const rows = error ? [] : (data ?? [])

  if (!rows.length) {
    table.hidden = true
    emptyWrap.hidden = false
  } else {
    table.hidden = false
    emptyWrap.hidden = true
    rows.forEach((r, i) => tbody.append(renderSessionRow(r, i)))
  }
  return rows
}

// ── Painel: Visão geral ───────────────────────────────────────────────────────

// ── Painel: Resumo (mesa de trabalho) ─────────────────────────────────────────
// Substitui o antigo dossiê. A tela inteira deriva de derivarEstadoResumo()
// (js/pages/resumo-estado.js): um estado dominante, no máximo um CTA. Nada aqui
// inventa dado — tudo vem de sessions/atividade_execucao/child_trails já
// existentes. Ver docs/TELA-RESUMO-PAINEL-TUTOR.md.
function buildResumoPanel(cycle, { openForm }) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'overview' // id interno mantido — switchTab/tabs seguem funcionando

  const wrap = el('div', 'resumo')
  wrap.append(el('p', 'card-copy', 'Carregando resumo…'))
  panel.append(wrap)

  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const nome = firstName(child.name) || 'a criança'
  const E = ESTADOS_RESUMO

  // ── Bloco 2: copy da "Próxima decisão" por estado (§5). cta pode ser null. ──
  function decisaoDe(estado, dados) {
    switch (estado) {
      case E.CICLO_PLANEJADO:
        return { ti: 'O ciclo começa em breve.', ds: 'Leia o perfil pedagógico e explore a biblioteca antes da primeira sessão.',
          cta: { label: 'Ver perfil pedagógico', href: `perfil-crianca.html?id=${cycle.child_id ?? ''}` } }
      case E.EXECUCAO_PENDENTE: {
        const titulo = dados.execucao?.child_activities?.titulo || 'uma atividade'
        const quando = dados.execucao?.created_at ? formatExecucaoQuando(dados.execucao.created_at) : 'há pouco'
        const ti = dados.total > 1
          ? `${nome} concluiu ${dados.total} atividades que ainda não viraram registro — a mais recente foi "${titulo}" ${quando}.`
          : `${nome} completou "${titulo}" ${quando} e a execução ainda não virou registro.`
        return { ti,
          ds: 'Transforme o que a criança fez numa sessão para a família acompanhar.',
          cta: { label: `Revisar o que ${nome} fez`, onClick: openForm } }
      }
      case E.MODULO_EM_REVISAO:
        return { ti: `O módulo ${dados.modulo?.trail_modules?.position} terminou. Hora de decidir como ${nome} segue.`,
          ds: 'Avançar para o próximo, repetir ou adaptar — a decisão é sua.',
          cta: { label: 'Decidir: avançar, repetir ou adaptar', onClick: () => switchTab('plan') } }
      case E.MODULO_BLOQUEADO:
        return { ti: `O módulo ${dados.modulo?.trail_modules?.position} está pronto para ser preparado e liberado para ${nome}.`,
          ds: 'Libere o módulo para a primeira missão ficar disponível no aparelho.',
          cta: { label: 'Preparar e liberar módulo', onClick: () => switchTab('plan') } }
      case E.JORNADA_CONCLUIDA:
        return { ti: `${nome} concluiu a jornada "${dados.trail?.trail_templates?.title || 'atual'}". 🎉 O histórico está guardado.`,
          ds: 'Escolha a próxima jornada quando fizer sentido — nada se perde.',
          cta: { label: 'Atribuir próxima jornada', onClick: () => switchTab('plan') },
          secondary: { label: 'Ver histórico', onClick: () => switchTab('sessions') } }
      case E.SEM_JORNADA:
        return { ti: `${nome} ainda não tem uma jornada.`, ds: 'Escolha uma jornada da biblioteca para começar o acompanhamento.',
          cta: { label: 'Atribuir jornada', onClick: () => switchTab('plan') } }
      case E.MISSAO_DISPONIVEL:
        return { ti: `Tudo preparado. ${nome} tem uma missão disponível no aparelho.`,
          ds: 'Nada esperando decisão sua agora — é a vez da criança.',
          cta: { label: 'Ver jornada', onClick: () => switchTab('plan'), discreto: true } }
      case E.CICLO_PAUSADO:
        return { ti: 'O ciclo está pausado.', ds: 'A equipe acompanha e avisa os próximos passos.', cta: null }
      case E.CICLO_CONCLUIDO:
        return { ti: `Ciclo concluído. Obrigado pelo cuidado com ${nome}.`, ds: 'O histórico permanece nas Sessões.',
          cta: { label: 'Ver histórico de sessões', onClick: () => switchTab('sessions') } }
      case E.EM_DIA:
      default:
        return { ti: 'Tudo em dia por aqui.', ds: 'Nada esperando decisão sua no momento.', cta: null }
    }
  }

  function renderDecisao(estado, dados) {
    const d = decisaoDe(estado, dados)
    const card = el('div', 'card card--accent resumo-decisao')
    card.append(simpleHead('Próxima decisão'))
    const body = el('div', 'card-b')
    body.append(el('div', 'decisao-ti', d.ti))
    if (d.ds) body.append(el('p', 'card-copy', d.ds))
    if (d.cta) {
      const actions = el('div', 'decisao-actions')
      const cls = d.cta.discreto ? 'resumo-link' : 'btn btn-accent'
      let primary
      if (d.cta.href) {
        primary = el('a', cls, d.cta.label); primary.href = d.cta.href
      } else {
        primary = el('button', cls, d.cta.label); primary.type = 'button'
        primary.addEventListener('click', d.cta.onClick)
      }
      actions.append(primary)
      if (d.secondary) {
        const sec = el('button', 'btn btn-ghost btn-sm', d.secondary.label)
        sec.type = 'button'; sec.addEventListener('click', d.secondary.onClick)
        actions.append(sec)
      }
      body.append(actions)
    }
    card.append(body)
    return card
  }

  // ── Bloco 1: Pulso — uma linha, fatos derivados ──────────────────────────
  function renderPulso({ sessions, execucoesPendentes, trail, modules }) {
    const parts = []
    const last = sessions[0]
    parts.push(last ? `Última sessão ${formatLastSession(last.date)}` : 'Nenhuma sessão registrada')
    if (execucoesPendentes.length) {
      parts.push(`${execucoesPendentes.length} ${execucoesPendentes.length === 1 ? 'atividade aguardando' : 'atividades aguardando'} registro`)
    }
    if (trail && modules.length) {
      const pos = moduloAtualDe(modules)?.trail_modules?.position ?? modules.length
      parts.push(`Módulo ${pos} de ${modules.length}`)
    }
    const pulso = el('div', 'resumo-pulso')
    parts.forEach((p, i) => {
      if (i) pulso.append(el('span', 'sep', '·'))
      pulso.append(el('span', null, p))
    })
    return pulso
  }

  // ── Bloco 3: O que aconteceu — merge de sessões + execuções + atribuição ──
  function renderTimeline({ sessions, execucoesPendentes, trail }) {
    const items = []
    sessions.forEach((s) => items.push({
      _t: new Date(s.created_at || s.date).getTime(),
      tone: 'you',
      icon: `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
      html: '<b>Você</b> registrou a sessão',
      sub: [s.activity_title, s.focus_area ? `foco em ${s.focus_area}` : null].filter(Boolean).join(' · '),
      time: formatLastSession(s.date),
    }))
    execucoesPendentes.forEach((e) => items.push({
      _t: new Date(e.created_at).getTime(),
      tone: 'team',
      icon: `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>`,
      html: `<b>${nome}</b> concluiu ${e.child_activities?.titulo ? `"${e.child_activities.titulo}"` : 'uma atividade'}`,
      sub: 'Aguardando você registrar a sessão',
      time: formatExecucaoQuando(e.created_at),
    }))
    if (trail) items.push({
      _t: new Date(trail.created_at).getTime(),
      tone: 'team',
      icon: `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.6.6-5 4.4 1.5 6.5L12 17l-6 3.3 1.5-6.5-5-4.4 6.6-.6z"/></svg>`,
      html: `<b>Jornada</b> ${trail.trail_templates?.title ? `"${trail.trail_templates.title}"` : ''} atribuída`,
      sub: '',
      time: formatDate(trail.created_at?.slice(0, 10)) ?? '',
    })
    items.sort((a, b) => b._t - a._t)

    const card = el('div', 'card')
    card.append(simpleHead('O que aconteceu'))
    const cbody = el('div', 'card-b')
    if (!items.length) {
      cbody.append(el('p', 'card-copy', 'Nada por aqui ainda — o histórico aparece assim que a criança fizer uma atividade ou você registrar uma sessão.'))
    } else {
      const feed = el('div', 'feed')
      renderFeedItems(feed, items.slice(0, 5))
      cbody.append(feed)
    }
    card.append(cbody)
    return card
  }

  // ── Bloco 4: Contexto — 3 chips + link + meta (só se existir) ─────────────
  function renderContexto() {
    const card = el('div', 'card')
    card.append(simpleHead(`Contexto de ${nome}`))
    const cbody = el('div', 'card-b')
    const chips = el('div', 'resumo-contexto chips')
    const difficulties = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
    const addChip = (label, val, cls) => { if (val) chips.append(el('span', `chip ${cls}`, `${label}: ${val}`)) }
    addChip('foco', difficulties[0], 'chip--1')
    addChip('prefere', toList(lp.preferred_formats)[0], 'chip--2')
    addChip('evita', toList(lp.avoidances)[0], 'chip--3')
    if (!chips.children.length) chips.append(el('span', 'chip chip--1', 'Perfil pedagógico ainda não detalhado'))
    cbody.append(chips)
    const link = el('a', 'resumo-link', 'Ver perfil pedagógico completo →')
    link.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
    cbody.append(link)
    if (cycle.main_goal) cbody.append(el('div', 'resumo-meta', `Meta do ciclo: ${cycle.main_goal}`))
    card.append(cbody)
    return card
  }

  function renderErro() {
    const card = el('div', 'card')
    card.append(simpleHead('Resumo'))
    const cbody = el('div', 'card-b')
    cbody.append(el('p', 'card-copy', 'Não foi possível carregar o resumo agora. Verifique a conexão e tente de novo.'))
    const btn = el('button', 'btn btn-ghost btn-sm', 'Tentar novamente')
    btn.type = 'button'; btn.addEventListener('click', reload)
    cbody.append(btn)
    card.append(cbody)
    return card
  }

  async function reload() {
    // sessions sempre (pulso/timeline/histórico). trail/módulos/missões/
    // execuções só quando o ciclo está ativo — nos estados P/Z/F a cascata
    // nem roda (o portão de ciclo decide antes).
    const isActive = cycle.status === 'active'
    const [sessRes, trailRes] = await Promise.all([
      getCycleSessions(cycle.id),
      isActive ? getLatestChildTrail(cycle.child_id, cycle.id) : Promise.resolve({ data: null, error: null }),
    ])
    const trail = trailRes?.data ?? null

    let modRes = { data: [], error: null }
    let exeRes = { data: [], error: null }
    let missions = []
    if (isActive) {
      ;[modRes, exeRes] = await Promise.all([
        trail ? getChildTrailModules(trail.id) : Promise.resolve({ data: [], error: null }),
        listPendingExecucoes(cycle.child_id, cycle.id),
      ])
      // Erro nas missões afeta só o sinal informativo MISSAO_DISPONIVEL, não
      // é crítico pra derivar o estado — não bloqueia o Resumo.
      const mod = moduloAtualDe(modRes.data ?? [])
      if (mod) missions = (await getChildTrailMissions(mod.id))?.data ?? []
    }

    // Consulta crítica falhou → NÃO derivar estado de dado incompleto (erro
    // viraria "Tudo em dia" indevido). Erro honesto + tentar novamente.
    if (sessRes.error || trailRes?.error || modRes.error || exeRes.error) {
      wrap.replaceChildren(renderErro())
      return
    }

    const sessions = sessRes.data ?? []
    const modules = modRes.data ?? []
    const execucoesPendentes = exeRes.data ?? []
    const { estado, dados } = derivarEstadoResumo({ cycle, trail, modules, missions, execucoesPendentes })

    // P/Z/F reduzem para "Próxima decisão" + histórico (quando existir). §5.
    const reduced = !isActive
    wrap.replaceChildren()
    if (!reduced) wrap.append(renderPulso({ sessions, execucoesPendentes, trail, modules }))
    wrap.append(renderDecisao(estado, dados))
    if (!reduced || sessions.length) wrap.append(renderTimeline({ sessions, execucoesPendentes, trail }))
    if (!reduced) wrap.append(renderContexto())
  }

  panel.reload = reload
  return panel
}

// ── Painel: Sessões ───────────────────────────────────────────────────────────

function buildSessionsPanel(cycle, state, sessionForm) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'sessions'
  panel.hidden = true

  const stack = el('div', 'stack')
  stack.style.maxWidth = 'none'

  if (state === 'cycle_active') {
    stack.append(sessionForm)
  } else {
    const LOCKED = {
      cycle_planned: 'O registro de sessões libera assim que a equipe ativar o ciclo. Por enquanto, dá para conferir o perfil pedagógico na aba Visão geral.',
      cycle_paused: 'Os registros estão bloqueados enquanto o ciclo estiver pausado. Fale com a equipe Cognita para retomar.',
      cycle_completed: 'Este ciclo já foi concluído, então não é mais possível registrar novas sessões. O histórico completo está logo abaixo.',
    }
    const lockedCard = el('div', 'card')
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(LOCKED[state] ?? LOCKED.cycle_planned))
    lockedCard.append(note)
    stack.append(lockedCard)
  }

  const historyCard = el('div', 'card')
  const bar = el('div', 'tbl-bar')
  bar.append(el('h3', null, 'Histórico de sessões'))
  historyCard.append(bar)

  const table = el('table', 'tbl')
  table.innerHTML = `<thead><tr><th>Data</th><th>Atividade</th><th>Foco</th><th>Duração</th><th>Família</th></tr></thead>`
  const tbody = document.createElement('tbody')
  table.append(tbody)

  const emptyWrap = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  const img = document.createElement('img')
  img.src = '../assets/gatomatematico-sem-fundo.png'
  img.alt = ''
  empty.append(
    img,
    el('strong', null, 'Nenhuma sessão registrada ainda.'),
    el('span', null, 'Depois da primeira atividade, o histórico aparece aqui — e a família já consegue acompanhar.')
  )
  emptyWrap.append(empty)
  emptyWrap.hidden = true

  historyCard.append(table, emptyWrap)
  stack.append(historyCard)
  panel.append(stack)

  panel.loadTable = () => loadSessionsTable(cycle.id, tbody, emptyWrap, table)
  return panel
}

// ── Painel: Atividades preparadas (autoria do tutor pro Modo Criança) ───────
// O que este form salva é a instância child_activities — ver
// docs/supabase-fase-4b-corrente.sql. "Fazer com a criança" já abre o Modo
// Criança com a atividade real (getChildActivityById via ?activity=<id>) —
// ver docs/V2-DIRECAO.md para o mapeamento completo da jornada.

// callbacks vem só quando o ciclo permite editar o conjunto de atividades
// (ver buildActivitiesPanel) — undefined nos estados bloqueados, onde só
// "Fazer com a criança" continua fazendo sentido.
function renderChildActivityRow(row, callbacks) {
  const tr = document.createElement('tr')
  const molde = MOLDES_REGISTRO[row.molde]
  const temaLabel = molde?.temas.find((t) => t.id === row.tema)?.label || row.tema

  const titleTd = document.createElement('td')
  titleTd.textContent = row.titulo || molde?.tituloPadrao?.(temaLabel) || row.molde

  const detailsTd = document.createElement('td')
  detailsTd.className = 'muted'
  detailsTd.textContent = `${molde?.label || row.molde} · ${temaLabel} · ${formatConfigResumo(row.molde, row.config)}`

  const dateTd = document.createElement('td')
  dateTd.className = 'num muted'
  dateTd.textContent = formatLastSession(row.created_at?.slice(0, 10))

  const actionTd = document.createElement('td')
  const actionsWrap = el('div', 'activity-actions')

  // Atividade avulsa (child_trail_mission_id null) sempre pode ser feita.
  // Atividade de missão de trilha só quando a missão está 'disponivel' —
  // 'concluida' NÃO conta: repetir é uma decisão de produto ainda não
  // desenhada (ver docs/PLANO-SPRINT-4-TRILHA.md / roadmap "repetir/
  // adaptar"), então o botão padrão não pode virar repetição sem querer.
  const missaoStatus = row.child_trail_mission_id ? pickEmbedded(row.child_trail_missions)?.status : null
  const podeExecutar = !row.child_trail_mission_id || missaoStatus === 'disponivel'
  if (!podeExecutar) {
    actionsWrap.append(el('span', 'trilha-blocked-pill', 'Bloqueada pela jornada'))
  } else {
    const link = el('a', 'btn btn-ghost btn-sm', 'Fazer com a criança')
    // return aponta direto pra aba Sessões: é lá que a execução recém-gravada
    // aparece em "Usar esta execução", fechando o loop sem o tutor ter que
    // procurar onde continuar.
    link.href = `modo-crianca.html?${new URLSearchParams({ activity: row.id, return: 'tutor.html?view=record&tab=sessions' })}`
    actionsWrap.append(link)
  }

  // Duplicar/Editar/Arquivar só fazem sentido pra atividade avulsa. Uma
  // atividade de missão de trilha é administrada pela trilha (liberar/
  // avançar): Arquivar deixaria a missão apontando pra uma child_activity
  // inexistente, sem caminho de recriação (release_child_module recusa
  // liberar um módulo já liberado); Editar deixaria o tutor reescrever o
  // currículo por fora do allowlist que a RPC já impõe.
  if (callbacks && !row.child_trail_mission_id) {
    const dupBtn = el('button', 'btn btn-ghost btn-sm', 'Duplicar')
    dupBtn.type = 'button'
    dupBtn.addEventListener('click', () => callbacks.onDuplicate(row))
    actionsWrap.append(dupBtn)

    const editBtn = el('button', 'btn btn-ghost btn-sm', 'Editar')
    editBtn.type = 'button'
    editBtn.addEventListener('click', () => callbacks.onEdit(row))
    actionsWrap.append(editBtn)

    const archiveBtn = el('button', 'btn btn-bad btn-sm', 'Arquivar')
    archiveBtn.type = 'button'
    archiveBtn.addEventListener('click', () => callbacks.onArchive(row))
    actionsWrap.append(archiveBtn)
  }

  actionTd.append(actionsWrap)
  tr.append(titleTd, detailsTd, dateTd, actionTd)
  return tr
}

// Distingue erro de "sem dado" (CLAUDE.md §11: estado vazio é direção, não
// decoração — e um erro fingindo de vazio esconde que algo quebrou).
async function loadChildActivitiesTable(childId, tbody, emptyWrap, errorWrap, table, callbacks) {
  tbody.replaceChildren()
  const { data, error } = await listChildActivities(childId)

  if (error) {
    table.hidden = true
    emptyWrap.hidden = true
    errorWrap.hidden = false
    return []
  }
  errorWrap.hidden = true

  const rows = data ?? []
  if (!rows.length) {
    table.hidden = true
    emptyWrap.hidden = false
  } else {
    table.hidden = false
    emptyWrap.hidden = true
    rows.forEach((r) => tbody.append(renderChildActivityRow(r, callbacks)))
  }
  return rows
}

// ── "Últimas execuções" — leitura, sem ação (a ação "Usar esta execução"
// continua só na aba Sessões, que é onde o registro nasce de verdade) ──

function renderRecentExecucaoItem(execucao) {
  const item = el('div', 'recent-execucao-item')
  const molde = MOLDES_REGISTRO[execucao.molde]
  const temaLabel = molde?.temas.find((t) => t.id === execucao.tema)?.label || execucao.tema
  const atividade = pickEmbedded(execucao.child_activities)
  const titulo = atividade?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || execucao.molde} · ${temaLabel}`

  const quando = formatExecucaoQuando(execucao.created_at)
  const detalhes = [
    quando ? `Feita ${quando}` : null,
    COMO_ENCERROU_LABEL[execucao.como_encerrou],
  ].filter(Boolean).join(' · ')

  const statusPill = execucao.session_id
    ? el('span', 'pill pill-ok', 'Registrada')
    : el('span', 'pill pill-mid', 'Aguardando registro')

  const row = el('div', 'recent-execucao-row')
  const tx = el('div')
  tx.append(el('strong', null, titulo), el('p', 'recent-execucao-detalhes', detalhes))
  row.append(tx, statusPill)
  item.append(row)
  return item
}

async function loadRecentExecucoes(childId, list) {
  list.replaceChildren()
  const { data, error } = await listRecentExecucoes(childId, 5)

  if (error) {
    list.append(el('p', 'execucoes-msg', 'Não conseguimos carregar as últimas execuções agora.'))
    return
  }

  const rows = data ?? []
  if (!rows.length) {
    list.append(el('p', 'execucoes-msg', 'Nenhuma execução registrada ainda. Quando a criança fizer uma atividade no Modo Criança, ela aparece aqui.'))
    return
  }
  rows.forEach((execucao) => list.append(renderRecentExecucaoItem(execucao)))
}

function buildActivitiesPanel(cycle, state, onSaved) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'activities'
  panel.hidden = true

  const childName = firstName(cycle.children?.name)
  const childAge = ageFrom(cycle.children?.birth_date)
  const stack = el('div', 'stack')
  stack.style.maxWidth = 'none'

  const LOCKED = {
    cycle_paused: 'Preparar atividades fica bloqueado enquanto o ciclo estiver pausado. Fale com a equipe Cognita para retomar.',
    cycle_completed: 'Este ciclo já foi concluído — não é mais possível preparar novas atividades. O que já foi preparado continua listado abaixo.',
  }

  // callbacks das ações de linha (Duplicar/Editar/Arquivar) só existem
  // quando o form de composição existe pra recebê-las — undefined nos
  // estados bloqueados (renderChildActivityRow aí só mostra "Fazer com a
  // criança", que não depende do form).
  let rowCallbacks
  let prefillFromPlanoRef

  if (LOCKED[state]) {
    const lockedCard = el('div', 'card')
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(LOCKED[state]))
    lockedCard.append(note)
    stack.append(lockedCard)
  } else {
    stack.append(el('div', 'lvl', '1 · Preparar atividade'))
    const cols = el('div', 'cols')

    // ── Coluna esquerda: compor ──
    const composeCard = el('div', 'card')
    const composeHead = el('div', 'card-h')
    const headCopy = el('div')
    headCopy.append(el('h3', null, 'Preparar atividade'))
    const headSub = el('span', null, `para ${childName}${childAge != null ? ` · ${childAge} anos` : ''}`)
    headSub.style.cssText = 'display:block;font-size:.78rem;color:var(--muted);font-weight:400;margin-top:2px;'
    headCopy.append(headSub)
    composeHead.append(headCopy)
    composeCard.append(composeHead)
    const composeBody = el('div', 'card-b')

    // Banner de edição — só aparece quando "Editar" pré-preencheu o form com
    // uma atividade já salva. "Duplicar" NÃO passa por aqui: pré-preenche
    // mas mantém o form em modo criação (salvar gera uma linha nova).
    const editBanner = el('div', 'activity-edit-banner')
    editBanner.hidden = true
    const editBannerText = el('span', null, '')
    const cancelEditBtn = el('button', 'btn btn-ghost btn-sm', 'Cancelar edição')
    cancelEditBtn.type = 'button'
    editBanner.append(editBannerText, cancelEditBtn)
    composeBody.append(editBanner)

    const moldeOptions = Object.entries(MOLDES_REGISTRO).map(([id, m]) => ({ id, label: m.label, disabled: !m.disponivel }))
    const temaWrap = el('div')
    const configWrap = el('div', 'stack')

    const instField = el('div', 'field')
    instField.append(el('label', null, 'Instrução *'))
    const instInput = document.createElement('textarea')
    instInput.required = true
    instField.append(instInput)

    const tituloField = el('div', 'field')
    tituloField.append(el('label', null, 'Título (só para você identificar)'))
    const tituloInput = document.createElement('input')
    tituloInput.type = 'text'
    tituloField.append(tituloInput)

    // Precisa existir antes de rebuildForMolde() rodar lá embaixo — é ela
    // que pushPreview() usa pra postar o contrato ao vivo.
    const previewIframe = document.createElement('iframe')
    previewIframe.src = 'modo-crianca.html?preview=1'
    previewIframe.title = 'Prévia do Modo Criança'

    const summary = el('p', 'compose-summary')
    const errorBox = el('p', 'form-error'); errorBox.hidden = true
    const okBox = el('p', 'form-ok'); okBox.hidden = true
    const saveBtn = el('button', 'btn btn-accent btn-sm', 'Salvar atividade')
    saveBtn.type = 'button'

    let temaChoice = null
    let controlFields = []
    let editingId = null

    function currentConfig() {
      const molde = MOLDES_REGISTRO[moldeChoice.getValue()]
      const config = {}
      molde.campos.forEach((campo, i) => { config[campo.key] = controlFields[i]?.getValue() ?? campo.default })
      return config
    }

    function updateSummary() {
      const moldeKey = moldeChoice.getValue()
      const molde = MOLDES_REGISTRO[moldeKey]
      const temaLabel = molde.temas.find((t) => t.id === temaChoice?.getValue())?.label || ''
      const tituloAtual = tituloInput.value.trim() || molde.tituloPadrao?.(temaLabel) || molde.label
      summary.replaceChildren(
        document.createTextNode(editingId ? 'Vai atualizar ' : 'Vai criar '),
        el('strong', null, tituloAtual),
        document.createTextNode(` — ${formatConfigResumo(moldeKey, currentConfig())}.`)
      )
    }

    // Reusa buildContractFromParts (a mesma função que monta o contrato real
    // no Modo Criança) — a prévia não é uma maquete, é a própria casca
    // rodando num <iframe>, recebendo o estado atual do form ao vivo.
    function pushPreview() {
      if (!previewIframe.contentWindow) return
      const moldeKey = moldeChoice.getValue()
      const contract = buildContractFromParts({
        molde: moldeKey,
        tema: temaChoice?.getValue(),
        config: currentConfig(),
        instrucao: instInput.value,
        titulo: tituloInput.value,
      })
      previewIframe.contentWindow.postMessage({ type: 'cognita-preview-contract', contract }, window.location.origin)
    }

    function onConfigChange() { updateSummary(); pushPreview() }

    function rebuildConfig() {
      configWrap.replaceChildren()
      const molde = MOLDES_REGISTRO[moldeChoice.getValue()]
      const pillsRow = el('div', 'row')
      controlFields = molde.campos.map((campo) => {
        const control = campo.control === 'slider'
          ? makeSlider({ label: campo.label, min: campo.min, max: campo.max, value: campo.default, onChange: onConfigChange })
          : makePillSelector({ label: campo.label, min: campo.min, max: campo.max, value: campo.default, onChange: onConfigChange })
        if (campo.control === 'slider') configWrap.append(control.field)
        else pillsRow.append(control.field)
        return control
      })
      if (pillsRow.children.length) configWrap.append(pillsRow)

      const temaLabel = molde.temas.find((t) => t.id === temaChoice?.getValue())?.label || ''
      instInput.value = molde.instrucaoPadrao || ''
      tituloInput.value = molde.tituloPadrao ? molde.tituloPadrao(temaLabel) : ''
      updateSummary()
      pushPreview()
    }

    function rebuildForMolde() {
      const molde = MOLDES_REGISTRO[moldeChoice.getValue()]
      temaWrap.replaceChildren()
      const temaOptions = molde.temas.map((t) => ({ id: t.id, label: t.label, disabled: !t.disponivel }))
      const defaultTema = temaOptions.find((o) => !o.disabled)?.id
      temaChoice = makeChoiceButtons(temaOptions, defaultTema, rebuildConfig)
      temaWrap.append(temaChoice.group)
      rebuildConfig()
    }

    const defaultMolde = moldeOptions.find((o) => !o.disabled)?.id
    const moldeChoice = makeChoiceButtons(moldeOptions, defaultMolde, rebuildForMolde)

    composeBody.append(el('div', 'lvl', 'Como a criança vai interagir'), moldeChoice.group)
    composeBody.append(el('div', 'lvl', 'Tema'), temaWrap)
    composeBody.append(configWrap)
    composeBody.append(el('div', 'lvl', 'O que a criança lê'), instField, tituloField)
    composeBody.append(el('div', 'lvl', 'Revisar e salvar'), summary)

    ;[instInput, tituloInput].forEach((input) => input.addEventListener('input', () => { updateSummary(); pushPreview() }))
    rebuildForMolde()

    // Sai do modo edição preservando os campos como estão (usado depois de
    // salvar uma alteração com sucesso — o que acabou de ser salvo continua
    // visível, igual já acontecia ao criar). "Cancelar edição" usa
    // cancelEdit() abaixo, que além de sair também limpa o form.
    function exitEditMode() {
      editingId = null
      saveBtn.textContent = 'Salvar atividade'
      editBanner.hidden = true
    }

    function cancelEdit() {
      exitEditMode()
      rebuildForMolde()
    }
    cancelEditBtn.addEventListener('click', cancelEdit)

    // Duplicar e Editar convergem aqui: os dois pré-preenchem o mesmo form
    // com os dados de uma atividade já salva — a diferença é só se ficam em
    // modo criação (gera linha nova, título ganha "(cópia)") ou em modo
    // edição (atualiza a linha de origem).
    // asEdit: atualiza a linha de origem (Editar). asCopy: cria linha nova
    // com "(cópia)" no título (Duplicar). Nenhum dos dois (ex.: vindo do
    // Plano): cria linha nova com o título como veio, sem sufixo — não é
    // cópia de nada, é uma atividade nova sugerida pela etapa.
    function prefillCompose(row, { asEdit = false, asCopy = false } = {}) {
      const molde = MOLDES_REGISTRO[row.molde]
      const temaLabel = molde?.temas.find((t) => t.id === row.tema)?.label || row.tema

      moldeChoice.setValue(row.molde)
      temaChoice.setValue(row.tema)
      molde?.campos.forEach((campo, i) => {
        const v = row.config?.[campo.key]
        if (v != null) controlFields[i]?.setValue(v)
      })

      instInput.value = row.instrucao || ''
      const baseTitulo = row.titulo || molde?.tituloPadrao?.(temaLabel) || molde?.label || ''
      tituloInput.value = asEdit ? baseTitulo : asCopy ? `${baseTitulo} (cópia)`.trim() : baseTitulo

      editingId = asEdit ? row.id : null
      saveBtn.textContent = asEdit ? 'Salvar alterações' : 'Salvar atividade'
      editBanner.hidden = !asEdit
      if (asEdit) editBannerText.textContent = `Editando: ${baseTitulo}`

      updateSummary()
      pushPreview()

      composeCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
      tituloInput.focus()
      tituloInput.select()
    }

    async function onArchive(row) {
      const titulo = row.titulo || MOLDES_REGISTRO[row.molde]?.tituloPadrao?.(row.tema) || 'esta atividade'
      const ok = window.confirm(`Arquivar "${titulo}"? Ela sai da lista de atividades preparadas, mas o histórico de execuções e sessões continua guardado.`)
      if (!ok) return

      const { error } = await archiveChildActivity(row.id)
      if (error) {
        window.alert('Não conseguimos arquivar agora. Tente de novo em instantes.')
        return
      }
      if (editingId === row.id) cancelEdit()
      await onSaved?.()
    }

    rowCallbacks = {
      onDuplicate: (row) => prefillCompose(row, { asCopy: true }),
      onEdit: (row) => prefillCompose(row, { asEdit: true }),
      onArchive,
    }

    // Ponte com a aba Plano (buildPlanPanel): "Preparar atividade desta
    // etapa" chama isto com { titulo, molde, tema, config, instrucao } —
    // mesmo formato de uma linha de child_activities, então o mesmo
    // prefillCompose serve sem duplicar lógica.
    prefillFromPlanoRef = (etapa) => prefillCompose(etapa, {})

    saveBtn.addEventListener('click', async () => {
      errorBox.hidden = true; okBox.hidden = true

      const instrucao = instInput.value.trim()
      if (!instrucao) {
        errorBox.textContent = 'Escreva a instrução para a criança.'
        errorBox.hidden = false
        instInput.focus()
        return
      }

      const moldeKey = moldeChoice.getValue()
      const molde = MOLDES_REGISTRO[moldeKey]
      const temaId = temaChoice.getValue()
      const temaLabel = molde.temas.find((t) => t.id === temaId)?.label || ''
      const config = currentConfig()
      const titulo = tituloInput.value.trim() || molde.tituloPadrao?.(temaLabel) || molde.label
      const wasEditing = editingId

      saveBtn.disabled = true; saveBtn.textContent = 'Salvando…'
      const { error } = wasEditing
        ? await updateChildActivity(wasEditing, { molde: moldeKey, tema: temaId, config, instrucao, titulo })
        : await createChildActivity({
            childId: cycle.child_id,
            createdBy: session.user.id,
            cycleId: cycle.id,
            molde: moldeKey,
            tema: temaId,
            config,
            instrucao,
            titulo,
          })
      saveBtn.disabled = false; saveBtn.textContent = wasEditing ? 'Salvar alterações' : 'Salvar atividade'

      if (error) {
        errorBox.textContent = 'Não conseguimos salvar agora. Seu texto continua aqui para você tentar de novo.'
        errorBox.hidden = false
        return
      }

      okBox.textContent = wasEditing ? 'Atividade atualizada.' : 'Atividade preparada. Já aparece na lista abaixo.'
      okBox.hidden = false
      if (wasEditing) exitEditMode()
      await onSaved?.()
    })

    const actions = el('div', 'form-actions')
    actions.append(errorBox, okBox, saveBtn)
    composeBody.append(actions)
    composeCard.append(composeBody)

    // ── Coluna direita: prévia ao vivo — o Modo Criança de verdade, num
    // <iframe>, em modo prévia (sem login, sem gravar nada). Mesma casca.
    const previewCard = el('div', 'card')
    const previewHead = el('div', 'card-h')
    const previewHeadInner = el('div', 'preview-card-h')
    previewHeadInner.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    previewHeadInner.append(document.createTextNode('Prévia — o que a criança vê'))
    previewHead.append(previewHeadInner)
    previewCard.append(previewHead)

    const previewFrameWrap = el('div', 'preview-frame-wrap')
    const previewFrame = el('div', 'preview-frame')
    previewIframe.addEventListener('load', pushPreview)
    previewFrame.append(previewIframe)
    previewFrameWrap.append(previewFrame)
    previewCard.append(previewFrameWrap)

    cols.append(composeCard, previewCard)
    stack.append(cols)
  }

  stack.append(el('div', 'lvl', '2 · Atividades salvas'))
  const historyCard = el('div', 'card')
  const bar = el('div', 'tbl-bar')
  bar.append(el('h3', null, `Atividades preparadas para ${childName}`))
  historyCard.append(bar)

  const table = el('table', 'tbl')
  table.innerHTML = `<thead><tr><th>Título</th><th>Detalhes</th><th>Criada em</th><th></th></tr></thead>`
  const tbody = document.createElement('tbody')
  table.append(tbody)

  const emptyWrap = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  const img = document.createElement('img')
  img.src = '../assets/gatomatematico-sem-fundo.png'
  img.alt = ''
  empty.append(
    img,
    el('strong', null, 'Nenhuma atividade preparada ainda.'),
    el('span', null, `Crie uma atividade simples para começar com ${childName} — ela aparece aqui assim que for salva.`)
  )
  emptyWrap.append(empty)
  emptyWrap.hidden = true

  const errorWrap = el('div', 'card-b')
  const errorInner = el('div', 'error-card')
  errorInner.append(
    el('strong', null, 'Não conseguimos carregar as atividades agora.'),
    el('p', null, 'Tente atualizar a página.')
  )
  const retryBtn = el('button', 'btn btn-ghost', 'Tentar novamente')
  retryBtn.type = 'button'
  retryBtn.addEventListener('click', () => panel.loadTable())
  errorInner.append(retryBtn)
  errorWrap.append(errorInner)
  errorWrap.hidden = true

  historyCard.append(table, emptyWrap, errorWrap)
  stack.append(historyCard)

  stack.append(el('div', 'lvl', '3 · Últimas execuções'))
  const recentCard = el('div', 'card')
  recentCard.append(simpleHead('Últimas execuções no Modo Criança'))
  const recentBody = el('div', 'card-b')
  const recentList = el('div', 'recent-execucoes-list')
  recentBody.append(recentList)
  recentCard.append(recentBody)
  stack.append(recentCard)

  panel.append(stack)

  panel.loadTable = () => loadChildActivitiesTable(cycle.child_id, tbody, emptyWrap, errorWrap, table, rowCallbacks)
  panel.loadRecentExecucoes = () => loadRecentExecucoes(cycle.child_id, recentList)
  // undefined nos estados bloqueados (sem form de composição pra receber).
  // Único chamador restante: a ponte pendingEtapaParams em bootstrap() (volta
  // de trilha.html com ?plan=&step=) — buildPlanPanel não usa mais isso, a
  // trilha formal libera módulo inteiro via RPC, não prefill de form.
  panel.prefillFromPlano = (etapa) => prefillFromPlanoRef?.(etapa)
  return panel
}

// ── Painel: Plano — resumo compacto (o mapa grande mora em trilha.html) ─────
// Não é navegação livre da criança — é o tutor decidindo a próxima etapa.
// Dado pedagógico e cálculo de status moram em data/planos-registro.js.
// Esta aba não tenta mais mostrar o mapa inteiro (isso sufocava a trilha
// num card de ~420px de altura, ver docs/V2-DIRECAO.md) — responde rápido
// "qual é o plano, quanto já foi feito, qual a próxima ação", com um botão
// pra abrir a exploração de verdade em tela própria.

const MODULE_STATUS_LABEL = {
  bloqueado: 'Bloqueado',
  liberado: 'Liberado',
  aguardando_revisao: 'Aguardando revisão',
  concluido: 'Concluído',
}
const MISSION_STATUS_LABEL = {
  bloqueada: 'Bloqueada',
  disponivel: 'Disponível',
  concluida: 'Concluída',
}

// Sprint 6A ("modo demonstração") — reusa a sessão do tutor, sem
// pareamento próprio ainda. Sem ?demo=1 o app.js do app-crianca não teria
// como saber que é um teste do tutor, não a credencial final da criança.
function appendChildAppLink(container, cycle, label) {
  const link = el('a', 'btn btn-ghost btn-sm', label)
  link.href = `app-crianca.html?${new URLSearchParams({ cycle_id: cycle.id, demo: '1' }).toString()}`
  container.append(link)
}

// Currículo formal (Trilha → Módulo → Missão) — ver docs/supabase-fase-5
// em diante. Passagem funcional, sem redesenhar o mapa visual ainda (isso
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
  mascot.src = '../assets/trilha/mascote/planejar.webp'
  mascot.alt = ''
  mascot.hidden = true // só no estado vazio — dá identidade Cognita aos dois caminhos
  header.append(headerText, mascot)
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
    const comModulos = await Promise.all(
      (templates ?? []).map((t) =>
        getTrailTemplateWithModules(t.id).then((r) => ({ template: t, modules: r.data ?? [] }))
      )
    )
    const renderaveis = comModulos.filter((x) => x.modules.length)

    if (!renderaveis.length) {
      const none = el('div', 'card journey-choice')
      none.append(el('h4', 'journey-choice-title', 'Nenhum percurso recomendado ainda'))
      none.append(el('p', 'journey-choice-desc', 'A equipe Cognita ainda não publicou um percurso para começar.'))
      choices.append(none, renderCustomJourneyCard())
      body.replaceChildren(choices)
      return
    }

    renderaveis.forEach(({ template, modules }) => choices.append(renderRecommendedJourneyCard(template, modules)))
    choices.append(renderCustomJourneyCard())
    body.replaceChildren(choices)
  }

  function renderRecommendedJourneyCard(template, modules) {
    const card = el('div', 'card journey-choice journey-choice--recommended')
    card.append(el('span', 'journey-badge', 'Recomendada'))
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
      const txt = el('span', 'journey-radio-text')
      txt.append(el('span', 'journey-radio-title', `Módulo ${m.position} — ${m.title}`))
      if (m.objective) txt.append(el('span', 'journey-radio-sub', m.objective))
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

  // Porta pra Fase B (jornada personalizada). Honesto: aria-disabled, sem
  // clique, sem toast falso. Quando B existir, este card ganha o botão.
  function renderCustomJourneyCard() {
    const card = el('div', 'card journey-choice journey-choice--custom')
    card.setAttribute('aria-disabled', 'true')
    const head = el('div', 'journey-choice-customhead')
    head.append(el('h4', 'journey-choice-title', 'Criar jornada personalizada'))
    head.append(el('span', 'journey-soon', 'Em breve'))
    card.append(head)
    card.append(el('p', 'journey-choice-desc', 'Organize suas atividades preparadas em módulos e missões.'))
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
        const adaptRow = el('div', 'trilha-adapt-row')
        const rodadasField = el('div', 'trilha-adapt-field')
        rodadasField.append(el('label', null, 'Rodadas por missão'))
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

        adaptRow.append(el('span', 'trilha-adapt-hint', 'Deixe vazio pra usar o padrão do currículo'))
        currentCard.append(adaptRow)

        const btn = el('button', 'btn btn-accent btn-sm', 'Liberar módulo')
        btn.type = 'button'
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const adaptations = {}
          if (rodadasInput.value) adaptations.rodadas = Number(rodadasInput.value)
          if (nivelInput.value) adaptations.nivel = Number(nivelInput.value)
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
            emblem.src = `../assets/trilha/emblemas/${mt.emblema}.webp`
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

    appendChildAppLink(currentCard, cycle, 'Testar como criança')
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
  const childName = cycle ? firstName(cycle.children?.name) : null

  const quick = []
  if (hasRecord) {
    quick.push({ label: 'Registrar sessão', icon: CMDK_ICONS.plus, action: () => goRecord('sessions') })
    quick.push({ label: 'Ver perfil pedagógico', icon: CMDK_ICONS.user, action: () => { window.location.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}` } })
  }
  quick.push({ label: 'Abrir biblioteca de atividades', icon: CMDK_ICONS.book, action: () => {
    const c = hasRecord ? currentDerived.cycle : null
    const p = new URLSearchParams()
    if (c) { const cf = firstName(c.children?.name); if (cf) p.set('child', cf); if (c.id) p.set('cycle_id', c.id) }
    window.location.href = 'atividades.html' + (p.toString() ? '?' + p.toString() : '')
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

// ── Tela Início (home antes do record) ────────────────────────────────────────

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

async function buildHomeView(state, cycle, openRecord) {
  const panel = el('section', 'panel')
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}

  const head = el('div', 'home-head')
  const mascot = document.createElement('img')
  mascot.className = 'mascot'
  mascot.src = '../assets/logo-icon-transparent.png'
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
  recentSessionsCache = rows

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
  biblio.href = 'atividades.html'
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
    await activitiesPanel.loadRecentExecucoes?.()
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
    if (pendingActivity && sessionForm) {
      const act = pendingActivity
      pendingActivity = null
      sessionForm.fillSuggestedActivity(act)
      requestAnimationFrame(() => sessionForm.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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

function deriveTutorState(profileStatus, cycles) {
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

// ── Tela Meu perfil (configurações do tutor) ──────────────────────────────────
// V1: só rascunho local. TODO(wiring:profiles): persistir nome/telefone/
// apresentação/formação/disponibilidade/preferências quando o schema existir.

function buildProfileField(labelText, { textarea = false, value = '', placeholder = '', type = 'text' } = {}) {
  const field = el('div', 'field')
  const label = document.createElement('label')
  label.textContent = labelText
  const input = textarea ? document.createElement('textarea') : document.createElement('input')
  if (!textarea) input.type = type
  input.value = value
  input.placeholder = placeholder
  field.append(label, input)
  return field
}

// Perfil deve vender identidade validada, não parecer formulário de cadastro:
// preview (como a família/equipe veem) à esquerda, edição dividida em
// público-pra-família vs. interno-da-equipe à direita.
function buildProfileView() {
  const panel = el('section', 'profile-page')
  const name = session.profile.name || 'Tutor'
  const isPending = REVIEW_STATUSES.includes(session.profile.status)

  const head = el('div', 'profile-head')
  const headCopy = el('div')
  headCopy.append(el('p', 'kicker', 'Meu perfil'), el('h1', null, 'Identidade do tutor'))
  head.append(headCopy)
  if (profileReturn && !profileReturn.startsWith('//') && !/^https?:\/\//i.test(profileReturn)) {
    const backLink = el('a', 'btn btn-ghost btn-sm', 'Voltar para Biblioteca')
    backLink.href = profileReturn
    head.append(backLink)
  }
  panel.append(head)

  const grid = el('div', 'profile-grid')

  const preview = el('div', 'card profile-preview')

  // Linha de foto: avatar (squircle) + controles de troca
  const previewAvatar = el('div', 'profile-avatar')
  previewAvatar.setAttribute('data-profile-avatar', '')
  previewAvatar.textContent = initials(name)
  if (session.profile.avatar_path) {
    getAvatarUrl(session.profile.avatar_path).then((url) => {
      if (!url) return
      previewAvatar.textContent = ''
      const img = document.createElement('img'); img.src = url; img.alt = ''; previewAvatar.append(img)
    })
  }

  const photoCopy = el('p')
  const avatarInput = document.createElement('input')
  avatarInput.type = 'file'; avatarInput.accept = 'image/png,image/jpeg,image/webp'; avatarInput.hidden = true
  const avatarBtn = el('button', 'btn btn-ghost btn-sm', 'Alterar foto')
  avatarBtn.type = 'button'
  const avatarError = el('p', 'form-error'); avatarError.hidden = true; avatarError.style.marginTop = '6px'
  const photoInfo = el('div')
  photoInfo.append(el('strong', null, 'Foto de perfil'), photoCopy, avatarInput, avatarBtn, avatarError)
  const photoRow = el('div', 'profile-photo-row')
  photoRow.append(previewAvatar, photoInfo)
  preview.append(photoRow)

  const previewName = el('div', 'nm', name)
  preview.append(previewName, el('div', 'rl', 'Tutor voluntário · Cognita Hub'))

  const quote = el('div', 'quote')
  const quoteEyebrow = el('div', 'quote-eyebrow')
  quoteEyebrow.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
  quoteEyebrow.append(document.createTextNode('Prévia para a família'))
  const quoteText = el('span', 'quote-text', '')
  quote.append(quoteEyebrow, quoteText)
  preview.append(quote)

  const chips = el('div', 'profile-chips')
  const statusChip = el('span', 'meta-chip')
  statusChip.append(el('span', `dot ${isPending ? 'warn' : 'ok'}`), document.createTextNode(isPending ? 'Em análise pela equipe' : 'Validado pela equipe'))
  const visibleChip = el('span', 'meta-chip')
  visibleChip.append(el('span', 'dot info'), document.createTextNode('Visível após pareamento'))
  const privateChip = el('span', 'meta-chip', 'Contato privado')
  chips.append(statusChip, visibleChip, privateChip)
  preview.append(chips)
  grid.append(preview)

  const stack = el('div', 'stack')

  const publicCard = el('div', 'card')
  publicCard.append(simpleHead('Informações públicas para a família'))
  const publicBody = el('div', 'card-b')

  const nameField = buildProfileField('Nome exibido', { value: name })
  const nameInput = nameField.querySelector('input')
  publicBody.append(nameField)

  const guide = el('div', 'guide')
  guide.style.marginTop = '12px'
  guide.innerHTML = '<strong>A família verá essa apresentação apenas após o pareamento e validação da equipe Cognita.</strong> Não inclua telefone, redes sociais ou contato pessoal direto.'
  publicBody.append(guide)

  const presField = buildProfileField('Como a família verá você', {
    textarea: true,
    value: session.profile.tutor_presentation || '',
    placeholder: 'Olá, sou tutor voluntário no Cognita Hub. Meu foco é apoiar atividades de matemática inicial com calma, previsibilidade e respeito ao ritmo da criança.',
  })
  presField.style.marginTop = '12px'
  const presInput = presField.querySelector('textarea')
  publicBody.append(presField)

  const formField = buildProfileField('Formação / experiência resumida', {
    value: session.profile.tutor_formation || '',
    placeholder: 'Ex.: Pedagogia, 2 anos de experiência com alfabetização matemática.',
  })
  const formInput = formField.querySelector('input')
  formField.style.marginTop = '12px'
  publicBody.append(formField)

  publicCard.append(publicBody)
  stack.append(publicCard)

  const internalCard = el('div', 'card')
  internalCard.append(simpleHead('Informações internas da equipe'))
  const internalBody = el('div', 'card-b')
  const row = el('div', 'row')
  const phoneField = buildProfileField('Telefone de contato', {
    type: 'tel',
    value: session.profile.phone || '',
    placeholder: 'Só a equipe Cognita vê',
  })
  const phoneInput = phoneField.querySelector('input')
  const emailField = buildProfileField('E-mail de contato', {
    type: 'email',
    value: session.user.email ?? '',
  })
  const emailInput = emailField.querySelector('input')
  emailInput.disabled = true
  row.append(phoneField, emailField)
  internalBody.append(row)
  const availField = buildProfileField('Disponibilidade semanal', {
    value: session.profile.tutor_availability || '',
    placeholder: 'Ex.: Terças e quintas, à noite',
  })
  const availInput = availField.querySelector('input')
  availField.style.marginTop = '12px'
  internalBody.append(availField)
  const prefField = buildProfileField('Preferências de atuação', {
    textarea: true,
    value: session.profile.tutor_preferences || '',
    placeholder: 'Ex.: Prefiro crianças mais novas, com apoio visual forte.',
  })
  const prefInput = prefField.querySelector('textarea')
  prefField.style.marginTop = '12px'
  internalBody.append(prefField)
  internalCard.append(internalBody)
  stack.append(internalCard)

  const okBox = el('p', 'form-ok'); okBox.hidden = true
  const saveBtnBottom = el('button', 'btn btn-brand', 'Salvar alterações')
  saveBtnBottom.type = 'button'
  const actions = el('div', 'form-actions')
  actions.append(okBox, saveBtnBottom)
  stack.append(actions)

  grid.append(stack)
  panel.append(grid)

  const updateQuote = () => {
    const text = presInput.value.trim()
    quoteText.textContent = text ? `"${text}"` : 'Escreva como você se apresenta — a prévia aparece aqui.'
    quoteText.classList.toggle('filled', !!text)
  }
  presInput.addEventListener('input', updateQuote)
  updateQuote()

  nameInput.addEventListener('input', () => {
    const v = nameInput.value.trim() || name
    previewName.textContent = v
    if (!previewAvatar.querySelector('img')) previewAvatar.textContent = initials(v)
  })

  avatarBtn.addEventListener('click', () => avatarInput.click())
  avatarInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    avatarError.hidden = true
    try {
      avatarBtn.disabled = true; avatarBtn.textContent = 'Enviando…'
      const objectUrl = URL.createObjectURL(file)
      previewAvatar.textContent = ''
      const previewImg = document.createElement('img'); previewImg.src = objectUrl; previewImg.alt = ''; previewAvatar.append(previewImg)
      setAvatarImage('[data-account-avatar]', objectUrl)
      setAvatarImage('[data-topbar-avatar]', objectUrl)
      setAvatarImage('[data-profile-avatar]', objectUrl)
      // TODO(wiring:storage): requer bucket 'profile-photos' e coluna avatar_path em profiles.
      await uploadTutorAvatar(file)
      avatarBtn.textContent = 'Foto salva'
    } catch (err) {
      avatarError.textContent = err.message || 'Não foi possível enviar a foto.'
      avatarError.hidden = false
      avatarBtn.textContent = 'Alterar foto'
    } finally {
      avatarBtn.disabled = false
      avatarInput.value = ''
    }
  })

  const doSave = async () => {
    okBox.hidden = true
    const payload = {
      name: nameInput.value.trim() || name,
      phone: phoneInput.value.trim() || null,
      tutor_presentation: presInput.value.trim() || null,
      tutor_formation: formInput.value.trim() || null,
      tutor_availability: availInput.value.trim() || null,
      tutor_preferences: prefInput.value.trim() || null,
    }
    saveBtnBottom.disabled = true; saveBtnBottom.textContent = 'Salvando…'
    const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id)
    saveBtnBottom.disabled = false; saveBtnBottom.textContent = 'Salvar alterações'
    if (error) {
      okBox.textContent = 'Não conseguimos salvar agora. Tente novamente.'
      okBox.className = 'form-error'
      okBox.hidden = false
      console.error('Erro ao salvar perfil:', error)
      return
    }
    Object.assign(session.profile, payload)
    const nameEl = document.querySelector('[data-account-name]')
    if (nameEl) nameEl.textContent = payload.name
    previewName.textContent = payload.name
    if (!previewAvatar.querySelector('img')) previewAvatar.textContent = initials(payload.name)
    okBox.textContent = 'Perfil atualizado com sucesso.'
    okBox.className = 'form-ok'
    okBox.hidden = false
  }
  saveBtnBottom.addEventListener('click', doSave)

  return panel
}

// ── Orquestrador / navegação Início ↔ Record ──────────────────────────────────

let currentDerived = null
let currentView = 'home'
let pendingTab = null

async function renderCurrentView() {
  if (!currentDerived || !stateBox) return

  if (currentView === 'profile') {
    setActiveNav('profile')
    renderCrumb('profile', '')
    stateBox.replaceChildren(buildProfileView())
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
    const frag = await buildHomeView(currentDerived.state, currentDerived.cycle, (tab) => goRecord(tab))
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
  renderRail(false, '')
  renderCrumb('home', '')

  const { data: cycles, error } = await getTutorCycles(session.user.id)

  if (error) {
    currentDerived = { state: 'error' }
    stateBox.replaceChildren(renderNoRecord('error', bootstrap))
    return
  }

  currentDerived = deriveTutorState(session.profile.status, cycles)
  const hasRecord = RECORD_STATES.includes(currentDerived.state)
  renderRail(hasRecord, hasRecord ? firstName(currentDerived.cycle.children?.name) : '')
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

if (session && stateBox) {
  fillIdentity()
  await bootstrap()
}
