import { requireRole, signOut } from '../lib/auth.js'
import { setupFocusMode, ageFrom, el, fact, factList, asText, initials } from '../lib/ui.js'
import { getGuardianChildren } from '../data/guardian.js'
import { getTutorCycles } from '../data/tutor.js'
import { supabase } from '../lib/supabase.js'

const session = await requireRole('guardian', 'tutor', 'admin')

const content = document.querySelector('[data-profile-content]')
const emptyBox = document.querySelector('[data-profile-empty]')

setupFocusMode()

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault()
    await signOut()
  })
})

const STATUS_LABEL = {
  waiting_review: 'Cadastro em análise',
  revision_requested: 'Revisão solicitada',
  waiting_match: 'Aguardando tutor',
  matched: 'Pareamento criado',
  active: 'Ciclo ativo',
  completed: 'Ciclo concluído',
  paused: 'Acompanhamento pausado',
  rejected: 'Cadastro não aprovado',
}

function setText(selector, value) {
  const node = document.querySelector(selector)
  if (node) node.textContent = value
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

function learningOf(child) {
  return Array.isArray(child.learning_profiles) ? child.learning_profiles[0] : child.learning_profiles
}

function wantedChildId() {
  return new URLSearchParams(window.location.search).get('child')
}

// ---------- resolução por papel (sem dado fake) ----------

async function resolveData() {
  const role = session.profile.role
  const wanted = wantedChildId()

  if (role === 'guardian') {
    const { data, error } = await getGuardianChildren(session.user.id)
    if (error) return { error }
    const children = data ?? []
    const child = (wanted && children.find((c) => c.id === wanted)) || children[0] || null
    if (!child) return { data: null, error: null }
    const cycles = child.support_cycles ?? []
    const cycle = cycles.find((c) => c.status === 'active') ?? cycles[0] ?? null
    return {
      data: {
        child,
        cycle,
        tutorName: cycle?.profiles?.name ?? null,
        lastSession: cycle?.sessions?.[0] ?? null,
      },
      error: null,
    }
  }

  if (role === 'tutor') {
    const { data, error } = await getTutorCycles(session.user.id)
    if (error) return { error }
    const cycles = data ?? []
    const match = (wanted && cycles.find((c) => c.child_id === wanted)) || cycles[0] || null
    if (!match?.children) return { data: null, error: null }
    return {
      data: {
        child: match.children,
        cycle: match,
        tutorName: session.profile.name ?? null,
        lastSession: null,
      },
      error: null,
    }
  }

  return resolveAdmin(wanted)
}

async function resolveAdmin(childId) {
  if (!childId) return { data: null, error: null }

  const { data: child, error } = await supabase
    .from('children')
    .select(
      `id, name, birth_date, school_year, status, main_difficulties, sensory_notes, routine_notes,
       learning_profiles ( preferred_formats, attention_span, math_difficulties, motivators, avoidances )`
    )
    .eq('id', childId)
    .single()

  if (error) return { error }
  if (!child) return { data: null, error: null }

  const { data: cycles } = await supabase
    .from('support_cycles')
    .select('id, status, start_date, end_date, main_goal, current_plan, tutor_id')
    .eq('child_id', childId)

  const cycle = (cycles ?? []).find((c) => c.status === 'active') ?? (cycles ?? [])[0] ?? null
  let tutorName = null
  let lastSession = null

  if (cycle) {
    if (cycle.tutor_id) {
      const { data: tutor } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', cycle.tutor_id)
        .single()
      tutorName = tutor?.name ?? null
    }

    const { data: sessions } = await supabase
      .from('sessions')
      .select('date, activity_title, focus_area, notes, next_step, duration_minutes')
      .eq('cycle_id', cycle.id)
      .order('date', { ascending: false })
      .limit(1)

    lastSession = sessions?.[0] ?? null
  }

  return { data: { child, cycle, tutorName, lastSession }, error: null }
}

// ---------- render ----------

function miniFact(label, value) {
  const card = el('article', 'profile-os-fact')
  card.append(el('span', null, label), el('strong', null, value))
  return card
}

function render({ child, cycle, tutorName, lastSession }) {
  const learning = learningOf(child)
  const age = ageFrom(child.birth_date)
  const status = STATUS_LABEL[child.status] ?? 'Em acompanhamento'

  setText('[data-profile-name]', child.name ?? 'Criança')
  setText('[data-profile-subtitle]', 'Resumo pedagógico para orientar tutor, família e equipe.')

  const hero = el('section', 'os-hero-card profile-hero-card')
  const copy = el('div', 'os-hero-copy')
  copy.append(
    el('p', 'os-kicker', 'Perfil pedagógico inicial'),
    el('h2', null, child.name ?? 'Criança'),
    el(
      'p',
      'os-copy',
      cycle && tutorName
        ? `Em acompanhamento com ${tutorName}.`
        : 'Base para personalizar o apoio matemático com previsibilidade e baixa estimulação.'
    )
  )
  const chips = el('div', 'os-chip-row')
  chips.append(el('span', 'os-chip os-chip-ok', status))
  if (cycle && tutorName) chips.append(el('span', 'os-chip os-chip-warn', 'Tutor vinculado'))
  copy.append(chips)

  const mascot = document.createElement('img')
  mascot.className = 'os-mascot'
  mascot.src = '../assets/mascot-hero-wave.png'
  mascot.alt = ''
  hero.append(copy, mascot)

  const factsRow = el('section', 'profile-os-facts')
  factsRow.append(
    miniFact('Idade', age != null ? `${age} anos` : '—'),
    miniFact('Ano escolar', asText(child.school_year) ?? '—'),
    miniFact('Foco atual', asText(learning?.math_difficulties) ?? asText(child.main_difficulties) ?? '—'),
    miniFact('Tempo de atenção', asText(learning?.attention_span) ?? '—')
  )

  const grid = el('section', 'os-dashboard-grid')

  const learnPanel = el('article', 'os-panel')
  learnPanel.append(el('div', 'os-panel-title', 'Perfil de aprendizagem'))
  learnPanel.append(
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

  const sidePanel = el('aside', 'os-panel os-summary-panel')
  sidePanel.append(el('div', 'os-panel-title', 'Acompanhamento'))
  sidePanel.append(
    factList([
      fact('Tutor responsável', tutorName),
      fact('Início', formatDate(cycle?.start_date)),
      fact('Fim previsto', formatDate(cycle?.end_date)),
      fact('Objetivo principal', cycle?.main_goal),
      fact('Plano atual', cycle?.current_plan),
    ])
  )

  if (lastSession) {
    sidePanel.append(el('div', 'os-panel-title', 'Último registro'))
    sidePanel.append(
      factList([
        fact('Data', formatDate(lastSession.date)),
        fact('Atividade', lastSession.activity_title),
        fact('Foco', lastSession.focus_area),
        fact('Observação', lastSession.notes),
        fact('Próximo passo', lastSession.next_step),
      ])
    )
  } else if (!cycle) {
    const next = el('div', 'os-next-card')
    next.append(el('span', null, 'Status do cadastro'), el('p', null, status))
    sidePanel.append(next)
  }

  grid.append(learnPanel, sidePanel)

  emptyBox.hidden = true
  content.replaceChildren(hero, factsRow, grid)
}

function showEmpty(message) {
  setText('[data-profile-name]', 'Perfil da criança')
  setText('[data-profile-subtitle]', '')
  content.replaceChildren()
  emptyBox.hidden = false
  const box = el('div', 'empty-state os-empty')
  box.append(el('strong', null, 'Nenhuma criança para exibir.'), el('span', null, message))
  emptyBox.replaceChildren(box)
}

function configureBackLink() {
  const role = session.profile.role
  const home = role === 'tutor' ? 'tutor.html' : role === 'admin' ? 'admin.html' : 'responsavel.html'
  document.querySelectorAll('[data-back-link]').forEach((link) => {
    link.href = home
  })
}

function fillAccount() {
  const name = session.profile.name || 'Conta'
  setText('[data-account-name]', name)
  setText('[data-account-email]', session.user.email ?? '')
  const avatar = document.querySelector('[data-account-avatar]')
  if (avatar) avatar.textContent = initials(name)
}

if (session && content && emptyBox) {
  configureBackLink()
  fillAccount()
  content.replaceChildren(el('div', 'skeleton'))

  const { data, error } = await resolveData()

  if (error) {
    showEmpty('Não foi possível carregar o perfil. Verifique a conexão e atualize a página.')
  } else if (!data) {
    const role = session.profile.role
    showEmpty(
      role === 'admin'
        ? 'Abra um perfil a partir do painel de operação usando o link com ?child=ID.'
        : 'Quando houver uma criança vinculada, o perfil pedagógico aparece aqui.'
    )
  } else {
    render(data)
  }
}
