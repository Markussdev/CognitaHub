import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { getCycleSessions, createSessionRecord } from '../data/sessions.js'

const session = await requireRole('tutor')
const stateBox = document.querySelector('[data-tutor-state]')

setupFocusMode()

document.querySelectorAll('[data-logout]').forEach((btn) => {
  btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
})

document.querySelectorAll('.rail-link').forEach((link) => {
  if (link.getAttribute('href') === '#') link.addEventListener('click', (e) => e.preventDefault())
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00Z`)
  return isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

function truncateText(value, max = 110) {
  const text = (value ?? '').trim()
  return text.length > max ? `${text.slice(0, max).trim()}...` : text
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

const SUGGESTED_ACTIVITY = {
  title: 'Blocos de contagem coloridos',
  skill: 'contagem até 10',
  focus: 'contagem, adição simples e comparação de quantidades',
  time: '15-20 min',
  materials: 'blocos, tampinhas ou objetos pequenos',
  why: 'Combina com apoio visual e dura pouco — bom para sessões curtas.',
  nextStep: 'Repetir contagem até 10 com apoio visual e comparar dois grupos pequenos.',
}

// ── Identidade (uma vez por sessão) ──────────────────────────────────────────

function fillIdentity() {
  const name = session.profile.name || 'Tutor'
  const set = (sel, val) => { const n = document.querySelector(sel); if (n) n.textContent = val }
  set('[data-account-name]', name)
  set('[data-account-avatar]', initials(name))
  set('[data-topbar-avatar]', initials(name))
  set('[data-account-email]', session.user.email ?? '')
}

// ── Rail / breadcrumb ─────────────────────────────────────────────────────────

function renderRail(hasRecord, childName) {
  const group = document.querySelector('[data-rail-acomp-group]')
  const slot = document.querySelector('[data-rail-child-slot]')
  const teamLink = document.querySelector('[data-rail-team]')
  if (!slot) return

  if (!hasRecord) {
    group.hidden = true
    slot.replaceChildren()
    teamLink.hidden = true
    return
  }

  group.hidden = false
  teamLink.hidden = false

  const link = el('a', 'rail-link active')
  link.href = '#'
  link.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>`
  link.append(document.createTextNode(childName))
  link.addEventListener('click', (e) => { e.preventDefault(); switchTab('overview') })
  slot.replaceChildren(link)
}

function renderCrumb(hasRecord, childName) {
  const crumb = document.querySelector('[data-crumb]')
  if (!crumb) return
  crumb.replaceChildren()
  if (hasRecord) {
    crumb.append(document.createTextNode('Acompanhamento / '), el('b', null, childName))
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
    previewNext.textContent = `Próximo passo: ${next || SUGGESTED_ACTIVITY.nextStep}`
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

  details.fillSuggestedActivity = (activity = SUGGESTED_ACTIVITY) => {
    actInput.value = activity.title
    focusInput.value = activity.focus
    if (!nextInput.value.trim()) nextInput.value = activity.nextStep
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

  const difficulties = lp.math_difficulties?.length ? lp.math_difficulties : child.main_difficulties
  const focusValue = (() => {
    if (!difficulties?.length) return document.createTextNode('Ainda não informado pela equipe.')
    const chips = el('div', 'chips')
    ;(Array.isArray(difficulties) ? difficulties : [difficulties]).forEach((d) => chips.append(el('span', 'chip', d)))
    return chips
  })()
  addKv(null, 'Foco atual', focusValue)

  addKv(null, 'Preferências', document.createTextNode(
    lp.preferred_formats?.length ? lp.preferred_formats.join(', ') : 'Apoio visual e temas concretos.'
  ))
  addKv(null, 'Concentração', document.createTextNode(
    lp.attention_span || 'Sessões curtas, com pausas frequentes.'
  ))
  addKv(null, 'Motivadores', document.createTextNode(
    lp.motivators || 'Elogio específico e atividades com manipulação de objetos.'
  ))
  addKv(null, 'O que dificulta', document.createTextNode(
    lp.avoidances || 'Instruções longas e sequências extensas sem apoio.'
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

  if (state === 'cycle_active' || state === 'cycle_planned') {
    const sgCard = el('div', 'card suggestion-card')
    sgCard.append(simpleHead('Atividade sugerida'))
    const sgBody = el('div', 'card-b')
    sgBody.append(
      el('div', 'sg-title', SUGGESTED_ACTIVITY.title),
      el('div', 'sg-why', `Por que: ${SUGGESTED_ACTIVITY.why}`)
    )
    const facts = el('div', 'sg-facts')
    ;[SUGGESTED_ACTIVITY.skill, SUGGESTED_ACTIVITY.time, SUGGESTED_ACTIVITY.materials].forEach((f) => facts.append(el('span', null, f)))
    sgBody.append(facts)

    const actionsRow = el('div', 'rec-actions')
    actionsRow.style.cssText = 'margin-top:13px;gap:8px'
    if (state === 'cycle_active') {
      const useBtn = el('button', 'btn btn-ghost btn-sm', 'Usar no registro')
      useBtn.type = 'button'
      useBtn.addEventListener('click', () => useSuggestedActivity(SUGGESTED_ACTIVITY))
      actionsRow.append(useBtn)
    }
    const openLink = el('a', 'btn btn-ghost btn-sm', 'Abrir biblioteca')
    openLink.href = 'atividades.html'
    actionsRow.append(openLink)
    sgBody.append(actionsRow)
    sgCard.append(sgBody)
    side.append(sgCard)
  }

  // Suporte
  const supportCard = el('section', 'card')
  supportCard.id = 'team-support'
  const supportHead = el('div', 'card-h')
  supportHead.append(el('h3', null, 'Falar com equipe'))
  const supportBody = el('div', 'card-b')
  supportBody.append(el('p', 'card-copy', 'Procure a equipe se a criança demonstrar desconforto, a atividade estiver difícil demais ou você precisar ajustar o plano. Resposta em até 48h.'))
  const supportActions = el('div', 'rec-actions')
  supportActions.style.cssText = 'margin-top:11px;gap:8px'
  const mail = el('a', 'btn btn-ghost btn-sm', 'Enviar e-mail')
  mail.href = 'mailto:equipecognita@email.com?subject=Ajuda%20no%20ciclo%20Cognita'
  const whats = el('a', 'btn btn-ghost btn-sm', 'WhatsApp')
  whats.href = 'https://wa.me/5500000000000'
  whats.target = '_blank'; whats.rel = 'noopener'
  supportActions.append(mail, whats)
  supportBody.append(supportActions)
  supportCard.append(supportHead, supportBody)
  side.append(supportCard)

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
    feed.replaceChildren()
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

    items.forEach((item) => {
      const row = el('div', 'feed-item')
      const ico = el('div', `feed-ico ${item.tone}`)
      ico.innerHTML = item.icon
      const tx = el('div', 'feed-tx')
      tx.innerHTML = item.html
      if (item.sub) tx.append(el('span', 'sub', item.sub))
      row.append(ico, tx)
      if (item.time) row.append(el('div', 'feed-time', item.time))
      feed.append(row)
    })
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
  historyBody.style.cssText = 'padding:20px 0;text-align:center'
  historyBody.append(el('p', 'card-copy', `Nenhum relatório enviado ainda. O do mês ${currentMonth} será solicitado ao fim do mês.`))
  historyCard.append(historyBody)

  cols.append(reportCard, historyCard)
  panel.append(cols)
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
  ].forEach(({ id, label, badge }, i) => {
    const tab = el('button', `tab${i === 0 ? ' active' : ''}`)
    tab.type = 'button'; tab.dataset.tab = id; tab.setAttribute('role', 'tab')
    tab.append(document.createTextNode(label))
    if (badge != null) tab.append(el('span', 'badge num', String(badge)))
    tabs.append(tab)
  })
  return tabs
}

function renderRecord(state, cycle) {
  const frag = document.createDocumentFragment()

  let sessionForm
  const refreshSessions = async () => {
    const rows = await sessionsPanel.loadTable()
    recentContainer.rows = rows
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

  frag.append(header, tabs, overviewPanel, sessionsPanel, planPanel, reportsPanel)

  queueMicrotask(() => { wireTabs(); refreshSessions() })

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

// ── Orquestrador ──────────────────────────────────────────────────────────────

async function loadAndRender() {
  if (!stateBox) return

  stateBox.replaceChildren(el('div', 'skel skel-rec'), el('div', 'skel skel-panel'))
  renderRail(false, '')
  renderCrumb(false, '')

  const { data: cycles, error } = await getTutorCycles(session.user.id)

  if (error) {
    stateBox.replaceChildren(renderNoRecord('error', loadAndRender))
    return
  }

  const derived = deriveTutorState(session.profile.status, cycles)
  const hasRecord = RECORD_STATES.includes(derived.state)
  const childName = hasRecord ? (derived.cycle?.children?.name ?? 'Criança') : ''

  renderRail(hasRecord, firstName(childName))
  renderCrumb(hasRecord, childName)

  if (hasRecord) {
    stateBox.replaceChildren()
    stateBox.append(renderRecord(derived.state, derived.cycle))
  } else {
    stateBox.replaceChildren(renderNoRecord(derived.state, loadAndRender))
  }
}

if (session && stateBox) {
  fillIdentity()
  await loadAndRender()
}
