import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getGuardianChildren } from '../data/guardian.js'

const session = await requireRole('guardian')

const childrenBox = document.querySelector('[data-guardian-children]')
const emptyBox = document.querySelector('[data-guardian-empty]')

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

function renderSession(record) {
  const item = el('div', 'session-item')

  const head = el('p', 'session-head')
  head.append(el('span', 'session-date', formatDate(record.date) ?? '—'))
  head.append(document.createTextNode(` · ${record.activity_title ?? 'Sessão'}`))
  item.append(head)

  item.append(
    factList([
      fact('Foco', record.focus_area),
      fact('Observação', record.notes),
      fact('Próximo passo', record.next_step),
    ])
  )

  return item
}

function renderSessions(sessions) {
  const rows = Array.isArray(sessions) ? sessions : []
  if (!rows.length) {
    return el('p', 'session-empty', 'O tutor ainda não registrou sessões deste ciclo.')
  }

  const list = el('div', 'session-list')
  rows.forEach((record) => list.append(renderSession(record)))
  return list
}

function renderChildCard(child) {
  const status = STATUS[child.status] ?? FALLBACK_STATUS
  const learning = Array.isArray(child.learning_profiles)
    ? child.learning_profiles[0]
    : child.learning_profiles
  const activeCycle = getActiveCycle(child)
  const tutor = getCycleTutor(activeCycle)

  const card = el('article', 'pipeline-card')

  const identity = el('div', 'card-id')
  const avatar = el('span', 'card-avatar', initials(child.name))
  avatar.setAttribute('aria-hidden', 'true')
  const heading = el('div')
  heading.append(el('p', 'app-kicker', 'Criança'), el('h3', null, child.name ?? 'Criança'))
  identity.append(avatar, heading)

  const age = ageFrom(child.birth_date)
  const meta = el(
    'p',
    null,
    [age != null ? `${age} anos` : null, child.school_year].filter(Boolean).join(' · ') ||
      'Perfil cadastrado'
  )

  const tags = el('div', 'pipeline-tags')
  tags.append(el('span', `badge ${status.badge}`, status.label))

  const text = el('p', null, status.text)

  const details = el('details', 'card-details')
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

  card.append(identity, meta, tags, text)

  if (activeCycle) {
    card.append(
      el('p', 'app-kicker', 'Acompanhamento iniciado'),
      factList([
        fact('Tutor responsável', tutor?.name),
        fact('Contato com o tutor', 'Pelo Cognita Hub'),
        fact('Início', formatDate(activeCycle.start_date)),
        fact('Fim previsto', formatDate(activeCycle.end_date)),
        fact('Objetivo principal', activeCycle.main_goal),
        fact('Plano inicial', activeCycle.current_plan),
      ])
    )

    card.append(el('p', 'app-kicker queue-label', 'Últimas sessões'), renderSessions(activeCycle.sessions))
  }

  card.append(details)
  return card
}

function showEmpty() {
  childrenBox.replaceChildren()
  emptyBox.hidden = false
  const box = el('div', 'empty-state')
  box.append(
    el('strong', null, 'Nenhum cadastro de criança encontrado.'),
    el(
      'span',
      null,
      'Se você acabou de concluir o cadastro, atualize a página em alguns instantes. Qualquer dúvida, fale com a equipe Cognita.'
    )
  )
  emptyBox.append(box)
}

async function loadChildren() {
  emptyBox.hidden = true
  childrenBox.replaceChildren(el('div', 'skeleton'))

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
