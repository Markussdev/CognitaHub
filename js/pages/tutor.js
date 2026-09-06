import { supabase } from '../lib/supabase.js'
import { requireRole, signOut } from '../lib/auth.js'
import { greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getAvatarUrl, setAvatarImage } from '../lib/avatar.js'
import { getTutorCycles } from '../data/tutor.js'
import { getCycleSessions, createSessionWithExecucoes } from '../data/sessions.js'
import { getActivityById } from '../data/activities.js'
import { createChildActivity, listChildActivities, updateChildActivity, archiveChildActivity, restoreChildActivity } from '../data/child-activities.js'
import { listPendingExecucoes } from '../data/atividade-execucao.js'
import { MOLDES_REGISTRO, buildContractFromParts, formatConfigResumo } from '../data/moldes-registro.js'
import { PLANOS_REGISTRO } from '../data/planos-registro.js'
import {
  listPublishedTrailTemplates, getTrailTemplateWithModules, getLatestChildTrail,
  getChildTrailModules, getChildTrailMissions, assignChildTrail, releaseChildModule,
  advanceChildTrailModule, reopenChildTrailMission,
} from '../data/trilha-formal.js'
import { createPairingCode, listPairedDevices } from '../data/pareamento.js'
import { derivarEstadoResumo, ESTADOS_RESUMO, moduloAtualDe } from './resumo-estado.js'
import { closeRailDrawer, wireRailToggle } from '../lib/rail.js'
import { DIGITAL_PRESETS } from '../data/digital-presets.js'
import { emblemaUrl, mascoteUrl } from '../lib/trilha-assets.js'
import { getModuleVisual } from '../data/module-visuals.js'
import { getTutorRegistrationState } from '../data/tutor-registration.js'
import { hasActiveTutorCycle } from '../lib/library-access.mjs'

const gatoMatematicoSrc = '/assets/gatomatematico-sem-fundo.png'
const logoIconSrc = '/assets/logo-icon-transparent.png'

const session = await requireRole('tutor')
const stateBox = document.querySelector('[data-tutor-state]')
const tutorRegistration = session ? await getTutorRegistrationState(session.user.id) : null
if (session && !tutorRegistration.error && !tutorRegistration.complete) {
  window.location.replace('/pages/candidatura-tutor.html')
}
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

// ── Controles de formulário (slider, pills) ──────────────────────────────────

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

// ── Registro de sessão — assistente em 3 passos ──────────────────────────────
// A aba Sessões aterrissa numa linha do tempo (buildSessionsPanel); este
// assistente só aparece ao tocar "Registrar sessão". Passo 1: o que aconteceu
// (execuções do Modo Criança e/ou registro manual). Passo 2: como foi —
// perguntas humanas, uma abaixo da outra. Passo 3: a devolutiva pra família,
// COMPOSTA deterministicamente a partir das respostas (sem IA) — o tutor
// revisa e personaliza em vez de escrever tudo duas vezes. O que persiste não
// mudou (createSessionWithExecucoes). Contrato com o resto da tela: .open
// (get/set), .openManual(), .fillSuggestedActivity(), .onPendingLoaded e os
// eventos 'sw-toggle'/'sw-saved' que a linha do tempo escuta.
// TODO(wiring:sessions): persistir participação/apoio/resultado quando o
// schema de sessions ganhar as colunas (engagement/difficulty/result) — hoje
// essas respostas alimentam só a composição da devolutiva.

const PARTICIPACAO_OPTS = [
  { val: 'bem', label: 'Participou bem' },
  { val: 'oscilou', label: 'Oscilou durante a atividade' },
  { val: 'incentivo', label: 'Precisou de incentivo' },
  { val: 'nao_quis', label: 'Não quis participar' },
]
const APOIO_OPTS = [
  { val: 'autonomia', label: 'Fez com autonomia' },
  { val: 'pouco', label: 'Pouco apoio' },
  { val: 'frequente', label: 'Apoio frequente' },
  { val: 'nao_concluiu', label: 'Não foi possível concluir' },
]
const RESULTADO_OPTS = [
  { val: 'avancou', label: 'Avançou' },
  { val: 'manteve', label: 'Manteve o que já sabia' },
  { val: 'dificuldade', label: 'Teve dificuldade' },
  { val: 'retomar', label: 'Ficou para retomar' },
]

function fraseAtividades(titulos) {
  if (!titulos.length) return 'da sessão de hoje'
  if (titulos.length === 1) return `da atividade "${titulos[0]}"`
  if (titulos.length === 2) return `das atividades "${titulos[0]}" e "${titulos[1]}"`
  return `das ${titulos.length} atividades de hoje`
}

// Devolutiva determinística: 2-3 frases curtas montadas a partir das
// respostas do passo 2. O próximo passo NÃO entra aqui — a família já o vê
// como campo próprio (next_step) no painel dela; repetir duplicaria.
function composeFamilySummary({ nome, atividadeFrase, participacao, apoio, resultado }) {
  const primeira = {
    bem: `${nome} participou bem ${atividadeFrase}.`,
    oscilou: `${nome} participou ${atividadeFrase}, alternando momentos de mais e menos envolvimento.`,
    incentivo: `${nome} precisou de incentivo para participar ${atividadeFrase}.`,
    nao_quis: `${nome} não quis participar ${atividadeFrase} desta vez — tudo bem, isso também faz parte do processo.`,
  }[participacao] || `${nome} participou ${atividadeFrase}.`

  const segunda = participacao === 'nao_quis' ? '' : ({
    autonomia: 'Fez as propostas com autonomia.',
    pouco: 'Precisou de pouco apoio pelo caminho.',
    frequente: 'Contou com apoio frequente do tutor.',
    nao_concluiu: 'Não foi possível concluir a proposta desta vez.',
  }[apoio] || '')

  const terceira = {
    avancou: 'Avançou no que estava sendo trabalhado.',
    manteve: 'Manteve o que já vinha construindo.',
    dificuldade: 'Encontrou dificuldade em alguns pontos, que vamos retomar com calma.',
    retomar: 'A atividade ficou para ser retomada no próximo encontro.',
  }[resultado] || ''

  return [primeira, segunda, terceira].filter(Boolean).join(' ')
}

function renderSessionForm(cycle, onSaved) {
  const wrap = el('section', 'sw')
  wrap.hidden = true
  const childName = firstName(cycle.children?.name)

  const blank = () => ({
    step: 1,
    selected: new Set(), // ids de atividade_execucao incluídas na sessão
    manualOpen: false,
    manualTitulo: '',
    manualFoco: '',
    date: todayISO(),
    duration: '',
    durationTouched: false,
    participacao: '',
    apoio: '',
    resultado: '',
    observacao: '',
    proximoPasso: '',
    familyText: '',
    familyEdited: false,
    reviewed: false,
    activityId: null, // vindo da Biblioteca (?activity=)
  })
  let s = blank()
  let pending = []
  let isOpen = false
  let sideBox = null
  let navForward = null

  const tituloDe = (e) => {
    const molde = MOLDES_REGISTRO[e.molde]
    const temaLabel = molde?.temas.find((t) => t.id === e.tema)?.label || e.tema
    const atividade = pickEmbedded(e.child_activities)
    return atividade?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || e.molde} · ${temaLabel}`
  }

  // Fatos derivados da seleção — título/foco/duração nascem das execuções
  // marcadas (+ o registro manual, se houver); o tutor só corrige se precisar.
  function facts() {
    const execs = pending.filter((e) => s.selected.has(e.id))
    const titulos = execs.map(tituloDe)
    if (s.manualTitulo.trim()) titulos.push(s.manualTitulo.trim())
    const focos = [...new Set(execs.map((e) => MOLDES_REGISTRO[e.molde]?.label || e.molde))]
    if (s.manualFoco.trim()) focos.push(s.manualFoco.trim())
    const autoMin = Math.round(execs.reduce((sum, e) => sum + (e.tempo_aproximado_segundos || 0), 0) / 60)
    return {
      titulos,
      activityTitle: titulos.length === 1 ? titulos[0] : `${titulos.length} atividades: ${titulos.join(', ')}`,
      focusArea: focos.join(', '),
      autoMin,
    }
  }

  function syncDuration() {
    if (s.durationTouched) return
    const { autoMin } = facts()
    s.duration = autoMin > 0 ? String(autoMin) : ''
  }

  // Pré-marca as execuções do dia mais recente (uma "experiência").
  function preselectCluster() {
    s.selected.clear()
    if (pending.length) {
      const topDay = new Date(pending[0].created_at).toDateString()
      pending.forEach((e) => { if (new Date(e.created_at).toDateString() === topDay) s.selected.add(e.id) })
    }
    syncDuration()
  }

  function setOpen(open, { manual = false } = {}) {
    if (open && isOpen) return // já aberto: não reseta o que o tutor digitou
    isOpen = open
    wrap.hidden = !open
    if (open) {
      s = blank()
      preselectCluster()
      s.manualOpen = manual || !pending.length
      render()
    }
    wrap.dispatchEvent(new CustomEvent('sw-toggle', { detail: { open } }))
  }
  Object.defineProperty(wrap, 'open', { get: () => isOpen, set: (v) => setOpen(!!v) })
  wrap.openManual = () => setOpen(true, { manual: true })

  wrap.onPendingLoaded = null
  async function loadPending() {
    const { data, error } = await listPendingExecucoes(cycle.child_id, cycle.id)
    pending = error ? [] : (data ?? [])
    wrap.onPendingLoaded?.(pending, !!error)
  }
  loadPending()
  wrap.reloadPending = loadPending

  wrap.fillSuggestedActivity = (activity) => {
    setOpen(true, { manual: true })
    s.manualTitulo = activity?.title || ''
    s.manualFoco = activity?.focus || ''
    s.proximoPasso = activity?.nextStep || ''
    s.activityId = activity?.id || null
    // Vem do Modo Condução (Biblioteca) com a duração já cronometrada — se
    // presente, marca durationTouched pra syncDuration() não sobrescrever.
    if (activity?.durationMinutes) {
      s.duration = String(activity.durationMinutes)
      s.durationTouched = true
    }
    // Observação livre do Modo Condução vira nota interna (tutor-only) —
    // não é o resumo pra família, que continua composto no Passo 3.
    if (activity?.observacaoInterna) s.observacao = activity.observacaoInterna
    render()
  }

  // ── render por passo ──────────────────────────────────────────────────

  const STEP_LABELS = ['O que aconteceu', 'Como foi', 'Família']

  function render() {
    wrap.replaceChildren()
    const grid = el('div', 'sw-grid')
    const main = el('div', 'card sw-main')

    const head = el('div', 'sw-head')
    const headTx = el('div')
    headTx.append(el('h3', 'sw-title', `Registrar sessão de ${childName}`))
    headTx.append(el('p', 'sw-sub', `Passo ${s.step} de 3`))
    head.append(headTx)
    const cancel = el('button', 'btn btn-ghost btn-sm', 'Cancelar')
    cancel.type = 'button'
    cancel.addEventListener('click', () => setOpen(false))
    head.append(cancel)

    const steps = el('div', 'sw-steps')
    STEP_LABELS.forEach((lb, i) => {
      const n = i + 1
      const item = el('span', `sw-step${n === s.step ? ' is-current' : n < s.step ? ' is-done' : ''}`)
      item.append(el('span', 'sw-step-dot', n < s.step ? '✓' : String(n)))
      item.append(document.createTextNode(lb))
      steps.append(item)
    })

    main.append(head, steps)
    if (s.step === 1) main.append(renderStep1())
    else if (s.step === 2) main.append(renderStep2())
    else main.append(renderStep3())
    main.append(renderNav())

    sideBox = renderSide()
    grid.append(main, sideBox)
    wrap.append(grid)
  }

  function updateSide() {
    if (!sideBox) return
    const nb = renderSide()
    sideBox.replaceWith(nb)
    sideBox = nb
  }

  function canContinue() {
    if (s.step === 1) return facts().titulos.length > 0
    if (s.step === 2) return !!(s.participacao && s.apoio && s.resultado)
    return !!(s.familyText.trim() && s.reviewed)
  }
  function updateNav() { if (navForward) navForward.disabled = !canContinue() }

  function goStep(n) {
    s.step = n
    render()
    requestAnimationFrame(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function textField(labelText, value, onInput, placeholder) {
    const f = el('div', 'field')
    f.append(el('label', null, labelText))
    const input = document.createElement('input')
    input.type = 'text'
    input.value = value
    input.placeholder = placeholder || ''
    input.addEventListener('input', () => onInput(input.value))
    f.append(input)
    return f
  }

  // ── Passo 1: o que aconteceu ──────────────────────────────────────────

  function renderExecCard(e) {
    const selected = s.selected.has(e.id)
    const item = el('div', `pending-execucao-item sw-exec${selected ? ' is-selected' : ''}`)
    item.setAttribute('role', 'checkbox')
    item.setAttribute('aria-checked', String(selected))
    item.tabIndex = 0

    const molde = MOLDES_REGISTRO[e.molde]
    const detalhes = [
      `Nível ${e.nivel_final ?? '—'}`,
      COMO_ENCERROU_LABEL[e.como_encerrou],
      formatDuracaoAprox(e.tempo_aproximado_segundos),
      e.precisou_mais_facil ? 'precisou de mais fácil' : null,
    ].filter(Boolean).join(' · ')
    const quando = formatExecucaoQuando(e.created_at)

    const stateLine = el('p', 'sw-exec-state', selected ? '✓ Incluída na sessão' : 'Tocar para incluir')
    item.append(
      el('strong', null, tituloDe(e)),
      el('p', 'pending-execucao-detalhes', [quando ? `Feita ${quando}` : null, detalhes].filter(Boolean).join(' · ')),
      stateLine
    )

    const toggle = () => {
      const on = !s.selected.has(e.id)
      if (on) s.selected.add(e.id); else s.selected.delete(e.id)
      item.classList.toggle('is-selected', on)
      item.setAttribute('aria-checked', String(on))
      stateLine.textContent = on ? '✓ Incluída na sessão' : 'Tocar para incluir'
      syncDuration()
      updateSide()
      updateNav()
    }
    item.addEventListener('click', toggle)
    item.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggle() }
    })
    return item
  }

  function renderStep1() {
    const box = el('div', 'sw-step2')

    if (pending.length) {
      const b = el('div', 'sw-block')
      b.append(el('h4', 'sw-q', `O que ${childName} fez no aparelho?`))
      b.append(el('p', 'sw-hint', 'Toque para incluir ou tirar da sessão — as do dia mais recente já vêm marcadas.'))
      pending.forEach((e) => b.append(renderExecCard(e)))
      box.append(b)
      box.append(el('div', 'sw-divider', 'ou'))
    }

    const manual = document.createElement('details')
    manual.className = 'sw-collapsible'
    manual.open = s.manualOpen || !pending.length
    manual.addEventListener('toggle', () => { s.manualOpen = manual.open })
    const sum = document.createElement('summary')
    sum.textContent = pending.length ? 'Registrar algo feito fora do Modo Criança' : 'O que foi feito na sessão?'
    manual.append(sum)
    const mBody = el('div', 'sw-manual-body')
    mBody.append(textField('Atividade realizada', s.manualTitulo, (v) => { s.manualTitulo = v; syncDuration(); updateSide(); updateNav() }, 'Ex.: Soma com apoio visual — blocos de cores'))
    mBody.append(textField('Foco trabalhado', s.manualFoco, (v) => { s.manualFoco = v; updateSide() }, 'Ex.: Contagem e correspondência 1-a-1'))
    manual.append(mBody)
    box.append(manual)

    const when = el('div', 'sw-block')
    const row = el('div', 'sw-compact-row')
    const dField = el('div', 'field')
    dField.append(el('label', null, 'Data'))
    const dInput = document.createElement('input')
    dInput.type = 'date'
    dInput.value = s.date
    dInput.addEventListener('input', () => { s.date = dInput.value; updateSide() })
    dField.append(dInput)
    const duField = el('div', 'field')
    duField.append(el('label', null, 'Duração (min)'))
    const duInput = document.createElement('input')
    duInput.type = 'number'
    duInput.min = '0'
    duInput.value = s.duration
    duInput.placeholder = 'auto'
    duInput.addEventListener('input', () => { s.duration = duInput.value; s.durationTouched = true; updateSide() })
    duField.append(duInput)
    row.append(dField, duField)
    when.append(row)
    when.append(el('p', 'sw-hint', 'Preenchidas pelas atividades marcadas — ajuste se precisar.'))
    box.append(when)

    return box
  }

  // ── Passo 2: como foi ─────────────────────────────────────────────────

  function questionGroup(titulo, opts, get, set) {
    const b = el('div', 'sw-block')
    b.append(el('h4', 'sw-q', titulo))
    const list = el('div', 'sw-options')
    list.setAttribute('role', 'radiogroup')
    list.setAttribute('aria-label', titulo)
    const btns = []
    opts.forEach(({ val, label }) => {
      const on = get() === val
      const btn = el('button', `sw-option${on ? ' is-selected' : ''}`)
      btn.type = 'button'
      btn.setAttribute('role', 'radio')
      btn.setAttribute('aria-checked', String(on))
      btn.append(el('span', 'sw-option-dot'), document.createTextNode(label))
      btn.addEventListener('click', () => {
        set(val)
        btns.forEach((x) => { x.classList.remove('is-selected'); x.setAttribute('aria-checked', 'false') })
        btn.classList.add('is-selected')
        btn.setAttribute('aria-checked', 'true')
        updateNav()
      })
      btns.push(btn)
      list.append(btn)
    })
    b.append(list)
    return b
  }

  function renderStep2() {
    const box = el('div', 'sw-step2')
    box.append(questionGroup(`Como ${childName} participou?`, PARTICIPACAO_OPTS, () => s.participacao, (v) => { s.participacao = v }))
    box.append(questionGroup('Quanto apoio foi necessário?', APOIO_OPTS, () => s.apoio, (v) => { s.apoio = v }))
    box.append(questionGroup('Como a atividade terminou?', RESULTADO_OPTS, () => s.resultado, (v) => { s.resultado = v }))

    const obs = el('div', 'sw-block')
    obs.append(el('h4', 'sw-q', 'Alguma observação importante? (opcional)'))
    const obsField = el('div', 'field')
    const obsInput = document.createElement('textarea')
    obsInput.value = s.observacao
    obsInput.placeholder = 'Dúvidas técnicas, pontos para revisar com a equipe…'
    obsInput.addEventListener('input', () => { s.observacao = obsInput.value })
    obsField.append(obsInput)
    obs.append(obsField)
    const lockHint = el('p', 'sw-note-hint')
    lockHint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    lockHint.append(document.createTextNode('Nota interna — a família nunca vê o que você escrever aqui.'))
    obs.append(lockHint)
    box.append(obs)

    const plan = document.createElement('details')
    plan.className = 'sw-collapsible'
    plan.open = !!s.proximoPasso
    const psum = document.createElement('summary')
    psum.textContent = 'Adicionar planejamento (opcional)'
    plan.append(psum)
    const pBody = el('div', 'sw-manual-body')
    const pField = el('div', 'field')
    const pInput = document.createElement('textarea')
    pInput.value = s.proximoPasso
    pInput.placeholder = 'O que trabalhar na próxima sessão?'
    pInput.addEventListener('input', () => { s.proximoPasso = pInput.value })
    pField.append(pInput)
    pBody.append(pField)
    pBody.append(el('p', 'sw-hint', 'A família vê isso como "próximo passo".'))
    plan.append(pBody)
    box.append(plan)

    return box
  }

  // ── Passo 3: o que a família recebe ───────────────────────────────────

  function renderStep3() {
    if (!s.familyEdited || !s.familyText.trim()) {
      s.familyText = composeFamilySummary({
        nome: childName,
        atividadeFrase: fraseAtividades(facts().titulos),
        participacao: s.participacao,
        apoio: s.apoio,
        resultado: s.resultado,
      })
      s.familyEdited = false
    }

    const box = el('div', 'sw-step2')

    const preview = el('div', 'family-preview')
    preview.append(el('div', 'family-preview-label', 'Como a família verá'))
    preview.append(el('strong', null, `${childName}: resumo da sessão`))
    const previewSummary = el('p', null, s.familyText)
    preview.append(previewSummary)
    const next = s.proximoPasso.trim()
    if (next) preview.append(el('p', null, `Próximo passo: ${next}`))

    const b1 = el('div', 'sw-block')
    b1.append(el('h4', 'sw-q', 'O que a família vai receber'))
    b1.append(el('p', 'sw-hint', 'Montamos este resumo a partir das suas respostas — revise e deixe com a sua voz.'))
    const fField = el('div', 'field')
    const fInput = document.createElement('textarea')
    fInput.value = s.familyText
    fInput.maxLength = 800
    fInput.style.minHeight = '110px'
    fField.append(fInput)
    const counter = el('div', 'char-count', `${s.familyText.length} / 800 caracteres`)
    fInput.addEventListener('input', () => {
      s.familyText = fInput.value
      s.familyEdited = true
      counter.textContent = `${fInput.value.length} / 800 caracteres`
      previewSummary.textContent = fInput.value.trim() || '…'
      updateNav()
    })
    b1.append(fField, counter)
    const regen = el('button', 'btn btn-ghost btn-sm sw-regen', '↻ Gerar sugestão novamente')
    regen.type = 'button'
    regen.addEventListener('click', () => { s.familyEdited = false; s.familyText = ''; render() })
    b1.append(regen)

    const rev = el('label', 'sw-review')
    const rcb = document.createElement('input')
    rcb.type = 'checkbox'
    rcb.checked = s.reviewed
    rcb.addEventListener('change', () => { s.reviewed = rcb.checked; updateNav() })
    rev.append(rcb, document.createTextNode('Revisei a mensagem que será compartilhada com a família.'))

    const err = el('p', 'form-error')
    err.hidden = true
    err.dataset.swErr = ''

    box.append(b1, preview, el('p', 'sw-hint', 'Use linguagem simples, respeitosa e baseada no que você observou.'), rev, err)
    return box
  }

  // ── navegação + salvar ────────────────────────────────────────────────

  function renderNav() {
    const nav = el('div', 'sw-nav')
    const left = el('div')
    if (s.step > 1) {
      const back = el('button', 'btn btn-ghost', 'Voltar')
      back.type = 'button'
      back.addEventListener('click', () => goStep(s.step - 1))
      left.append(back)
    }
    nav.append(left)

    if (s.step < 3) {
      navForward = el('button', 'btn btn-accent', 'Continuar')
      navForward.type = 'button'
      navForward.addEventListener('click', () => { if (canContinue()) goStep(s.step + 1) })
    } else {
      navForward = el('button', 'btn btn-accent', 'Salvar e compartilhar')
      navForward.type = 'button'
      navForward.addEventListener('click', onSave)
    }
    navForward.disabled = !canContinue()
    nav.append(navForward)
    return nav
  }

  async function onSave() {
    const err = wrap.querySelector('[data-sw-err]')
    if (err) err.hidden = true
    const f = facts()
    const familySummary = s.familyText.trim()
    if (!familySummary || !s.reviewed) { updateNav(); return }

    navForward.disabled = true
    navForward.textContent = 'Salvando…'

    const { error } = await createSessionWithExecucoes({
      cycleId: cycle.id,
      activityId: s.activityId,
      sessionDate: s.date || todayISO(),
      durationMinutes: s.duration ? Number(s.duration) : null,
      activityTitle: f.activityTitle,
      focusArea: f.focusArea,
      familySummary,
      notes: s.observacao.trim() || null,
      nextStep: s.proximoPasso.trim(),
      execucaoIds: [...s.selected],
    })

    navForward.disabled = false
    navForward.textContent = 'Salvar e compartilhar'

    if (error) {
      if (err) {
        err.textContent = 'Não conseguimos salvar agora. Nada foi perdido — tente novamente.'
        err.hidden = false
      }
      return
    }

    setOpen(false)
    await loadPending()
    wrap.dispatchEvent(new CustomEvent('sw-saved'))
    await onSaved()
  }

  // ── lateral: resumo vivo da sessão ────────────────────────────────────

  function renderSide() {
    const side = document.createElement('details')
    side.className = 'card sw-side'
    side.open = window.matchMedia('(min-width: 941px)').matches
    const sum = document.createElement('summary')
    sum.textContent = 'Resumo da sessão'
    side.append(sum)

    const f = facts()
    const dl = document.createElement('dl')
    const add = (dt, dd) => {
      const a = document.createElement('dt'); a.textContent = dt
      const b = document.createElement('dd'); b.textContent = dd
      dl.append(a, b)
    }
    add('Data', formatDate(s.date) ?? '—')
    add('Duração', s.duration ? `${s.duration} min` : '—')
    add('Atividades', f.titulos.length
      ? (f.titulos.length <= 2 ? f.titulos.join(' · ') : `${f.titulos.length} atividades`)
      : 'Nenhuma ainda')
    side.append(dl)
    side.append(el('p', 'sw-side-hint', s.step === 3
      ? 'Ao salvar, a família já vê o resumo.'
      : 'Nada é salvo até o passo 3.'))
    return side
  }

  return wrap
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
// existentes.
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
        return { ti: 'O ciclo começa em breve.', ds: 'Leia o perfil pedagógico e revise as informações antes da primeira sessão.',
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
  const childFirst = firstName(cycle.children?.name)

  const stack = el('div', 'stack')
  stack.style.maxWidth = 'none'

  if (state === 'cycle_active') {
    // Linha do tempo: a aba aterrissa aqui (pendências + CTA + histórico) —
    // o assistente de registro só aparece depois do clique, nunca de cara.
    const timeline = el('div', 'card')
    const inner = el('div', 'sw-timeline-inner')
    const tx = el('div')
    const titleEl = el('strong', 'sw-timeline-title', 'Carregando…')
    const subEl = el('p', 'sw-timeline-sub', '')
    tx.append(titleEl, subEl)
    const cta = el('button', 'btn btn-accent', 'Registrar sessão')
    cta.type = 'button'
    inner.append(tx, cta)
    timeline.append(inner)
    const miniList = el('div', 'sw-timeline-list')
    timeline.append(miniList)
    const okFlash = el('p', 'form-ok sw-timeline-ok')
    okFlash.hidden = true
    timeline.append(okFlash)

    sessionForm.onPendingLoaded = (rows, hadError) => {
      miniList.replaceChildren()
      if (hadError) {
        titleEl.textContent = 'Não foi possível carregar as atividades pendentes.'
        subEl.textContent = 'Você ainda pode registrar a sessão normalmente.'
        cta.className = 'btn btn-accent'
        cta.textContent = 'Registrar sessão'
        cta.onclick = () => { sessionForm.open = true }
        return
      }
      if (rows.length) {
        titleEl.textContent = rows.length === 1
          ? `1 atividade de ${childFirst} aguardando registro`
          : `${rows.length} atividades de ${childFirst} aguardando registro`
        subEl.textContent = 'Transforme o que a criança fez numa devolutiva para a família.'
        cta.className = 'btn btn-accent'
        cta.textContent = 'Registrar sessão'
        cta.onclick = () => { sessionForm.open = true }
        rows.slice(0, 3).forEach((e) => {
          const item = el('div', 'sw-timeline-item')
          item.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
          const molde = MOLDES_REGISTRO[e.molde]
          const temaLabel = molde?.temas.find((t) => t.id === e.tema)?.label || e.tema
          const titulo = pickEmbedded(e.child_activities)?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || e.molde} · ${temaLabel}`
          item.append(document.createTextNode([titulo, formatExecucaoQuando(e.created_at)].filter(Boolean).join(' · ')))
          miniList.append(item)
        })
        if (rows.length > 3) miniList.append(el('div', 'sw-timeline-item sw-timeline-more', `e mais ${rows.length - 3}…`))
      } else {
        titleEl.textContent = 'Nenhuma atividade aguardando registro.'
        subEl.textContent = 'Você ainda pode registrar uma sessão realizada fora do Modo Criança.'
        cta.className = 'btn btn-ghost'
        cta.textContent = 'Registrar manualmente'
        cta.onclick = () => sessionForm.openManual()
      }
    }

    // Enquanto o assistente está aberto, ele É o conteúdo da aba — linha do
    // tempo e histórico saem de cena pra sobrar um foco só.
    sessionForm.addEventListener('sw-toggle', (ev) => {
      timeline.hidden = ev.detail.open
      historyCard.hidden = ev.detail.open
      if (ev.detail.open) okFlash.hidden = true
    })
    sessionForm.addEventListener('sw-saved', () => {
      okFlash.textContent = 'Sessão registrada. A família já consegue acompanhar o resumo.'
      okFlash.hidden = false
    })

    stack.append(timeline, sessionForm)
  } else {
    const LOCKED = {
      cycle_planned: 'O registro de sessões libera assim que a equipe ativar o ciclo. Por enquanto, dá para conferir o perfil pedagógico em "Ver perfil".',
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
  img.src = gatoMatematicoSrc
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

// ── Painel: Atividades — acervo + assistente de criação ──────────────────────
// A aba aterrissa num ACERVO (lista com filtros), não num formulário; criar/
// editar/duplicar abre um assistente de 3 passos (mesma casca visual das
// Sessões) com a prévia REAL do Modo Criança fixa à direita — o iframe roda a
// própria casca (?preview=1) e recebe o contrato ao vivo via postMessage.
// O que salva é a instância child_activities. O motor
// (moldes declarativos em MOLDES_REGISTRO, buildContractFromParts) não mudou.
// "Últimas execuções" saiu daqui — essa informação vive no Resumo (timeline)
// e em Sessões (aguardando registro); cada aba com um trabalho só.

// Emblemas por molde (mesmos assets da Jornada). 'revisar' existe mas não é
// um molde autorável; tudo que não é 'contar' cai em 'identificar'.
function emblemaDeMolde(molde) {
  return emblemaUrl(molde === 'contar' ? 'contar' : 'identificar')
}

// Descrição pedagógica de cada experiência (o tutor escolhe a experiência,
// não um "molde" técnico). Fica aqui e não no registro porque é copy da
// tela de autoria, não contrato da casca.
const MOLDE_DESCRICAO = {
  contar: 'A criança toca nos elementos enquanto conta.',
  identificar: 'A criança encontra o número pedido entre algumas opções.',
  comparar: 'A criança compara quantidades e escolhe a maior.',
  associar: 'A criança liga cada número à quantidade certa.',
}

// Frase humana do passo de revisão. Fallback genérico cobre moldes futuros.
const FRASE_REVISAO = {
  contar: (cfg, temaLabel, nome) => `${nome} vai contar até ${cfg.quantidade} com ${temaLabel.toLowerCase()}, em ${cfg.rodadas} ${cfg.rodadas === 1 ? 'rodada' : 'rodadas'}.`,
  identificar: (cfg, temaLabel, nome) => `${nome} vai encontrar números de 1 a ${cfg.maiorNumero}, entre ${cfg.opcoes} opções, em ${cfg.rodadas} ${cfg.rodadas === 1 ? 'rodada' : 'rodadas'}.`,
}

// Menu contextual "⋯" — concentra Duplicar/Editar/Arquivar num lugar só,
// em vez de uma fileira de botões por item do acervo.
function kebabMenu(items) {
  const wrap = el('div', 'kebab')
  const btn = el('button', 'btn btn-ghost btn-sm kebab-btn', '⋯')
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Mais ações')
  btn.setAttribute('aria-haspopup', 'true')
  btn.setAttribute('aria-expanded', 'false')
  const menu = el('div', 'kebab-menu')
  menu.hidden = true

  function close() {
    menu.hidden = true
    btn.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', onDoc)
    document.removeEventListener('keydown', onKey)
  }
  function onDoc(ev) { if (!wrap.contains(ev.target)) close() }
  function onKey(ev) { if (ev.key === 'Escape') close() }

  items.forEach(({ label, run, tone }) => {
    const it = el('button', `kebab-item${tone ? ` kebab-item--${tone}` : ''}`, label)
    it.type = 'button'
    it.addEventListener('click', () => { close(); run() })
    menu.append(it)
  })

  btn.addEventListener('click', () => {
    if (menu.hidden) {
      menu.hidden = false
      btn.setAttribute('aria-expanded', 'true')
      setTimeout(() => {
        document.addEventListener('click', onDoc)
        document.addEventListener('keydown', onKey)
      }, 0)
    } else close()
  })

  wrap.append(btn, menu)
  return wrap
}

// ── Assistente de criação/edição de atividade (3 passos + prévia viva) ──────

function renderActivityWizard(cycle, onSaved) {
  const wrap = el('section', 'aw')
  wrap.hidden = true
  const childName = firstName(cycle.children?.name)
  const childAge = ageFrom(cycle.children?.birth_date)

  // Completa o estado com os padrões do molde/tema — chamada tanto ao criar
  // do zero quanto ao trocar de experiência no passo 1.
  function withMoldeDefaults(base) {
    const molde = MOLDES_REGISTRO[base.molde]
    const tema = base.tema ?? molde.temas.find((t) => t.disponivel)?.id
    const temaLabel = molde.temas.find((t) => t.id === tema)?.label || ''
    const config = {}
    molde.campos.forEach((c) => { config[c.key] = base.config?.[c.key] ?? c.default })
    return {
      ...base,
      tema,
      config,
      instrucao: base.instrucao ?? (molde.instrucaoPadrao || ''),
      titulo: base.titulo ?? (molde.tituloPadrao?.(temaLabel) || molde.label),
      textTouched: base.textTouched ?? false,
    }
  }
  const blank = () => {
    const moldeKey = Object.entries(MOLDES_REGISTRO).find(([, m]) => m.disponivel)?.[0]
    return withMoldeDefaults({ step: 1, mode: 'create', editingId: null, molde: moldeKey })
  }
  let s = blank()
  let isOpen = false
  let navForward = null

  // Prévia estável: criada UMA vez (recriar por passo recarregaria o iframe).
  // É o Modo Criança de verdade em ?preview=1 — não grava nada.
  const previewIframe = document.createElement('iframe')
  previewIframe.src = 'modo-crianca.html?preview=1'
  previewIframe.title = 'Prévia do Modo Criança'
  previewIframe.addEventListener('load', pushPreview)
  const previewCard = el('div', 'card aw-preview')
  const previewHead = el('div', 'card-h')
  const previewHeadInner = el('div', 'preview-card-h')
  previewHeadInner.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
  previewHeadInner.append(document.createTextNode('O que a criança vê — ao vivo'))
  previewHead.append(previewHeadInner)
  const previewFrameWrap = el('div', 'preview-frame-wrap')
  const previewFrame = el('div', 'preview-frame')
  previewFrame.append(previewIframe)
  previewFrameWrap.append(previewFrame)
  previewCard.append(previewHead, previewFrameWrap)

  function pushPreview() {
    if (!previewIframe.contentWindow) return
    const contract = buildContractFromParts({
      molde: s.molde, tema: s.tema, config: s.config, instrucao: s.instrucao, titulo: s.titulo,
    })
    previewIframe.contentWindow.postMessage({ type: 'cognita-preview-contract', contract }, window.location.origin)
  }

  const grid = el('div', 'aw-grid')
  const main = el('div', 'card sw-main')
  grid.append(main, previewCard)
  wrap.append(grid)

  function setOpen(open) {
    isOpen = open
    wrap.hidden = !open
    wrap.dispatchEvent(new CustomEvent('aw-toggle', { detail: { open } }))
    if (open) { render(); pushPreview() }
  }
  wrap.openCreate = () => { s = blank(); setOpen(true) }
  wrap.openEdit = (row) => {
    s = withMoldeDefaults({
      step: 1, mode: 'edit', editingId: row.id,
      molde: row.molde, tema: row.tema, config: row.config,
      instrucao: row.instrucao, titulo: row.titulo, textTouched: true,
    })
    setOpen(true)
  }
  wrap.openDuplicate = (row) => {
    const molde = MOLDES_REGISTRO[row.molde]
    const temaLabel = molde?.temas.find((t) => t.id === row.tema)?.label || row.tema
    const base = row.titulo || molde?.tituloPadrao?.(temaLabel) || molde?.label || ''
    s = withMoldeDefaults({
      step: 1, mode: 'duplicate', editingId: null,
      molde: row.molde, tema: row.tema, config: row.config,
      instrucao: row.instrucao, titulo: `${base} (cópia)`.trim(), textTouched: true,
    })
    setOpen(true)
  }
  // Ponte "Personalizar para Mateus" vinda da Biblioteca (?preset=<slug>,
  // resolvido via DIGITAL_PRESETS) — abre o passo 2 (Ajustar) já com
  // molde/tema/config prontos; o tutor só confirma. mode 'create': salva
  // como atividade nova, não referencia a Biblioteca por id (é só o ponto
  // de partida, não uma cópia de registro).
  wrap.openFromPreset = (preset) => {
    s = withMoldeDefaults({
      step: 2, mode: 'create', editingId: null,
      molde: preset.molde, tema: preset.tema, config: preset.config, textTouched: false,
    })
    setOpen(true)
  }

  const STEP_LABELS = ['Experiência', 'Ajustar', 'Revisar']

  function render() {
    main.replaceChildren()

    const head = el('div', 'sw-head')
    const headTx = el('div')
    headTx.append(el('h3', 'sw-title', s.mode === 'edit' ? 'Editar atividade' : 'Criar atividade'))
    headTx.append(el('p', 'sw-sub', `para ${childName}${childAge != null ? ` · ${childAge} anos` : ''} · Passo ${s.step} de 3`))
    head.append(headTx)
    const cancel = el('button', 'btn btn-ghost btn-sm', 'Cancelar')
    cancel.type = 'button'
    cancel.addEventListener('click', () => setOpen(false))
    head.append(cancel)

    const steps = el('div', 'sw-steps')
    STEP_LABELS.forEach((lb, i) => {
      const n = i + 1
      const item = el('span', `sw-step${n === s.step ? ' is-current' : n < s.step ? ' is-done' : ''}`)
      item.append(el('span', 'sw-step-dot', n < s.step ? '✓' : String(n)))
      item.append(document.createTextNode(lb))
      steps.append(item)
    })

    main.append(head, steps)
    if (s.step === 1) main.append(renderStep1())
    else if (s.step === 2) main.append(renderStep2())
    else main.append(renderStep3())
    main.append(renderNav())
  }

  function canContinue() {
    if (s.step === 1) return !!s.molde
    if (s.step === 2) return !!s.instrucao.trim()
    return true
  }
  function updateNav() { if (navForward) navForward.disabled = !canContinue() }
  function goStep(n) {
    s.step = n
    render()
    requestAnimationFrame(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // Passo 1 — escolher a experiência (cards explicativos, não pills técnicas)
  function renderStep1() {
    const box = el('div', 'sw-step2')
    const b = el('div', 'sw-block')
    b.append(el('h4', 'sw-q', 'Que experiência você quer criar?'))
    const list = el('div', 'sw-options')
    Object.entries(MOLDES_REGISTRO).forEach(([id, m]) => {
      const card = el('button', `aw-exp${s.molde === id ? ' is-selected' : ''}`)
      card.type = 'button'
      if (!m.disponivel) { card.disabled = true; card.setAttribute('aria-disabled', 'true') }
      const img = el('img', 'aw-exp-emblem')
      img.src = emblemaDeMolde(id)
      img.alt = ''
      const tx = el('span', 'aw-exp-tx')
      tx.append(el('span', 'aw-exp-title', m.disponivel ? m.label : `${m.label} — em breve`))
      tx.append(el('span', 'aw-exp-desc', MOLDE_DESCRICAO[id] || ''))
      card.append(img, tx)
      if (m.disponivel) {
        card.addEventListener('click', () => {
          if (s.molde === id) return
          s = withMoldeDefaults({
            ...s, molde: id,
            tema: undefined, config: undefined, instrucao: undefined, titulo: undefined,
            textTouched: false,
          })
          render()
          pushPreview()
        })
      }
      list.append(card)
    })
    b.append(list)
    box.append(b)
    return box
  }

  // Passo 2 — tema + ajustes (campos dinâmicos do registro) + texto recolhido
  function renderStep2() {
    const molde = MOLDES_REGISTRO[s.molde]
    const box = el('div', 'sw-step2')

    const bTema = el('div', 'sw-block')
    bTema.append(el('h4', 'sw-q', 'Qual será o tema?'))
    const temaList = el('div', 'sw-options')
    molde.temas.forEach((t) => {
      const btn = el('button', `sw-option${s.tema === t.id ? ' is-selected' : ''}`)
      btn.type = 'button'
      if (!t.disponivel) btn.disabled = true
      btn.append(el('span', 'sw-option-dot'), document.createTextNode(t.disponivel ? t.label : `${t.label} — em breve`))
      btn.addEventListener('click', () => {
        s.tema = t.id
        if (!s.textTouched) s.titulo = molde.tituloPadrao?.(t.label) || molde.label
        render()
        pushPreview()
      })
      temaList.append(btn)
    })
    bTema.append(temaList)
    box.append(bTema)

    const bCfg = el('div', 'sw-block')
    bCfg.append(el('h4', 'sw-q', `Ajustar para ${childName}`))
    const pillsRow = el('div', 'row')
    molde.campos.forEach((campo) => {
      const make = campo.control === 'slider' ? makeSlider : makePillSelector
      const control = make({
        label: campo.label, min: campo.min, max: campo.max,
        value: s.config[campo.key] ?? campo.default,
        onChange: (v) => { s.config[campo.key] = v; pushPreview() },
      })
      if (campo.control === 'slider') bCfg.append(control.field)
      else pillsRow.append(control.field)
    })
    if (pillsRow.children.length) bCfg.append(pillsRow)
    box.append(bCfg)

    const det = document.createElement('details')
    det.className = 'sw-collapsible'
    det.open = false
    const sum = document.createElement('summary')
    sum.textContent = 'Personalizar texto e instrução'
    det.append(sum)
    const dBody = el('div', 'sw-manual-body')
    const instField = el('div', 'field')
    instField.append(el('label', null, 'O que a criança lê'))
    const instInput = document.createElement('textarea')
    instInput.value = s.instrucao
    instInput.addEventListener('input', () => { s.instrucao = instInput.value; s.textTouched = true; pushPreview(); updateNav() })
    instField.append(instInput)
    const titField = el('div', 'field')
    titField.append(el('label', null, 'Título (só para você identificar)'))
    const titInput = document.createElement('input')
    titInput.type = 'text'
    titInput.value = s.titulo
    titInput.addEventListener('input', () => { s.titulo = titInput.value; s.textTouched = true })
    titField.append(titInput)
    dBody.append(instField, titField)
    det.append(dBody)
    box.append(det)
    box.append(el('p', 'sw-hint', 'Os textos padrão já funcionam bem — personalize só se quiser.'))
    return box
  }

  // Passo 3 — revisão humana; a prévia ao lado é o destaque
  function renderStep3() {
    const molde = MOLDES_REGISTRO[s.molde]
    const temaLabel = molde.temas.find((t) => t.id === s.tema)?.label || s.tema
    const frase = FRASE_REVISAO[s.molde]?.(s.config, temaLabel, childName)
      || `"${s.titulo}" — ${formatConfigResumo(s.molde, s.config)}.`

    const box = el('div', 'sw-step2')
    const b = el('div', 'sw-block')
    b.append(el('h4', 'sw-q', s.mode === 'edit' ? 'Revisar alterações' : 'Revisar e salvar'))
    b.append(el('p', 'aw-review', frase))
    b.append(el('p', 'sw-hint', `${s.titulo} · ${molde.label} · ${temaLabel} · ${formatConfigResumo(s.molde, s.config)}`))
    const err = el('p', 'form-error')
    err.hidden = true
    err.dataset.awErr = ''
    b.append(err)
    box.append(b)
    box.append(el('p', 'sw-hint', 'Confira a prévia ao lado — é exatamente o que a criança verá.'))
    return box
  }

  function renderNav() {
    const nav = el('div', 'sw-nav')
    const left = el('div')
    if (s.step > 1) {
      const back = el('button', 'btn btn-ghost', 'Voltar')
      back.type = 'button'
      back.addEventListener('click', () => goStep(s.step - 1))
      left.append(back)
    }
    nav.append(left)

    if (s.step < 3) {
      navForward = el('button', 'btn btn-accent', 'Continuar')
      navForward.type = 'button'
      navForward.addEventListener('click', () => { if (canContinue()) goStep(s.step + 1) })
      navForward.disabled = !canContinue()
      nav.append(navForward)
    } else {
      const right = el('div', 'aw-save-row')
      const fazerBtn = el('button', 'btn btn-ghost', `Salvar e fazer agora`)
      fazerBtn.type = 'button'
      fazerBtn.addEventListener('click', () => save({ fazerAgora: true, btn: fazerBtn }))
      const saveBtn = el('button', 'btn btn-accent', s.mode === 'edit' ? 'Salvar alterações' : 'Salvar atividade')
      saveBtn.type = 'button'
      saveBtn.addEventListener('click', () => save({ fazerAgora: false, btn: saveBtn }))
      navForward = saveBtn
      right.append(fazerBtn, saveBtn)
      nav.append(right)
    }
    return nav
  }

  async function save({ fazerAgora, btn }) {
    const errEl = wrap.querySelector('[data-aw-err]')
    if (errEl) errEl.hidden = true

    const instrucao = s.instrucao.trim()
    if (!instrucao) {
      if (errEl) { errEl.textContent = 'A instrução para a criança está vazia — volte ao passo 2 e escreva.'; errEl.hidden = false }
      return
    }
    const molde = MOLDES_REGISTRO[s.molde]
    const temaLabel = molde.temas.find((t) => t.id === s.tema)?.label || ''
    const titulo = s.titulo.trim() || molde.tituloPadrao?.(temaLabel) || molde.label

    btn.disabled = true
    const oldLabel = btn.textContent
    btn.textContent = 'Salvando…'
    const { data, error } = s.mode === 'edit'
      ? await updateChildActivity(s.editingId, { molde: s.molde, tema: s.tema, config: s.config, instrucao, titulo })
      : await createChildActivity({
          childId: cycle.child_id,
          createdBy: session.user.id,
          cycleId: cycle.id,
          molde: s.molde,
          tema: s.tema,
          config: s.config,
          instrucao,
          titulo,
        })
    btn.disabled = false
    btn.textContent = oldLabel

    if (error) {
      if (errEl) { errEl.textContent = 'Não conseguimos salvar agora. Nada foi perdido — tente novamente.'; errEl.hidden = false }
      return
    }

    const savedId = s.mode === 'edit' ? s.editingId : data?.id
    if (fazerAgora && savedId) {
      // vai direto pro Modo Criança REAL (grava execução) — volta pra aba
      // Sessões, onde a execução aparece pra virar registro.
      window.location.href = `modo-crianca.html?${new URLSearchParams({ activity: savedId, return: 'tutor.html?view=record&tab=sessions' })}`
      return
    }
    setOpen(false)
    wrap.dispatchEvent(new CustomEvent('aw-saved'))
    await onSaved?.()
  }

  return wrap
}

// ── Painel: Atividades (acervo) ─────────────────────────────────────────────

function buildActivitiesPanel(cycle, state, onSaved) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'activities'
  panel.hidden = true
  const childName = firstName(cycle.children?.name)

  const stack = el('div', 'stack')
  stack.style.maxWidth = 'none'

  const LOCKED = {
    cycle_paused: 'Preparar atividades fica bloqueado enquanto o ciclo estiver pausado. Fale com a equipe Cognita para retomar.',
    cycle_completed: 'Este ciclo já foi concluído — não é mais possível preparar novas atividades. O que já foi preparado continua listado abaixo.',
  }
  const locked = !!LOCKED[state]

  const acervo = el('div', 'stack')
  acervo.style.maxWidth = 'none'

  let wizard = null

  const head = el('div', 'acervo-head')
  const headTx = el('div')
  headTx.append(el('h3', 'acervo-title', `Atividades de ${childName}`))
  headTx.append(el('p', 'acervo-sub', 'Prepare experiências individuais ou use-as em uma Jornada.'))
  head.append(headTx)
  if (!locked) {
    wizard = renderActivityWizard(cycle, onSaved)
    const createBtn = el('button', 'btn btn-accent', '+ Criar atividade')
    createBtn.type = 'button'
    createBtn.addEventListener('click', () => wizard.openCreate())
    head.append(createBtn)
  }
  acervo.append(head)

  if (locked) {
    const lockedCard = el('div', 'card')
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(LOCKED[state]))
    lockedCard.append(note)
    acervo.append(lockedCard)
  }

  // ── filtros ──
  let filtro = 'todas'
  let allRows = []
  const FILTERS = [
    { id: 'todas', label: 'Todas' },
    { id: 'avulsas', label: 'Avulsas' },
    { id: 'jornada', label: 'Em Jornada' },
    { id: 'arquivadas', label: 'Arquivadas' },
  ]
  const filtersRow = el('div', 'acervo-filters')
  const chipEls = {}
  FILTERS.forEach(({ id, label }) => {
    const chip = el('button', `filter-chip${id === filtro ? ' active' : ''}`)
    chip.type = 'button'
    chip.append(document.createTextNode(label), el('span', 'num', ''))
    chip.addEventListener('click', () => { filtro = id; renderList() })
    chipEls[id] = chip
    filtersRow.append(chip)
  })
  acervo.append(filtersRow)

  const listWrap = el('div', 'acervo-list')
  acervo.append(listWrap)

  function matchesFiltro(row, f) {
    if (f === 'arquivadas') return row.status === 'archived'
    if (row.status === 'archived') return false
    if (f === 'avulsas') return !row.child_trail_mission_id
    if (f === 'jornada') return !!row.child_trail_mission_id
    return true
  }

  async function onArchive(row) {
    const titulo = row.titulo || MOLDES_REGISTRO[row.molde]?.tituloPadrao?.(row.tema) || 'esta atividade'
    const ok = window.confirm(`Arquivar "${titulo}"? Ela sai da lista ativa, mas o histórico de execuções e sessões continua guardado.`)
    if (!ok) return
    const { error } = await archiveChildActivity(row.id)
    if (error) { window.alert('Não conseguimos arquivar agora. Tente de novo em instantes.'); return }
    await onSaved?.()
  }

  async function onRestore(row) {
    const { error } = await restoreChildActivity(row.id)
    if (error) { window.alert('Não conseguimos restaurar agora. Tente de novo em instantes.'); return }
    await onSaved?.()
  }

  function renderAcervoItem(row) {
    const molde = MOLDES_REGISTRO[row.molde]
    const temaLabel = molde?.temas.find((t) => t.id === row.tema)?.label || row.tema
    const titulo = row.titulo || molde?.tituloPadrao?.(temaLabel) || row.molde
    const item = el('div', 'card acervo-item')

    const emblem = el('img', 'acervo-emblem')
    emblem.src = emblemaDeMolde(row.molde)
    emblem.alt = ''

    const tx = el('div', 'acervo-tx')
    tx.append(el('strong', 'acervo-item-title', titulo))
    tx.append(el('p', 'acervo-item-meta', `${molde?.label || row.molde} · ${temaLabel} · ${formatConfigResumo(row.molde, row.config)}`))

    const missaoStatus = row.child_trail_mission_id ? pickEmbedded(row.child_trail_missions)?.status : null
    const statusLine = el('p', 'acervo-item-status')
    if (row.status === 'archived') {
      statusLine.append(el('span', 'pill pill-mid', 'Arquivada'))
    } else if (row.child_trail_mission_id) {
      const cls = missaoStatus === 'disponivel' ? 'pill-ok' : 'pill-mid'
      statusLine.append(el('span', `pill ${cls}`, `Jornada · ${MISSION_STATUS_LABEL[missaoStatus] || missaoStatus || '—'}`))
    } else {
      statusLine.append(document.createTextNode(`Avulsa · criada ${formatLastSession(row.created_at?.slice(0, 10))}`))
    }
    tx.append(statusLine)

    const actions = el('div', 'acervo-actions')
    // Avulsa sempre executável; missão de Jornada só quando 'disponivel'
    // (repetir/adaptar é decisão da Jornada, não um clique aqui).
    const podeExecutar = row.status !== 'archived' && (!row.child_trail_mission_id || missaoStatus === 'disponivel')
    if (podeExecutar) {
      const link = el('a', 'btn btn-ghost btn-sm', `Fazer com ${childName}`)
      link.href = `modo-crianca.html?${new URLSearchParams({ activity: row.id, return: 'tutor.html?view=record&tab=sessions' })}`
      actions.append(link)
    }
    // Atividade de Jornada é administrada pela Jornada — sem editar/arquivar.
    if (!locked && wizard && !row.child_trail_mission_id) {
      const items = row.status === 'archived'
        ? [
            { label: 'Restaurar', run: () => onRestore(row) },
            { label: 'Duplicar', run: () => wizard.openDuplicate(row) },
          ]
        : [
            { label: 'Editar', run: () => wizard.openEdit(row) },
            { label: 'Duplicar', run: () => wizard.openDuplicate(row) },
            { label: 'Arquivar', run: () => onArchive(row), tone: 'bad' },
          ]
      actions.append(kebabMenu(items))
    }

    item.append(emblem, tx, actions)
    return item
  }

  const EMPTY_MSG = {
    avulsas: 'Nenhuma atividade avulsa ainda.',
    jornada: 'Nenhuma atividade de Jornada — elas nascem quando você libera um módulo.',
    arquivadas: 'Nada arquivado.',
  }

  function renderList() {
    FILTERS.forEach(({ id }) => {
      chipEls[id].classList.toggle('active', id === filtro)
      chipEls[id].querySelector('.num').textContent = String(allRows.filter((r) => matchesFiltro(r, id)).length)
    })
    const rows = allRows.filter((r) => matchesFiltro(r, filtro))
    listWrap.replaceChildren()
    if (!rows.length) {
      if (filtro === 'todas' && !allRows.length) {
        const emptyCard = el('div', 'card')
        const emptyBody = el('div', 'card-b')
        const empty = el('div', 'empty-state')
        const img = document.createElement('img')
        img.src = gatoMatematicoSrc
        img.alt = ''
        empty.append(
          img,
          el('strong', null, 'Nenhuma atividade preparada ainda.'),
          el('span', null, `Crie uma experiência simples para começar com ${childName} — leva menos de um minuto.`)
        )
        emptyBody.append(empty)
        emptyCard.append(emptyBody)
        listWrap.append(emptyCard)
      } else {
        listWrap.append(el('p', 'acervo-empty', EMPTY_MSG[filtro] || 'Nada por aqui.'))
      }
      return
    }
    rows.forEach((r) => listWrap.append(renderAcervoItem(r)))
  }

  function renderLoadError() {
    listWrap.replaceChildren()
    const card = el('div', 'card')
    const body = el('div', 'card-b')
    const inner = el('div', 'error-card')
    inner.append(
      el('strong', null, 'Não conseguimos carregar as atividades agora.'),
      el('p', null, 'Verifique a conexão e tente novamente.')
    )
    const retry = el('button', 'btn btn-ghost', 'Tentar novamente')
    retry.type = 'button'
    retry.addEventListener('click', () => panel.loadTable())
    inner.append(retry)
    body.append(inner)
    card.append(body)
    listWrap.append(card)
  }

  async function loadAcervo() {
    const { data, error } = await listChildActivities(cycle.child_id, { incluirArquivadas: true })
    if (error) { renderLoadError(); return [] }
    allRows = data ?? []
    renderList()
    // o badge da aba conta só as ativas (arquivada não é "preparada")
    return allRows.filter((r) => r.status !== 'archived')
  }

  if (wizard) {
    wizard.addEventListener('aw-toggle', (ev) => { acervo.hidden = ev.detail.open })
    stack.append(acervo, wizard)
  } else {
    stack.append(acervo)
  }
  panel.append(stack)

  panel.loadTable = loadAcervo
  // undefined nos estados bloqueados (sem wizard pra receber) — mesmo padrão
  // de prefillFromPlano. Único chamador: a ponte ?preset=<slug> em bootstrap().
  panel.openPreset = wizard ? (preset) => wizard.openFromPreset(preset) : undefined
  return panel
}

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

  if (hasActiveTutorCycle(cycle)) {
    const biblio = el('a', 'shortcut-item')
    biblio.href = buildLibraryHref(cycle)
    biblio.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
    biblio.append(document.createTextNode('Biblioteca'))
    shortcuts.append(biblio)
  }

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
  if (currentDerived?.state === 'cycle_active' && profileReturn && !profileReturn.startsWith('//') && !/^https?:\/\//i.test(profileReturn)) {
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
