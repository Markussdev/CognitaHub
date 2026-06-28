import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, greeting, initials, ageFrom, el, fact, factList } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { getCycleSessions, createSessionRecord } from '../data/sessions.js'

const session = await requireRole('tutor')

const cyclesBox = document.querySelector('[data-tutor-cycles]')
const emptyBox = document.querySelector('[data-tutor-empty]')
const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

setupFocusMode()

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault()
    await signOut()
  })
})

function setText(selector, value) {
  const node = document.querySelector(selector)
  if (node) node.textContent = value
}

function todayISO() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

function monthsBetween(start, end) {
  if (!start || !end) return 6

  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 6
  }

  const months =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startDate.getUTCMonth())

  return Math.max(1, months)
}

function currentCycleMonth(start, end) {
  if (!start || !end) return 1

  const now = new Date()
  const startDate = new Date(`${start}T00:00:00Z`)
  const total = monthsBetween(start, end)

  if (Number.isNaN(startDate.getTime())) return 1

  const elapsed =
    (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - startDate.getUTCMonth()) +
    1

  return Math.min(Math.max(elapsed, 1), total)
}

function cycleProgressPercent(start, end) {
  const total = monthsBetween(start, end)
  const current = currentCycleMonth(start, end)
  return Math.round((current / total) * 100)
}

function fillIdentity() {
  const name = session.profile.name || 'Tutor'
  setText('[data-tutor-title]', greeting(name))
  setText(
    '[data-tutor-subtitle]',
    'Acompanhe aqui as crianças vinculadas a você e registre as sessões da semana.'
  )
  setText('[data-tutor-name]', name)
  setText('[data-account-name]', name)
  setText('[data-account-email]', session.user.email ?? '')
  setText('[data-account-avatar]', initials(name))
}

function setCount(n) {
  const label =
    n === 0
      ? 'Nenhuma criança vinculada'
      : n === 1
        ? '1 criança neste ciclo'
        : `${n} crianças neste ciclo`
  setText('[data-tutor-count]', label)
}

function showEmpty() {
  cyclesBox.replaceChildren()
  emptyBox.hidden = false

  const box = el('div', 'empty-state os-empty')
  if (REVIEW_STATUSES.includes(session.profile.status)) {
    box.append(
      el('strong', null, 'Candidatura em analise'),
      el('span', null, 'A equipe Cognita vai revisar seu perfil e sua disponibilidade antes de liberar matches com criancas.')
    )
  } else {
    box.append(
      el('strong', null, 'Voce ainda nao possui criancas vinculadas.'),
      el(
        'span',
        null,
        'Quando a equipe Cognita criar um pareamento, ele aparecera aqui com o perfil da crianca e o espaco para registrar as sessoes.'
      )
    )
  }
  emptyBox.replaceChildren(box)
}

// ---------- sessões ----------

function renderSession(record) {
  const item = el('article', 'session-item os-session-item')

  const head = el('header', 'os-session-head')
  head.append(
    el('span', 'session-date os-session-date', formatDate(record.date) ?? '-'),
    el('strong', null, record.activity_title ?? 'Sessão')
  )

  const body = el('div', 'os-session-body')

  if (record.focus_area) {
    const p = el('p')
    p.append(el('strong', null, 'Foco '), document.createTextNode(record.focus_area))
    body.append(p)
  }

  if (record.notes) {
    const p = el('p')
    p.append(el('strong', null, 'Observação '), document.createTextNode(record.notes))
    body.append(p)
  }

  if (record.next_step) {
    const p = el('p')
    p.append(el('strong', null, 'Próximo '), document.createTextNode(record.next_step))
    body.append(p)
  }

  if (record.duration_minutes) {
    body.append(el('span', 'os-session-duration', `${record.duration_minutes} min`))
  }

  item.append(head, body)
  return item
}

async function loadSessions(cycleId, container) {
  container.replaceChildren(el('p', 'session-empty', 'Carregando sessões...'))

  const { data, error } = await getCycleSessions(cycleId)

  if (error) {
    container.replaceChildren(el('p', 'session-empty', 'Não foi possível carregar as sessões.'))
    return
  }

  const rows = data ?? []
  if (!rows.length) {
    container.replaceChildren(el('p', 'session-empty', 'Nenhuma sessão registrada ainda.'))
    return
  }

  const list = el('div', 'session-list os-session-list')
  rows.forEach((record) => list.append(renderSession(record)))
  container.replaceChildren(list)
}

function labeledField(labelText, control) {
  const label = el('label', null, labelText)
  label.append(control)
  return label
}

function renderSessionForm(cycle, onSaved) {
  const details = el('details', 'card-details os-session-form')
  const form = document.createElement('form')
  form.className = 'match-form os-form'

  const dateInput = document.createElement('input')
  dateInput.type = 'date'
  dateInput.value = todayISO()
  dateInput.required = true

  const durationInput = document.createElement('input')
  durationInput.type = 'number'
  durationInput.min = '0'
  durationInput.placeholder = 'Ex.: 45'

  const activityInput = document.createElement('input')
  activityInput.type = 'text'
  activityInput.required = true
  activityInput.placeholder = 'Ex.: soma com apoio visual'

  const focusInput = document.createElement('input')
  focusInput.type = 'text'
  focusInput.placeholder = 'Ex.: contagem e comparação'

  const notesInput = document.createElement('textarea')
  notesInput.placeholder = 'Como a criança respondeu?'

  const nextStepInput = document.createElement('textarea')
  nextStepInput.placeholder = 'O que trabalhar no próximo encontro?'

  form.append(
    labeledField('Data da sessão', dateInput),
    labeledField('Duração (minutos)', durationInput),
    labeledField('Atividade realizada', activityInput),
    labeledField('Foco trabalhado', focusInput),
    labeledField('Como a criança respondeu?', notesInput),
    labeledField('Próximo passo', nextStepInput)
  )

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true
  const okBox = el('p', 'session-ok')
  okBox.hidden = true

  const saveBtn = el('button', 'btn btn-primary btn-sm', 'Salvar sessão')
  saveBtn.type = 'submit'

  form.append(errorBox, okBox, saveBtn)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorBox.hidden = true
    okBox.hidden = true

    const activityTitle = activityInput.value.trim()
    if (!activityTitle) {
      errorBox.textContent = 'Informe a atividade realizada.'
      errorBox.hidden = false
      return
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Salvando...'

    const { error } = await createSessionRecord({
      cycleId: cycle.id,
      sessionDate: dateInput.value || todayISO(),
      durationMinutes: durationInput.value ? Number(durationInput.value) : null,
      activityTitle,
      focusArea: focusInput.value.trim(),
      notes: notesInput.value.trim(),
      nextStep: nextStepInput.value.trim(),
    })

    saveBtn.disabled = false
    saveBtn.textContent = 'Salvar sessão'

    if (error) {
      errorBox.textContent = 'Não foi possível salvar a sessão. Tente de novo.'
      errorBox.hidden = false
      return
    }

    form.reset()
    dateInput.value = todayISO()
    okBox.textContent = 'Sessão registrada com sucesso.'
    okBox.hidden = false
    await onSaved()
  })

  details.append(el('summary', null, 'Registrar sessão'), form)
  return details
}

// ---------- card da criança vinculada ----------

function renderOrbit(childName, age, currentMonth, totalMonths) {
  const orbit = el('div', 'os-orbit')
  orbit.style.setProperty('--total', totalMonths)

  const center = el('div', 'os-orbit-center')
  center.append(
    el('strong', null, childName ?? 'Criança'),
    el('span', null, age != null ? `${age} anos` : 'Ciclo ativo')
  )

  const ring = el('div', 'os-orbit-ring')

  for (let i = 1; i <= totalMonths; i += 1) {
    const stateClass = i === currentMonth ? 'active' : i < currentMonth ? 'done' : ''
    const dot = el('span', `os-orbit-dot ${stateClass}`.trim(), String(i))
    dot.style.setProperty('--i', i)
    dot.style.setProperty('--total', totalMonths)
    ring.append(dot)
  }

  orbit.append(ring, center)
  return orbit
}

function renderCycleSummary(cycle, progress, currentMonth, totalMonths) {
  const panel = el('aside', 'os-panel os-summary-panel')

  panel.append(
    el('div', 'os-panel-title', 'Resumo do ciclo'),
    el('p', 'os-progress-number', `${progress}%`),
    el('p', 'os-muted', `mês ${currentMonth} de ${totalMonths}`)
  )

  const bars = el('div', 'os-progress-bars')
  bars.style.setProperty('--total-months', totalMonths)
  for (let i = 1; i <= totalMonths; i += 1) {
    const stateClass = i === currentMonth ? 'active' : i < currentMonth ? 'done' : ''
    bars.append(el('span', stateClass))
  }

  const facts = factList([
    fact('Início', formatDate(cycle.start_date)),
    fact('Fim previsto', formatDate(cycle.end_date)),
    fact('Meta', cycle.main_goal),
    fact('Plano atual', cycle.current_plan),
  ])

  panel.append(bars, facts)

  if (cycle.current_plan || cycle.main_goal) {
    const next = el('div', 'os-next-card')
    next.append(el('span', null, 'Próximo passo'), el('p', null, cycle.current_plan || cycle.main_goal))
    panel.append(next)
  }

  return panel
}

function renderCycleCard(cycle) {
  const child = cycle.children ?? {}
  const age = ageFrom(child.birth_date)
  const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
  const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  const progress = cycleProgressPercent(cycle.start_date, cycle.end_date)
  const statusLabel = cycle.status === 'active' ? 'Ciclo ativo' : 'Ciclo planejado'

  const wrapper = el('article', 'pipeline-card os-cycle')

  const hero = el('section', 'os-hero-card')
  const orbit = renderOrbit(child.name, age, currentMonth, totalMonths)

  const copy = el('div', 'os-hero-copy')
  copy.append(
    el('p', 'os-kicker', 'Criança em acompanhamento'),
    el('h2', null, `${child.name ?? 'Criança'} está no mês ${currentMonth} da jornada.`),
    el(
      'p',
      'os-copy',
      `Cada órbita é um mês do ciclo de apoio. Este ciclo tem ${totalMonths} meses e segue com registros de acompanhamento.`
    )
  )

  const chips = el('div', 'os-chip-row')
  chips.append(el('span', 'os-chip os-chip-ok', statusLabel), el('span', 'os-chip os-chip-warn', 'Sessão pendente'))

  const profileLink = el('a', 'os-btn os-btn-secondary', 'Ver perfil pedagógico')
  profileLink.href = 'perfil-crianca.html'

  copy.append(chips, profileLink)

  const mascot = document.createElement('img')
  mascot.className = 'os-mascot'
  mascot.src = '../assets/mascot-hero-wave.png'
  mascot.alt = ''

  hero.append(orbit, copy, mascot)

  const grid = el('section', 'os-dashboard-grid')

  const sessionsPanel = el('div', 'os-panel os-timeline-panel')
  sessionsPanel.append(el('div', 'os-panel-title', 'Linha do tempo das sessões'))

  const sessionsList = el('div')
  const form = renderSessionForm(cycle, () => loadSessions(cycle.id, sessionsList))
  sessionsPanel.append(sessionsList, form)

  const summaryPanel = renderCycleSummary(cycle, progress, currentMonth, totalMonths)

  grid.append(sessionsPanel, summaryPanel)
  wrapper.append(hero, grid)

  loadSessions(cycle.id, sessionsList)
  return wrapper
}

function setupOpenSessionShortcut() {
  const button = document.querySelector('[data-open-session]')
  if (!button || button.dataset.shortcutReady === 'true') return

  button.dataset.shortcutReady = 'true'
  button.addEventListener('click', () => {
    const details = document.querySelector('.os-session-form, .card-details')
    if (!details) return

    details.open = true
    details.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function loadCycles() {
  emptyBox.hidden = true
  cyclesBox.replaceChildren(el('div', 'skeleton'))

  if (REVIEW_STATUSES.includes(session.profile.status)) {
    setCount(0)
    showEmpty()
    setupOpenSessionShortcut()
    return
  }

  const { data, error } = await getTutorCycles(session.user.id)

  if (error || !data?.length) {
    setCount(0)
    showEmpty()
    setupOpenSessionShortcut()
    return
  }

  setCount(data.length)
  cyclesBox.replaceChildren(...data.map(renderCycleCard))
  setupOpenSessionShortcut()
}

if (session && cyclesBox && emptyBox) {
  fillIdentity()
  await loadCycles()
}
