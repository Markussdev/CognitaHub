import { supabase } from '../lib/supabase.js'
import { requireRole, signOut } from '../lib/auth.js'
import { greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { getCycleSessions, createSessionRecord } from '../data/sessions.js'
import { getActivityById } from '../data/activities.js'

const session = await requireRole('tutor')
const stateBox = document.querySelector('[data-tutor-state]')

// Detecta ?activity=<uuid> e pré-busca a atividade (vem da Biblioteca via "Usar no registro")
let pendingActivity = null
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

document.querySelector('[data-cmdk-trigger]')?.addEventListener('click', openCommandPalette)
document.querySelector('[data-cmdk-backdrop]')?.addEventListener('click', closeCommandPalette)
document.querySelector('[data-cmdk-input]')?.addEventListener('input', (e) => renderCommandResults(e.target.value))
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return }
  if (e.key === 'Escape') { closeSupportDrawer(); closeCommandPalette() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

// ── Avatar (Supabase Storage, bucket privado) ─────────────────────────────────

const AVATAR_BUCKET = 'profile-photos'

function getFileExt(file) {
  return file.name.split('.').pop()?.toLowerCase() || 'png'
}

function validateAvatarFile(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WEBP.')
  if (file.size > 2 * 1024 * 1024) throw new Error('A imagem precisa ter até 2MB.')
}

async function getAvatarUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600)
  if (error) { console.warn('Erro ao carregar avatar:', error); return null }
  return data.signedUrl
}

async function uploadTutorAvatar(file) {
  validateAvatarFile(file)
  const filePath = `${session.user.id}/avatar-${Date.now()}.${getFileExt(file)}`
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
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

function setAvatarImage(sel, url) {
  const node = document.querySelector(sel)
  if (!node) return
  node.textContent = ''
  const img = document.createElement('img')
  img.src = url; img.alt = ''
  node.append(img)
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

// ── Formulário de sessão (3 níveis) ──────────────────────────────────────────

function renderSessionForm(cycle, onSaved) {
  const details = el('details', 'card form')
  const childName = firstName(cycle.children?.name)
  let _selectedActivityId = null

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
    //   result=result.getValue(), internal_note=internalInput.value.trim() quando o schema for atualizado.

    const { error } = await createSessionRecord({
      cycleId: cycle.id,
      activityId: _selectedActivityId,
      sessionDate: dateInput.value || todayISO(),
      durationMinutes: durInput.value ? Number(durInput.value) : null,
      activityTitle: actTitle,
      focusArea: focusInput.value.trim(),
      notes: familySummary,
      nextStep: nextInput.value.trim(),
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

function buildOverviewPanel(cycle, state, openForm, useSuggestedActivity) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'overview'

  const cols = el('div', 'cols')

  // Coluna esquerda — detalhes pedagógicos
  const detailsCard = el('div', 'card')
  const detailsHead = el('div', 'card-h')
  detailsHead.append(el('h3', null, 'Detalhes pedagógicos'))
  const profileLink = el('a', 'card-h-link', 'Ver perfil completo →')
  profileLink.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
  detailsHead.append(profileLink)

  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const detailsBody = el('div', 'card-b')
  const kv = el('dl', 'kv')

  const addKv = (icon, label, valueNode) => {
    const dt = el('dt')
    if (icon) dt.innerHTML = icon
    dt.append(document.createTextNode(label))
    const dd = document.createElement('dd')
    dd.append(valueNode)
    kv.append(dt, dd)
  }

  addKv(
    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    'Meta do ciclo',
    document.createTextNode(cycle.main_goal || 'Fortalecer contagem até 10 com apoio visual.')
  )

  const difficultiesList = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
  const focusValue = (() => {
    if (!difficultiesList.length) return document.createTextNode('Ainda não informado pela equipe.')
    const chips = el('div', 'chips')
    difficultiesList.forEach((d, i) => chips.append(el('span', `chip chip--${(i % 3) + 1}`, d)))
    return chips
  })()
  addKv(null, 'Foco atual', focusValue)

  addKv(null, 'Preferências', document.createTextNode(
    formatList(lp.preferred_formats, 'Apoio visual e temas concretos.')
  ))
  addKv(null, 'Concentração', document.createTextNode(
    formatAttentionSpan(lp.attention_span, 'Sessões curtas, com pausas frequentes.')
  ))
  addKv(null, 'Motivadores', document.createTextNode(
    formatList(lp.motivators, 'Elogio específico e atividades com manipulação de objetos.')
  ))
  addKv(null, 'O que dificulta', document.createTextNode(
    formatList(lp.avoidances, 'Instruções longas e sequências extensas sem apoio.')
  ))

  detailsBody.append(kv)
  detailsCard.append(detailsHead, detailsBody)

  // Coluna direita — próxima ação, sugestão, suporte, feed
  const side = el('div', 'stack')

  const NEXTBAR = {
    cycle_active: { tone: 'tone-default', lb: 'Próxima ação', ti: 'Registrar a sessão desta semana', ds: 'O resumo aparece para a família na hora.', btn: 'Registrar' },
    cycle_planned: { tone: 'tone-default', lb: 'Aguardando ativação', ti: 'Ciclo ainda não começou', ds: 'A equipe Cognita avisa você assim que os registros forem liberados.' },
    cycle_paused: { tone: 'tone-warn', lb: 'Ciclo pausado', ti: 'Registros bloqueados por enquanto', ds: 'Fale com a equipe Cognita para entender os próximos passos.' },
    cycle_completed: { tone: 'tone-ok', lb: 'Ciclo concluído', ti: 'Acompanhamento finalizado', ds: 'Obrigado pelo cuidado com essa criança. O histórico continua na aba Sessões.' },
  }
  const nb = NEXTBAR[state] ?? NEXTBAR.cycle_active
  const nextbar = el('div', `nextbar ${nb.tone}`)
  const nbIco = el('div', 'ico')
  nbIco.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  const nbTx = el('div', 'tx')
  nbTx.append(el('div', 'lb', nb.lb), el('div', 'ti', nb.ti), el('div', 'ds', nb.ds))
  nextbar.append(nbIco, nbTx)
  if (nb.btn) {
    const nbBtn = el('button', 'btn btn-ghost btn-sm', nb.btn)
    nbBtn.type = 'button'
    nbBtn.addEventListener('click', openForm)
    nextbar.append(nbBtn)
  }
  side.append(nextbar)

  const activity = pickSuggestedActivity(difficultiesList)

  if (state === 'cycle_active' || state === 'cycle_planned') {
    const sgCard = el('div', 'card suggestion-card')
    sgCard.append(simpleHead('Atividade sugerida'))
    const sgBody = el('div', 'card-b')
    sgBody.append(
      el('div', 'sg-title', activity.title),
      el('div', 'sg-why', `Por que: ${activity.why}`)
    )
    const facts = el('div', 'sg-facts')
    ;[activity.skill, activity.time, activity.materials].forEach((f) => facts.append(el('span', null, f)))
    sgBody.append(facts)

    const actionsRow = el('div', 'rec-actions')
    actionsRow.style.cssText = 'margin-top:13px;gap:8px'
    if (state === 'cycle_active') {
      const useBtn = el('button', 'btn btn-ghost btn-sm', 'Usar no registro')
      useBtn.type = 'button'
      useBtn.addEventListener('click', () => useSuggestedActivity(activity))
      actionsRow.append(useBtn)
    }
    const openLink = el('a', 'btn btn-ghost btn-sm', 'Abrir biblioteca')
    openLink.href = 'atividades.html'
    actionsRow.append(openLink)
    sgBody.append(actionsRow)
    sgCard.append(sgBody)
    side.append(sgCard)
  }

  // Feed
  const feedCard = el('div', 'card feed-card')
  feedCard.append(simpleHead('Atividade recente'))
  const feedBody = el('div', 'card-b')
  const feed = el('div', 'feed')
  feedBody.append(feed)
  feedCard.append(feedBody)
  side.append(feedCard)

  cols.append(detailsCard, side)
  panel.append(cols)

  panel.renderFeed = (rows) => {
    const items = []
    rows.slice(0, 2).forEach((r) => {
      items.push({
        tone: 'you',
        icon: `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
        html: `<b>Você</b> registrou a sessão`,
        sub: [r.activity_title, r.focus_area ? `foco em ${r.focus_area}` : null].filter(Boolean).join(' · '),
        time: formatLastSession(r.date),
      })
    })
    if (cycle.main_goal) {
      items.push({
        tone: 'team',
        icon: `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
        html: `<b>Equipe Cognita</b> definiu o plano do ciclo`,
        sub: `Objetivo: ${cycle.main_goal}`,
        time: formatDate(cycle.start_date) ?? '',
      })
    }
    items.push({
      tone: 'team',
      icon: `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>`,
      html: `<b>Você</b> foi vinculado a ${firstName(child.name)}`,
      sub: 'Ciclo de 6 meses iniciado',
      time: formatDate(cycle.start_date) ?? '',
    })

    renderFeedItems(feed, items)
  }

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

// ── Painel: Plano ──────────────────────────────────────────────────────────────

function buildPlanPanel(cycle) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'plan'
  panel.hidden = true

  const cols = el('div', 'cols')

  const planCard = el('div', 'card')
  const planHead = el('div', 'card-h')
  planHead.append(el('h3', null, 'Plano da semana — definido pela equipe'))
  const suggestBtn = el('button', 'btn btn-ghost btn-sm', 'Sugerir ajuste')
  suggestBtn.type = 'button'
  planHead.append(suggestBtn)

  const planBody = el('div', 'card-b')
  const kv = el('dl', 'kv')
  ;[
    ['Objetivo', cycle.main_goal || 'Fortalecer contagem até 10 com apoio visual.'],
    ['Etapa atual', cycle.current_plan || 'Sessão inicial com blocos, imagens ou objetos concretos.'],
    ['Critério de avanço', 'Avançar quando a criança contar até 10 com menos apoio em 2 sessões seguidas.'],
    ['Observação', 'Usar instruções curtas e evitar atividades longas sem pausa.'],
  ].forEach(([k, v]) => {
    kv.append(el('dt', null, k), el('dd', null, v))
  })
  planBody.append(kv)

  const suggestNote = el('p', 'card-copy', 'Em breve você poderá sugerir ajustes ao plano por aqui — por enquanto, fale com a equipe.')
  suggestNote.hidden = true
  suggestNote.style.marginTop = '10px'
  suggestBtn.addEventListener('click', () => { suggestNote.hidden = false })
  planBody.append(suggestNote)
  planCard.append(planHead, planBody)

  const stepsCard = el('div', 'card')
  stepsCard.append(simpleHead('Etapas do ciclo'))
  const stepsBody = el('div', 'card-b')
  const steps = el('div', 'steps')
  ;[
    { label: 'Reconhecer e contar 1 a 5', desc: 'Etapa atual — grupos pequenos com objetos concretos.', cls: 'now' },
    { label: 'Contar até 10', desc: 'Aumentar a sequência com apoio visual.', cls: '' },
    { label: 'Comparar quantidades', desc: 'Qual grupo tem mais? Mais ou menos.', cls: '' },
    { label: 'Adição simples', desc: 'Juntar dois grupos pequenos.', cls: '' },
  ].forEach(({ label, desc, cls }, i) => {
    const step = el('div', `step${cls ? ` ${cls}` : ''}`)
    step.append(el('div', 'step-n', String(i + 1)))
    const copy = el('div')
    copy.append(el('b', null, label), el('p', null, desc))
    step.append(copy)
    steps.append(step)
  })
  stepsBody.append(steps)
  stepsCard.append(stepsBody)

  cols.append(planCard, stepsCard)
  panel.append(cols)
  return panel
}

// ── Painel: Relatórios ──────────────────────────────────────────────────────────

function buildReportsPanel(cycle) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'reports'
  panel.hidden = true

  const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)

  const cols = el('div', 'cols')

  const reportCard = el('div', 'card')
  const reportHead = el('div', 'card-h')
  reportHead.append(el('h3', null, `Relatório mensal — Mês ${currentMonth}`))
  reportHead.append(el('span', 'pill pill-mid', 'Pendente'))
  const reportBody = el('div', 'card-b')
  reportBody.append(el('p', 'card-copy', `Mês ${currentMonth} de ${totalMonths}. Resume evolução observada, dificuldades persistentes, próximos focos e sugestão para a família. Passa por revisão da equipe antes de chegar ao responsável.`))
  const mini = el('ul', 'mini')
  ;['Evolução observada', 'Dificuldades persistentes', 'Próximos focos', 'Sugestão para a família'].forEach((item) => mini.append(el('li', null, item)))
  reportBody.append(mini)

  const details = el('details', 'form')
  details.style.marginTop = '14px'
  const summary = document.createElement('summary')
  summary.append(document.createTextNode(`Criar relatório do mês ${currentMonth}`))
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  chevron.setAttribute('viewBox', '0 0 24 24')
  chevron.innerHTML = '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  summary.append(chevron)
  const detailsBody = el('div', 'form-body')
  const textarea = document.createElement('textarea')
  textarea.placeholder = 'Rascunhe os pontos principais do mês...'
  textarea.style.minHeight = '110px'
  detailsBody.append(textarea, el('p', 'card-copy', 'Rascunho local — em breve isso vira um relatório de verdade para a equipe revisar. Por enquanto, nada aqui é salvo.'))
  details.append(summary, detailsBody)
  reportBody.append(details)
  reportCard.append(reportHead, reportBody)

  const historyCard = el('div', 'card')
  historyCard.append(simpleHead('Histórico de relatórios'))
  const historyBody = el('div', 'card-b')
  const historyEmpty = el('div', 'empty-state')
  const historyImg = document.createElement('img')
  historyImg.src = '../assets/gatoprancheta-sem-fundo.png'
  historyImg.alt = ''
  historyEmpty.append(
    historyImg,
    el('strong', null, 'Nenhum relatório enviado ainda.'),
    el('span', null, `O do mês ${currentMonth} será solicitado ao fim do mês.`)
  )
  historyBody.append(historyEmpty)
  historyCard.append(historyBody)

  cols.append(reportCard, historyCard)
  panel.append(cols)
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

  frag.append(el('p', 'card-copy', 'Quando algo sair do esperado, a equipe está aqui. Escolha o tipo e descreva a situação.'))

  const typeField = el('div', 'field')
  typeField.append(el('label', null, 'Tipo de solicitação'))
  const type = makeScaleGroup([
    { label: 'Dúvida sobre atividade', val: 'activity', tone: '' },
    { label: 'Ajuste no plano', val: 'plan', tone: '' },
    { label: 'Questão com responsável', val: 'guardian', tone: '' },
    { label: 'Pausa no ciclo', val: 'pause', tone: 'warn' },
    { label: 'Situação sensível', val: 'sensitive', tone: 'warn' },
    { label: 'Outro', val: 'other', tone: '' },
  ])
  typeField.append(type.group)
  frag.append(typeField)

  const msgField = el('div', 'field')
  const msgLabel = document.createElement('label')
  msgLabel.textContent = 'Mensagem'
  const msgInput = document.createElement('textarea')
  msgInput.placeholder = 'Descreva a situação com o máximo de detalhes possível...'
  msgField.append(msgLabel, msgInput)
  frag.append(msgField)

  const errorBox = el('p', 'form-error'); errorBox.hidden = true
  const okBox = el('p', 'form-ok'); okBox.hidden = true
  const sendBtn = el('button', 'btn btn-accent btn-sm', 'Enviar para equipe')
  sendBtn.type = 'button'

  sendBtn.addEventListener('click', () => {
    errorBox.hidden = true; okBox.hidden = true
    if (!msgInput.value.trim()) {
      errorBox.textContent = 'Escreva uma mensagem antes de enviar.'; errorBox.hidden = false
      msgInput.focus(); return
    }
    // TODO(wiring:support_requests): persistir em support_requests quando a tabela existir.
    // Por enquanto fica só local — use e-mail/WhatsApp abaixo para contato imediato.
    msgInput.value = ''
    type.reset()
    okBox.textContent = 'Mensagem registrada. Por enquanto isso fica só com você — use e-mail ou WhatsApp abaixo para falar com a equipe agora.'
    okBox.hidden = false
  })

  const actions = el('div', 'form-actions')
  actions.append(errorBox, okBox, sendBtn)
  frag.append(actions)

  frag.append(el('div', 'support-divider'))

  frag.append(el('p', 'card-copy', 'Para algo urgente, fale direto com a equipe. Tempo médio de resposta: até 48h.'))
  const contactActions = el('div', 'rec-actions')
  contactActions.style.cssText = 'gap:8px;flex-direction:column;align-items:stretch'
  const mail = el('a', 'btn btn-ghost btn-sm', 'Enviar e-mail')
  mail.href = `mailto:equipecognita@email.com?subject=${encodeURIComponent(childName ? `Ajuda no ciclo de ${childName}` : 'Ajuda no Cognita Hub')}`
  const whats = el('a', 'btn btn-ghost btn-sm', 'Chamar no WhatsApp')
  whats.href = 'https://wa.me/5500000000000'
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

// ── Painel: Orientações (contexto do ciclo, não suporte geral) ───────────────

function buildOrientationsPanel(cycle, childName) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'orientations'
  panel.hidden = true

  const cols = el('div', 'cols')
  const left = el('div', 'stack')

  const planCard = el('div', 'card card--accent')
  planCard.append(simpleHead('Última orientação da equipe'))
  const planBody = el('div', 'card-b')
  planBody.append(el('p', 'card-copy', cycle.main_goal
    ? `Meta definida para o ciclo: ${cycle.main_goal}`
    : 'A equipe ainda não registrou uma orientação específica para este ciclo.'))
  if (cycle.current_plan) {
    const stepP = el('p', 'card-copy', `Etapa atual: ${cycle.current_plan}`)
    stepP.style.marginTop = '8px'
    planBody.append(stepP)
  }
  planCard.append(planBody)
  left.append(planCard)

  const adjustCard = el('div', 'card')
  adjustCard.append(simpleHead('Ajustes solicitados'))
  const adjustBody = el('div', 'card-b')
  adjustBody.append(el('p', 'card-copy', 'Nenhum ajuste pendente. Quando a equipe responder a uma solicitação sua sobre este ciclo, a resposta aparece aqui.'))
  adjustCard.append(adjustBody)
  left.append(adjustCard)

  const notesCard = el('div', 'card')
  notesCard.append(simpleHead('Observações internas liberadas ao tutor'))
  const notesBody = el('div', 'card-b')
  notesBody.append(el('p', 'card-copy', 'Sem observações adicionais da equipe por enquanto.'))
  notesCard.append(notesBody)
  left.append(notesCard)

  const right = el('div', 'stack')

  const historyCard = el('div', 'card')
  historyCard.append(simpleHead('Histórico de decisões do ciclo'))
  const historyBody = el('div', 'card-b')
  const feed = el('div', 'feed')
  const items = []
  if (cycle.main_goal) {
    items.push({
      tone: 'team',
      icon: `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      html: '<b>Equipe Cognita</b> definiu o plano do ciclo',
      sub: `Objetivo: ${cycle.main_goal}`,
      time: formatDate(cycle.start_date) ?? '',
    })
  }
  items.push({
    tone: 'team',
    icon: `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>`,
    html: `<b>Ciclo</b> iniciado com ${childName}`,
    sub: 'Acompanhamento de 6 meses',
    time: formatDate(cycle.start_date) ?? '',
  })
  renderFeedItems(feed, items)
  historyBody.append(feed)
  historyCard.append(historyBody)
  right.append(historyCard)

  const ctaCard = el('div', 'card card--warm')
  ctaCard.append(simpleHead('Precisa falar com a equipe?'))
  const ctaBody = el('div', 'card-b')
  ctaBody.append(el('p', 'card-copy', `Dúvidas sobre atividade, ajustes no plano ou qualquer situação sensível com ${childName}.`))
  const ctaBtn = el('button', 'btn btn-accent btn-sm', `Abrir solicitação sobre ${childName}`)
  ctaBtn.type = 'button'
  ctaBtn.style.marginTop = '12px'
  ctaBtn.addEventListener('click', () => openSupportDrawer(childName))
  ctaBody.append(ctaBtn)
  ctaCard.append(ctaBody)
  right.append(ctaCard)

  cols.append(left, right)
  panel.append(cols)
  return panel
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

function renderRecordHeader(cycle, state, openForm) {
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

  const actions = el('div', 'rec-actions')
  const REG_CONFIG = {
    cycle_active: { enabled: true, text: 'Registrar sessão', action: openForm },
    cycle_planned: { enabled: false, text: 'Ciclo não iniciado' },
    cycle_paused: { enabled: false, text: 'Ciclo pausado' },
    cycle_completed: { enabled: true, text: 'Ver histórico', action: () => switchTab('sessions') },
  }
  const cfg = REG_CONFIG[state] ?? REG_CONFIG.cycle_active
  const regBtn = el('button', 'btn btn-accent')
  regBtn.type = 'button'
  regBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  regBtn.append(document.createTextNode(cfg.text))
  regBtn.disabled = !cfg.enabled
  if (cfg.action) regBtn.addEventListener('click', cfg.action)
  actions.append(regBtn)

  const profileLink = el('a', 'btn btn-ghost', 'Ver perfil')
  profileLink.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
  actions.append(profileLink)

  top.append(main, actions)
  header.append(top)
  return header
}

function renderTabs(sessionCount) {
  const tabs = el('div', 'tabs')
  tabs.setAttribute('role', 'tablist')
  ;[
    { id: 'overview', label: 'Visão geral' },
    { id: 'sessions', label: 'Sessões', badge: sessionCount },
    { id: 'plan', label: 'Plano' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'orientations', label: 'Orientações' },
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
  const childName = firstName(cycle.children?.name)

  let sessionForm
  const refreshSessions = async () => {
    const rows = await sessionsPanel.loadTable()
    recentSessionsCache = rows
    overviewPanel.renderFeed(rows)
    const badge = tabs.querySelector('[data-tab="sessions"] .badge')
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

  const useSuggestedActivity = (activity) => {
    sessionForm?.fillSuggestedActivity?.(activity)
    openForm()
  }

  const header = renderRecordHeader(cycle, state, openForm)
  const tabs = renderTabs(0)
  const overviewPanel = buildOverviewPanel(cycle, state, openForm, useSuggestedActivity)
  const sessionsPanel = buildSessionsPanel(cycle, state, sessionForm)
  const planPanel = buildPlanPanel(cycle)
  const reportsPanel = buildReportsPanel(cycle)
  const orientationsPanel = buildOrientationsPanel(cycle, childName)

  frag.append(header, tabs, overviewPanel, sessionsPanel, planPanel, reportsPanel, orientationsPanel)

  queueMicrotask(() => {
    wireTabs()
    refreshSessions()
    if (initialTab && initialTab !== 'overview') switchTab(initialTab)
    if (pendingActivity && sessionForm) {
      const act = pendingActivity
      pendingActivity = null
      sessionForm.fillSuggestedActivity(act)
      requestAnimationFrame(() => sessionForm.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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
  const _viewParam = new URLSearchParams(location.search).get('view')
  if (_viewParam === 'profile') {
    currentView = 'profile'
  } else if (pendingActivity && hasRecord) {
    currentView = 'record'
    pendingTab = 'sessions'
  } else {
    currentView = 'home'
  }
  await renderCurrentView()
}

if (session && stateBox) {
  fillIdentity()
  await bootstrap()
}
