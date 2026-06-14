import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, greeting, initials, ageFrom, el, fact, factList } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { getCycleSessions, createSessionRecord } from '../data/sessions.js'

const session = await requireRole('tutor')

const cyclesBox = document.querySelector('[data-tutor-cycles]')
const emptyBox = document.querySelector('[data-tutor-empty]')

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

  const box = el('div', 'empty-state')
  box.append(
    el('strong', null, 'Você ainda não possui crianças vinculadas.'),
    el(
      'span',
      null,
      'Quando a equipe Cognita criar um pareamento, ele aparecerá aqui — com o perfil da criança e o espaço para registrar as sessões.'
    )
  )
  emptyBox.replaceChildren(box)
}

// ---------- sessões ----------

function renderSession(record) {
  const item = el('div', 'session-item')

  const head = el('p', 'session-head')
  head.append(el('span', 'session-date', formatDate(record.date) ?? '—'))
  head.append(document.createTextNode(` · ${record.activity_title ?? 'Sessão'}`))
  item.append(head)

  item.append(
    factList([
      fact('Foco', record.focus_area),
      fact('Duração', record.duration_minutes ? `${record.duration_minutes} min` : null),
      fact('Observação', record.notes),
      fact('Próximo passo', record.next_step),
    ])
  )

  return item
}

async function loadSessions(cycleId, container) {
  container.replaceChildren(el('p', 'session-empty', 'Carregando sessões…'))

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

  const list = el('div', 'session-list')
  rows.forEach((record) => list.append(renderSession(record)))
  container.replaceChildren(list)
}

function labeledField(labelText, control) {
  const label = el('label', null, labelText)
  label.append(control)
  return label
}

function renderSessionForm(cycle, onSaved) {
  const details = el('details', 'card-details')
  const form = document.createElement('form')
  form.className = 'match-form'

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
    saveBtn.textContent = 'Salvando…'

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

function renderCycleCard(cycle) {
  const child = cycle.children ?? {}
  const card = el('article', 'pipeline-card')

  const identity = el('div', 'card-id')
  const avatar = el('span', 'card-avatar', initials(child.name))
  avatar.setAttribute('aria-hidden', 'true')
  const heading = el('div')
  heading.append(el('p', 'app-kicker', 'Criança'), el('h3', null, child.name ?? 'Criança'))
  identity.append(avatar, heading)

  const age = ageFrom(child.birth_date)
  const label = cycle.status === 'active' ? 'Ciclo ativo' : 'Ciclo planejado'
  const tags = el('div', 'pipeline-tags')
  tags.append(el('span', `badge ${cycle.status === 'active' ? 'badge-ok' : 'badge-warn'}`, label))

  const meta = el(
    'p',
    null,
    [age != null ? `${age} anos` : null, cycle.start_date ? `início ${formatDate(cycle.start_date)}` : null]
      .filter(Boolean)
      .join(' · ') || 'Acompanhamento em preparação'
  )

  const actions = el('div', 'action-row')
  const profileLink = el('a', 'btn btn-primary btn-sm', 'Ver perfil pedagógico')
  profileLink.href = 'perfil-crianca.html'
  actions.append(profileLink)

  const sessionsLabel = el('p', 'app-kicker queue-label', 'Últimas sessões')
  const sessionsList = el('div')
  const form = renderSessionForm(cycle, () => loadSessions(cycle.id, sessionsList))

  card.append(identity, tags, meta, actions, form, sessionsLabel, sessionsList)

  loadSessions(cycle.id, sessionsList)
  return card
}

async function loadCycles() {
  emptyBox.hidden = true
  cyclesBox.replaceChildren(el('div', 'skeleton'))

  const { data, error } = await getTutorCycles(session.user.id)

  if (error || !data?.length) {
    setCount(0)
    showEmpty()
    return
  }

  setCount(data.length)
  cyclesBox.replaceChildren(...data.map(renderCycleCard))
}

if (session && cyclesBox && emptyBox) {
  fillIdentity()
  await loadCycles()
}
