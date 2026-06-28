import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getGuardianChildren } from '../data/guardian.js'

const session = await requireRole('guardian')

const childrenBox = document.querySelector('[data-guardian-children]')
const emptyBox = document.querySelector('[data-guardian-empty]')
const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

setupFocusMode()

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault()
    await signOut()
  })
})

const STATUS = {
  waiting_review: {
    badge: 'badge-warn',
    label: 'Cadastro em análise',
    text: 'Cadastro em análise pela equipe Cognita. Avisaremos assim que a avaliação terminar.',
  },
  revision_requested: {
    badge: 'badge-bad',
    label: 'Revisão solicitada',
    text: 'A equipe Cognita pediu ajustes neste cadastro. Em breve você poderá editar as informações; enquanto isso, fique de olho no seu e-mail.',
  },
  waiting_match: {
    badge: 'badge-ok',
    label: 'Cadastro aprovado, aguardando tutor',
    text: 'Cadastro aprovado, aguardando tutor. Você será avisado quando o pareamento acontecer.',
  },
  matched: {
    badge: 'badge-ok',
    label: 'Pareamento criado',
    text: 'Um tutor foi reservado para o ciclo. O acompanhamento vai começar em breve.',
  },
  active: {
    badge: 'badge-ok',
    label: 'Ciclo ativo',
    text: 'Ciclo ativo com tutor vinculado.',
  },
  completed: {
    badge: 'badge-ok',
    label: 'Ciclo concluído',
    text: 'Ciclo concluído. Obrigado por participar.',
  },
  paused: {
    badge: 'badge-warn',
    label: 'Acompanhamento pausado',
    text: 'Acompanhamento pausado. A equipe Cognita entrará em contato.',
  },
  rejected: {
    badge: 'badge-bad',
    label: 'Cadastro não aprovado',
    text: 'Cadastro não aprovado. Fale com a equipe Cognita para entender os próximos passos.',
  },
}

const FALLBACK_STATUS = {
  badge: 'badge-warn',
  label: 'Em processamento',
  text: 'Estamos atualizando o status deste cadastro.',
}

function setText(selector, value) {
  const node = document.querySelector(selector)
  if (node) node.textContent = value
}

function asText(value) {
  if (value == null || value === '') return null
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  return String(value)
}

function fact(label, value) {
  const text = asText(value)
  if (!text) return null
  const row = el('div')
  row.append(el('dt', null, label), el('dd', null, text))
  return row
}

function factList(facts) {
  const list = el('dl', 'card-facts')
  facts.forEach((row) => row && list.append(row))
  return list
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

function getActiveCycle(child) {
  const cycles = Array.isArray(child.support_cycles)
    ? child.support_cycles
    : child.support_cycles
      ? [child.support_cycles]
      : []

  return cycles.find((cycle) => cycle.status === 'active') ?? cycles[0] ?? null
}

function getCycleTutor(cycle) {
  const profile = cycle?.profiles
  return Array.isArray(profile) ? profile[0] : profile
}

function fillIdentity() {
  const name = session.profile.name || 'Responsável'
  setText('[data-guardian-title]', greeting(name))
  setText(
    '[data-guardian-subtitle]',
    'Acompanhe aqui a situação do cadastro da sua criança no Cognita Hub.'
  )
  setText('[data-guardian-name]', name)
  setText('[data-account-name]', name)
  setText('[data-account-email]', session.user.email ?? '')
  setText('[data-account-avatar]', initials(name))
}

function setCount(n) {
  const label =
    n === 0
      ? 'Nenhuma criança cadastrada'
      : n === 1
        ? '1 criança cadastrada'
        : `${n} crianças cadastradas`
  setText('[data-guardian-count]', label)
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

function renderOrbit(childName, age, currentMonth, totalMonths) {
  const orbit = el('div', 'os-orbit')
  orbit.style.setProperty('--total', totalMonths)

  const center = el('div', 'os-orbit-center')
  center.append(
    el('strong', null, childName ?? 'Criança'),
    el('span', null, age != null ? `${age} anos` : 'Ciclo Cognita')
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

function renderSession(record) {
  const item = el('article', 'session-item os-session-item')

  const head = el('header', 'os-session-head')
  head.append(
    el('span', 'session-date os-session-date', formatDate(record.date) ?? '—'),
    el('strong', null, record.activity_title ?? 'Sessão registrada')
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

function renderSessions(sessions) {
  const rows = Array.isArray(sessions) ? sessions : []

  if (!rows.length) {
    return el('p', 'session-empty', 'O tutor ainda não registrou sessões deste ciclo.')
  }

  const list = el('div', 'session-list os-session-list')
  rows.forEach((record) => list.append(renderSession(record)))
  return list
}

function renderCycleSummary(child, cycle, tutor, progress, currentMonth, totalMonths) {
  const panel = el('aside', 'os-panel os-summary-panel')

  panel.append(
    el('div', 'os-panel-title', 'Resumo do acompanhamento'),
    el('p', 'os-progress-number', `${progress}%`),
    el('p', 'os-muted', `mês ${currentMonth} de ${totalMonths}`)
  )

  const bars = el('div', 'os-progress-bars')
  bars.style.setProperty('--total-months', totalMonths)

  for (let i = 1; i <= totalMonths; i += 1) {
    const stateClass = i === currentMonth ? 'active' : i < currentMonth ? 'done' : ''
    bars.append(el('span', stateClass))
  }

  const latestSession = Array.isArray(cycle.sessions) ? cycle.sessions[0] : null

  const facts = factList([
    fact('Tutor responsável', tutor?.name),
    fact('Contato com o tutor', 'Pelo Cognita Hub'),
    fact('Início', formatDate(cycle.start_date)),
    fact('Fim previsto', formatDate(cycle.end_date)),
    fact('Objetivo principal', cycle.main_goal),
    fact('Plano inicial', cycle.current_plan),
  ])

  panel.append(bars, facts)

  if (latestSession?.next_step || cycle.current_plan || cycle.main_goal) {
    const next = el('div', 'os-next-card')
    next.append(
      el('span', null, 'Próximo passo'),
      el('p', null, latestSession?.next_step || cycle.current_plan || cycle.main_goal)
    )
    panel.append(next)
  }

  return panel
}

function renderProfileDetails(child, learning) {
  const details = el('details', 'card-details os-details')
  details.append(
    el('summary', null, 'Ver dados do cadastro'),
    factList([
      fact('Principais dificuldades', child.main_difficulties),
      fact('Dificuldades em matemática', learning?.math_difficulties),
      fact('Formatos preferidos', learning?.preferred_formats),
      fact('Tempo de atenção', learning?.attention_span),
      fact('Motivadores', learning?.motivators),
      fact('Evitar', learning?.avoidances),
      fact('Notas sensoriais', child.sensory_notes),
      fact('Rotina', child.routine_notes),
    ])
  )
  return details
}

function renderChildCard(child) {
  const status = STATUS[child.status] ?? FALLBACK_STATUS
  const learning = Array.isArray(child.learning_profiles)
    ? child.learning_profiles[0]
    : child.learning_profiles
  const activeCycle = getActiveCycle(child)
  const tutor = getCycleTutor(activeCycle)
  const age = ageFrom(child.birth_date)

  const totalMonths = activeCycle ? monthsBetween(activeCycle.start_date, activeCycle.end_date) : 6
  const currentMonth = activeCycle ? currentCycleMonth(activeCycle.start_date, activeCycle.end_date) : 1
  const progress = activeCycle ? cycleProgressPercent(activeCycle.start_date, activeCycle.end_date) : 0

  const wrapper = el('article', 'pipeline-card os-cycle')

  const hero = el('section', 'os-hero-card')
  const orbit = renderOrbit(child.name, age, currentMonth, totalMonths)

  const copy = el('div', 'os-hero-copy')
  copy.append(
    el('p', 'os-kicker', 'Jornada da criança'),
    el(
      'h2',
      null,
      activeCycle
        ? `${child.name ?? 'Criança'} está em acompanhamento com ${tutor?.name ?? 'a equipe Cognita'}.`
        : `${child.name ?? 'Criança'} está em ${status.label.toLowerCase()}.`
    ),
    el(
      'p',
      'os-copy',
      activeCycle
        ? 'A família acompanha aqui as sessões registradas pelo tutor, o progresso do ciclo e os próximos passos do apoio educacional.'
        : status.text
    )
  )

  const chips = el('div', 'os-chip-row')
  chips.append(el('span', 'os-chip os-chip-ok', status.label))

  if (activeCycle && tutor?.name) {
    chips.append(el('span', 'os-chip os-chip-warn', 'Tutor vinculado'))
  }

  copy.append(chips)

  const mascot = document.createElement('img')
  mascot.className = 'os-mascot'
  mascot.src = '../assets/mascot-hero-wave.png'
  mascot.alt = ''

  hero.append(orbit, copy, mascot)

  const grid = el('section', 'os-dashboard-grid')

  if (activeCycle) {
    const sessionsPanel = el('div', 'os-panel os-timeline-panel')
    sessionsPanel.id = 'sessoes'
    sessionsPanel.append(el('div', 'os-panel-title', 'Linha do tempo das sessões'))
    sessionsPanel.append(renderSessions(activeCycle.sessions))

    const summaryPanel = renderCycleSummary(child, activeCycle, tutor, progress, currentMonth, totalMonths)

    grid.append(sessionsPanel, summaryPanel)
  } else {
    const statusPanel = el('div', 'os-panel os-timeline-panel')
    statusPanel.append(
      el('div', 'os-panel-title', 'Status do cadastro'),
      el('p', 'os-copy', status.text)
    )

    const summaryPanel = el('aside', 'os-panel os-summary-panel')
    summaryPanel.append(
      el('div', 'os-panel-title', 'Perfil cadastrado'),
      factList([
        fact('Criança', child.name),
        fact('Idade', age != null ? `${age} anos` : null),
        fact('Ano escolar', child.school_year),
      ])
    )

    grid.append(statusPanel, summaryPanel)
  }

  wrapper.append(hero, grid, renderProfileDetails(child, learning))
  return wrapper
}

function showEmpty() {
  childrenBox.replaceChildren()
  emptyBox.hidden = false
  emptyBox.replaceChildren()

  const box = el('div', 'empty-state')
  if (REVIEW_STATUSES.includes(session.profile.status)) {
    box.append(
      el('strong', null, 'Cadastro em analise'),
      el('span', null, 'A equipe Cognita esta revisando as informacoes da crianca. Voce sera avisado quando houver uma atualizacao.')
    )
  } else {
    box.append(
      el('strong', null, 'Nenhum cadastro de crianca encontrado.'),
      el(
        'span',
        null,
        'Se voce acabou de concluir o cadastro, atualize a pagina em alguns instantes. Qualquer duvida, fale com a equipe Cognita.'
      )
    )
  }
  emptyBox.append(box)
}

async function loadChildren() {
  emptyBox.hidden = true
  childrenBox.replaceChildren(el('div', 'skeleton'))

  if (REVIEW_STATUSES.includes(session.profile.status)) {
    setCount(0)
    showEmpty()
    return
  }

  const { data, error } = await getGuardianChildren(session.user.id)

  if (error) {
    childrenBox.replaceChildren()
    emptyBox.hidden = false
    const box = el('div', 'empty-state')
    box.append(
      el('strong', null, 'Não foi possível carregar o cadastro.'),
      el('span', null, 'Verifique sua conexão e atualize a página.')
    )
    emptyBox.replaceChildren(box)
    setText('[data-guardian-count]', 'Status indisponível')
    return
  }

  const rows = data ?? []
  setCount(rows.length)

  if (!rows.length) {
    showEmpty()
    return
  }

  childrenBox.replaceChildren(...rows.map(renderChildCard))
}

if (session && childrenBox && emptyBox) {
  fillIdentity()
  await loadChildren()
}
