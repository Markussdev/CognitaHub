import { requireRole, signOut } from '../lib/auth.js'
import {
  getPendingTutors,
  getChildrenWaitingReview,
  approveTutor,
  rejectTutor,
  approveChild,
  requestChildRevision,
} from '../data/admin.js'
import {
  getChildrenWaitingMatch,
  getAvailableTutors,
  createSupportCycle,
} from '../data/matching.js'

const session = await requireRole('admin')

const listChildren = document.querySelector('[data-list-children]')
const listTutors = document.querySelector('[data-list-tutors]')
const listMatches = document.querySelector('[data-list-matches]')

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault()
    await signOut()
  })
})

// ---------- helpers de DOM (textContent sempre: dado de usuário, nunca innerHTML) ----------

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function initialsOf(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function ageFrom(birthDate) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
}

function asText(value) {
  if (value == null || value === '') return null
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${item}`)
      .join(' · ')
  }
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

function cardDetails(summaryLabel, facts) {
  const details = el('details', 'card-details')
  details.append(el('summary', null, summaryLabel), factList(facts))
  return details
}

// ---------- ações ----------

// action() pode retornar { error, userMessage } (mostra a mensagem
// específica) ou { cancelled: true } (ex.: usuário cancelou um confirm
// interno) — nesse caso não recarrega nem mostra erro.
function bindAction(button, buttons, errorBox, action, confirmText) {
  button.addEventListener('click', async () => {
    if (confirmText && !window.confirm(confirmText)) return

    errorBox.hidden = true
    const originalLabel = button.textContent
    buttons.forEach((other) => {
      other.disabled = true
    })
    button.textContent = 'Salvando…'

    const result = (await action()) ?? {}

    if (result.cancelled) {
      buttons.forEach((other) => {
        other.disabled = false
      })
      button.textContent = originalLabel
      return
    }

    if (result.error) {
      buttons.forEach((other) => {
        other.disabled = false
      })
      button.textContent = originalLabel
      errorBox.textContent = result.userMessage || 'Não foi possível concluir. Tente de novo.'
      errorBox.hidden = false
      return
    }

    await loadQueues()
  })
}

// ---------- cards ----------

function renderTutorCard(application) {
  const profile = application.profiles ?? {}
  const card = el('article', 'pipeline-card')

  const identity = el('div', 'card-id')
  const avatar = el('span', 'card-avatar blue', initialsOf(profile.name))
  avatar.setAttribute('aria-hidden', 'true')
  const heading = el('div')
  heading.append(el('p', 'app-kicker', 'Tutor'), el('h3', null, profile.name ?? 'Sem nome'))
  identity.append(avatar, heading)

  const summary = el('p', null, asText(application.formation) ?? 'Formação não informada')

  const tags = el('div', 'pipeline-tags')
  tags.setAttribute('aria-label', 'Estado da candidatura')
  tags.append(el('span', 'badge badge-warn', 'aguarda validação'))

  const details = cardDetails('Ver candidatura', [
    fact('Formação', application.formation),
    fact('Experiência', application.experience),
    fact('Motivação', application.motivation),
    fact('Disponibilidade', application.weekly_availability),
    fact('LinkedIn', application.linkedin),
    fact('E-mail', profile.email),
    fact('Telefone', profile.phone),
  ])

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true

  const actions = el('div', 'row-actions')
  const approve = el('button', 'btn btn-primary btn-sm', 'Aprovar tutor')
  approve.type = 'button'
  const reject = el('button', 'btn btn-ghost btn-sm', 'Recusar')
  reject.type = 'button'
  actions.append(approve, reject)

  bindAction(approve, [approve, reject], errorBox, () =>
    approveTutor(application.tutor_id, session.user.id)
  )
  bindAction(
    reject,
    [approve, reject],
    errorBox,
    () => rejectTutor(application.tutor_id, session.user.id),
    `Recusar a candidatura de ${profile.name ?? 'este tutor'}? A pessoa não terá acesso ao painel.`
  )

  card.append(identity, summary, tags, details, errorBox, actions)
  return card
}

function renderChildCard(child) {
  const guardian = child.profiles ?? {}
  const learning = Array.isArray(child.learning_profiles)
    ? child.learning_profiles[0]
    : child.learning_profiles

  const card = el('article', 'pipeline-card')

  const identity = el('div', 'card-id')
  const avatar = el('span', 'card-avatar', initialsOf(child.name))
  avatar.setAttribute('aria-hidden', 'true')
  const heading = el('div')
  heading.append(el('p', 'app-kicker', 'Criança'), el('h3', null, child.name ?? 'Sem nome'))
  identity.append(avatar, heading)

  const age = ageFrom(child.birth_date)
  const summaryParts = [age != null ? `${age} anos` : null, asText(child.main_difficulties)]
  const summary = el('p', null, summaryParts.filter(Boolean).join(' · ') || 'Perfil em análise')

  const tags = el('div', 'pipeline-tags')
  tags.setAttribute('aria-label', 'Estado do cadastro')
  tags.append(el('span', 'badge badge-warn', 'aguarda análise'))

  const details = cardDetails('Ver perfil pedagógico', [
    fact('Ano escolar', child.school_year),
    fact('Diagnóstico formal', child.has_formal_diagnosis),
    fact('Principais dificuldades', child.main_difficulties),
    fact('Dificuldades em matemática', learning?.math_difficulties),
    fact('Formatos preferidos', learning?.preferred_formats),
    fact('Tempo de atenção', learning?.attention_span),
    fact('Pontos fortes', learning?.strengths),
    fact('Motivadores', learning?.motivators),
    fact('Evitar', learning?.avoidances),
    fact('Notas sensoriais', child.sensory_notes),
    fact('Rotina', child.routine_notes),
    fact('Responsável', guardian.name),
    fact('Contato', [guardian.email, guardian.phone].filter(Boolean).join(' · ')),
  ])

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true

  const actions = el('div', 'row-actions')
  const approve = el('button', 'btn btn-primary btn-sm', 'Aprovar para pareamento')
  approve.type = 'button'
  const revise = el('button', 'btn btn-ghost btn-sm', 'Pedir revisão')
  revise.type = 'button'
  actions.append(approve, revise)

  bindAction(approve, [approve, revise], errorBox, () => approveChild(child.id))
  bindAction(
    revise,
    [approve, revise],
    errorBox,
    () => requestChildRevision(child.id),
    `Pedir revisão do cadastro de ${child.name ?? 'esta criança'}? O responsável deverá ajustar as informações.`
  )

  card.append(identity, summary, tags, details, errorBox, actions)
  return card
}

function renderMatchCard(child, tutors) {
  const learning = Array.isArray(child.learning_profiles)
    ? child.learning_profiles[0]
    : child.learning_profiles

  const card = el('article', 'pipeline-card')

  const identity = el('div', 'card-id')
  const avatar = el('span', 'card-avatar wine', initialsOf(child.name))
  avatar.setAttribute('aria-hidden', 'true')
  const heading = el('div')
  heading.append(el('p', 'app-kicker', 'Aguardando tutor'), el('h3', null, child.name ?? 'Criança'))
  identity.append(avatar, heading)

  const age = ageFrom(child.birth_date)
  const summaryParts = [age != null ? `${age} anos` : null, asText(child.main_difficulties)]
  const summary = el('p', null, summaryParts.filter(Boolean).join(' · ') || 'Perfil aprovado')

  const tags = el('div', 'pipeline-tags')
  tags.append(el('span', 'badge badge-ok', 'aprovada'))

  const details = cardDetails('Ver perfil pedagógico', [
    fact('Ano escolar', child.school_year),
    fact('Dificuldades em matemática', learning?.math_difficulties),
    fact('Formatos preferidos', learning?.preferred_formats),
    fact('Tempo de atenção', learning?.attention_span),
    fact('Motivadores', learning?.motivators),
    fact('Evitar', learning?.avoidances),
  ])

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true

  // formulário: tutor (obrigatório) + objetivo e plano (opcionais)
  const form = el('div', 'match-form')

  const tutorLabel = el('label', null, 'Tutor')
  const select = document.createElement('select')
  select.append(new Option('Selecione um tutor…', ''))
  tutors.forEach((tutor) => {
    const application = Array.isArray(tutor.tutor_applications)
      ? tutor.tutor_applications[0]
      : tutor.tutor_applications
    const formation = application?.formation ? ` · ${application.formation}` : ''
    select.append(new Option(`${tutor.name ?? 'Tutor'}${formation}`, tutor.id))
  })
  tutorLabel.append(select)

  const goalLabel = el('label', null, 'Objetivo principal (opcional)')
  const goalInput = document.createElement('input')
  goalInput.type = 'text'
  goalInput.placeholder = 'Ex.: ganhar confiança com soma até 10'
  goalLabel.append(goalInput)

  const planLabel = el('label', null, 'Plano inicial (opcional)')
  const planInput = document.createElement('textarea')
  planInput.placeholder = 'Ex.: atividades curtas e visuais, conectadas à rotina'
  planLabel.append(planInput)

  form.append(tutorLabel, goalLabel, planLabel)

  const actions = el('div', 'row-actions')
  const createBtn = el('button', 'btn btn-primary btn-sm', 'Criar ciclo')
  createBtn.type = 'button'
  actions.append(createBtn)

  if (!tutors.length) {
    select.disabled = true
    createBtn.disabled = true
    errorBox.textContent = 'Nenhum tutor aprovado disponível ainda. Valide um tutor na triagem.'
    errorBox.hidden = false
  }

  // confirm + validação ficam DENTRO da action (antes do confirm precisa
  // ter tutor escolhido) — bindAction trata { cancelled } e { userMessage }.
  bindAction(createBtn, [createBtn], errorBox, async () => {
    const tutorId = select.value
    if (!tutorId) {
      return { error: new Error('no-tutor'), userMessage: 'Selecione um tutor para criar o ciclo.' }
    }

    const tutorName = select.options[select.selectedIndex]?.text ?? 'o tutor'
    const ok = window.confirm(
      `Criar um ciclo de 6 meses para ${child.name ?? 'esta criança'} com ${tutorName}? ` +
        'A criança passa a ser acompanhada por esse tutor.'
    )
    if (!ok) return { cancelled: true }

    return createSupportCycle({
      childId: child.id,
      tutorId,
      mainGoal: goalInput.value.trim(),
      currentPlan: planInput.value.trim(),
    })
  })

  card.append(identity, summary, tags, details, errorBox, form, actions)
  return card
}

// ---------- listas, estados e contadores ----------

function buildEmptyState(message, withRetry) {
  const box = el('div', 'empty-state')
  box.append(
    el('strong', null, withRetry ? 'Algo deu errado' : 'Fila limpa'),
    el('span', null, message)
  )
  if (withRetry) {
    const retry = el('button', 'btn btn-ghost btn-sm', 'Tentar de novo')
    retry.type = 'button'
    retry.addEventListener('click', loadQueues)
    box.append(retry)
  }
  return box
}

function renderList(container, result, renderCard, messages) {
  if (result.error) {
    container.replaceChildren(buildEmptyState(messages.error, true))
    return
  }

  const rows = result.data ?? []
  if (!rows.length) {
    container.replaceChildren(buildEmptyState(messages.empty, false))
    return
  }

  container.replaceChildren(...rows.map(renderCard))
}

function setCount(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value == null ? '—' : String(value)
  })
}

// Pareamento precisa da lista de tutores disponíveis para cada dropdown,
// então tem render próprio (não usa o renderList genérico).
function renderMatches(childrenResult, tutorsResult) {
  if (!listMatches) return

  if (childrenResult.error) {
    listMatches.replaceChildren(
      buildEmptyState('Não foi possível carregar a fila de pareamento.', true)
    )
    return
  }

  const rows = childrenResult.data ?? []
  if (!rows.length) {
    listMatches.replaceChildren(
      buildEmptyState('Nenhuma criança aguardando pareamento.', false)
    )
    return
  }

  const tutors = tutorsResult.error ? [] : (tutorsResult.data ?? [])
  listMatches.replaceChildren(...rows.map((child) => renderMatchCard(child, tutors)))
}

function updateCounters(childrenResult, tutorsResult, matchesResult) {
  const childCount = childrenResult.error ? null : (childrenResult.data?.length ?? 0)
  const tutorCount = tutorsResult.error ? null : (tutorsResult.data?.length ?? 0)
  const matchCount = matchesResult?.error ? null : (matchesResult?.data?.length ?? 0)

  setCount('[data-count-children]', childCount)
  setCount('[data-count-tutors]', tutorCount)
  setCount('[data-count-matches]', matchCount)

  const total = childCount == null || tutorCount == null ? null : childCount + tutorCount
  setCount('[data-count-triagem]', total)
  setCount('[data-count-total]', total)

  const context = document.querySelector('[data-count-context]')
  if (context) {
    context.textContent =
      total == null
        ? 'pendências indisponíveis'
        : total === 1
          ? '1 pendência hoje'
          : `${total} pendências hoje`
  }
}

async function loadQueues() {
  ;[listChildren, listTutors, listMatches].forEach((list) => {
    if (list) list.replaceChildren(el('div', 'skeleton'), el('div', 'skeleton'))
  })

  const [tutors, children, matchChildren, availableTutors] = await Promise.all([
    getPendingTutors(),
    getChildrenWaitingReview(),
    getChildrenWaitingMatch(),
    getAvailableTutors(),
  ])

  renderList(listTutors, tutors, renderTutorCard, {
    empty: 'Nenhuma candidatura aguardando validação.',
    error: 'Não foi possível carregar os tutores. Verifique a conexão.',
  })
  renderList(listChildren, children, renderChildCard, {
    empty: 'Nenhum cadastro de criança aguardando análise.',
    error: 'Não foi possível carregar as crianças. Verifique a conexão.',
  })
  renderMatches(matchChildren, availableTutors)

  updateCounters(children, tutors, matchChildren)
}

function fillAccount() {
  const name = session.profile.name || 'Equipe Cognita'
  const avatar = document.querySelector('[data-account-avatar]')
  const accountName = document.querySelector('[data-account-name]')
  const accountEmail = document.querySelector('[data-account-email]')

  if (avatar) avatar.textContent = initialsOf(name)
  if (accountName) accountName.textContent = name
  if (accountEmail) accountEmail.textContent = session.user.email ?? ''
}

if (session && listChildren && listTutors) {
  fillAccount()
  await loadQueues()
}
