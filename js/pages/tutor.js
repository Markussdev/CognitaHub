import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, greeting, initials, ageFrom, el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'

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
  emptyBox.replaceChildren()

  const box = el('div', 'empty-state')
  box.append(
    el('strong', null, 'Você ainda não possui crianças vinculadas.'),
    el(
      'span',
      null,
      'Quando a equipe Cognita criar um pareamento, ele aparecerá aqui — com o perfil da criança e o espaço para registrar as sessões.'
    )
  )
  emptyBox.append(box)
}

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
    [age != null ? `${age} anos` : null, cycle.start_date ? `início ${cycle.start_date}` : null]
      .filter(Boolean)
      .join(' · ') || 'Acompanhamento em preparação'
  )

  const actions = el('div', 'action-row')
  const profileLink = el('a', 'btn btn-primary btn-sm', 'Ver perfil pedagógico')
  profileLink.href = 'perfil-crianca.html'
  actions.append(profileLink)

  card.append(identity, tags, meta, actions)
  return card
}

async function loadCycles() {
  emptyBox.hidden = true
  cyclesBox.replaceChildren(el('div', 'skeleton'))

  const { data, error } = await getTutorCycles(session.user.id)

  // Sem ciclos (caso atual) ou erro de embed/FK: mostra o estado vazio.
  // O fallback de 2 queries entra quando o pareamento existir de verdade.
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
