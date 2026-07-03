import { el } from '../lib/ui.js'

// ── Fatia 1 (casca) ───────────────────────────────────────────────────────────
// Ainda SEM Supabase de propósito: o objetivo desta fatia é validar a casca +
// status-hero + timeline reusando o shell do tutor, antes de ligar no banco
// (guardian_dashboard_view entra na Fatia 2). Troque o estado pela URL, ex.:
// responsavel.html?estado=active — ver ESTADOS_VALIDOS abaixo.

const ESTADOS_VALIDOS = [
  'waiting_review', 'revision_requested', 'waiting_match',
  'matched', 'active', 'paused', 'completed', 'rejected',
]

const estadoParam = new URLSearchParams(location.search).get('estado')
const estadoAtual = ESTADOS_VALIDOS.includes(estadoParam) ? estadoParam : 'waiting_review'

const MOCK = {
  guardianName: 'Ana',
  child: {
    name: 'Lucas',
    age: 6,
    schoolYear: 'Educação Infantil',
    mainDifficulties: ['reconhecer números', 'contar objetos'],
    preferredFormats: ['visual', 'objetos concretos'],
  },
  cycle: {
    currentMonth: 2,
    totalMonths: 6,
    mainGoal: 'Contar objetos até 10 com apoio visual.',
    nextStep: 'Comparar quantidades pequenas (qual grupo tem mais).',
    tutor: {
      name: 'Marina Souza',
      formation: 'Pedagogia · validada pela equipe Cognita',
    },
    suggestedActivity: {
      title: 'Conte os animais até 5',
      format: 'visual',
      time: '5 min',
      why: 'Apoio visual e atividade curta — combina com o momento do Lucas.',
    },
    sessions: [
      {
        date: '2026-07-12',
        activityTitle: 'Contagem com apoio visual',
        familySummary: 'Lucas contou até 5 usando figuras de animais e mostrou bastante interesse pelos bichos.',
        nextStep: 'Repetir a contagem com pequenas variações no material.',
        durationMinutes: 20,
      },
      {
        date: '2026-07-05',
        activityTitle: 'Reconhecimento de números até 5',
        familySummary: 'Reconheceu os números 1, 2 e 3 com segurança; 4 e 5 ainda precisam de apoio visual.',
        nextStep: 'Trabalhar 4 e 5 com objetos concretos antes de avançar.',
        durationMinutes: 25,
      },
    ],
    progress: [
      { skill: 'Reconhecer números', label: 'Em desenvolvimento', level: 2 },
      { skill: 'Contar objetos', label: 'Trabalhando com apoio', level: 1 },
      { skill: 'Comparar quantidades', label: 'Próxima etapa', level: 0 },
    ],
    reports: [
      { month: 1, status: 'available' },
      { month: 2, status: 'in_review' },
    ],
  },
}

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault()
    // TODO(wiring:auth): trocar por signOut() real na Fatia 2.
    window.location.href = 'login.html'
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function firstName(name) {
  return (name ?? '').trim().split(/\s+/)[0] || ''
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

function fillIdentity() {
  const name = MOCK.guardianName
  const set = (sel, val) => { const node = document.querySelector(sel); if (node) node.textContent = val }
  set('[data-account-name]', name)
  set('[data-account-avatar]', initials(name))
  set('[data-topbar-avatar]', initials(name))
  set('[data-account-email]', 'ana@email.com')
}

// ── Rail: navegação por âncora dentro da própria página ──────────────────────

function scrollToSection(id) {
  document.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

document.querySelector('[data-rail-home]')?.addEventListener('click', () => {
  document.querySelector('#main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
})
document.querySelectorAll('[data-rail-scroll]').forEach((button) => {
  button.addEventListener('click', () => scrollToSection(button.dataset.railScroll))
})

// ── Central Cognita: canais externos (V2 = assíncrono, sem caixa interna) ────

function buildSupportDrawerContent() {
  const frag = document.createDocumentFragment()

  frag.append(el('p', 'support-note', 'Na V2, o contato com a equipe Cognita é pelos canais oficiais abaixo. Tempo médio de resposta: até 48h.'))

  const mail = el('a', 'support-channel')
  mail.href = 'mailto:equipecognita@email.com?subject=' + encodeURIComponent(`Dúvida sobre o acompanhamento de ${MOCK.child.name}`)
  mail.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
  mail.append(document.createTextNode('E-mail oficial'))

  const whats = el('a', 'support-channel')
  whats.href = 'https://wa.me/5500000000000'
  whats.target = '_blank'
  whats.rel = 'noopener'
  whats.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
  whats.append(document.createTextNode('WhatsApp oficial'))

  const social = el('a', 'support-channel')
  social.href = '../index.html'
  social.innerHTML = '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/></svg>'
  social.append(document.createTextNode('Redes oficiais'))

  frag.append(mail, whats, social)
  return frag
}

function openSupportDrawer() {
  const body = document.querySelector('[data-support-body]')
  const drawer = document.querySelector('[data-support-drawer]')
  const backdrop = document.querySelector('[data-support-backdrop]')
  if (!body || !drawer || !backdrop) return
  body.replaceChildren(buildSupportDrawerContent())
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

function closeSupportDrawer() {
  document.querySelector('[data-support-drawer]')?.classList.remove('open')
  document.querySelector('[data-support-backdrop]')?.classList.remove('open')
  document.querySelector('[data-support-drawer]')?.setAttribute('aria-hidden', 'true')
}

document.querySelector('[data-rail-team]')?.addEventListener('click', () => openSupportDrawer())
document.querySelector('[data-support-close]')?.addEventListener('click', closeSupportDrawer)
document.querySelector('[data-support-backdrop]')?.addEventListener('click', closeSupportDrawer)
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSupportDrawer() })

// ── status-hero: um por tela, sempre no topo ──────────────────────────────────

const TIMELINE_LABELS = ['Cadastro enviado', 'Em análise', 'Aguardando tutor', 'Ciclo ativo']

// timelineIndex = etapa "now"; tudo antes fica "done", tudo depois fica neutro.
const STATUS_COPY = {
  waiting_review: {
    tone: 'warn', timelineIndex: 1,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    label: 'Cadastro em análise',
    title: (child) => `Recebemos o cadastro do ${child}.`,
    desc: 'A equipe Cognita está analisando as informações para organizar o acompanhamento.',
    meta: 'Próximo passo: a equipe avisa quando houver uma atualização.',
  },
  revision_requested: {
    tone: 'bad', timelineIndex: 0,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    label: 'Revisão solicitada',
    title: (child) => `A equipe pediu ajustes no cadastro do ${child}.`,
    desc: 'Em breve você poderá editar as informações por aqui; enquanto isso, fique de olho no seu e-mail.',
    meta: 'Próximo passo: aguardar o link de edição por e-mail.',
  },
  waiting_match: {
    tone: 'ok', timelineIndex: 2,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
    label: 'Cadastro aprovado',
    title: (child) => `Cadastro do ${child} aprovado — aguardando tutor.`,
    desc: 'A equipe Cognita está organizando o pareamento com um tutor compatível.',
    meta: 'Próximo passo: avisaremos assim que o pareamento acontecer.',
  },
  matched: {
    tone: 'ok', timelineIndex: 3,
    icon: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    label: 'Pareamento criado',
    title: (child) => `Um tutor foi reservado para ${child}.`,
    desc: 'O acompanhamento vai começar em breve — a equipe confirma a data do primeiro encontro.',
    meta: 'Próximo passo: aguardar a confirmação do início do ciclo.',
  },
  active: {
    tone: 'info',
    icon: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    label: 'Ciclo ativo',
    title: () => 'O acompanhamento está em andamento.',
  },
  paused: {
    tone: 'warn',
    icon: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    label: 'Acompanhamento pausado',
    title: () => 'O ciclo está pausado no momento.',
    desc: 'A equipe Cognita vai entrar em contato com os próximos passos.',
    meta: 'Falar com a equipe se tiver dúvidas sobre a pausa.',
  },
  completed: {
    tone: 'ok',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
    label: 'Ciclo concluído',
    title: (child) => `O ciclo de acompanhamento do ${child} foi concluído.`,
    desc: 'Obrigado por caminhar com a gente. O histórico de sessões e relatórios continua disponível abaixo.',
  },
  rejected: {
    tone: 'bad',
    icon: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>',
    label: 'Cadastro não aprovado',
    title: () => 'Não foi possível aprovar este cadastro.',
    desc: 'Fale com a equipe Cognita para entender os próximos passos.',
  },
}

function renderTimeline(timelineIndex) {
  const wrap = el('div', 'steps')
  TIMELINE_LABELS.forEach((label, index) => {
    const cls = index < timelineIndex ? 'done' : index === timelineIndex ? 'now' : ''
    const step = el('div', `step${cls ? ` ${cls}` : ''}`)
    step.append(el('div', 'step-n', index < timelineIndex ? '✓' : String(index + 1)))
    step.append(el('div', null, label))
    wrap.append(step)
  })
  return wrap
}

function renderStatusHero(state) {
  const copy = STATUS_COPY[state] ?? STATUS_COPY.waiting_review
  const childName = MOCK.child.name

  const hero = el('section', 'status-hero')
  hero.dataset.section = 'inicio'

  const chip = el('span', `hero-chip tone-${copy.tone}`)
  chip.innerHTML = copy.icon
  chip.append(document.createTextNode(copy.label))
  hero.append(chip)

  hero.append(el('h1', 'hero-title', copy.title(childName)))

  if (state === 'active' || state === 'matched') {
    const cycle = MOCK.cycle
    hero.append(el('p', 'hero-meta', `Mês ${cycle.currentMonth} de ${cycle.totalMonths}`))
    hero.append(el('p', 'hero-desc', `Objetivo atual: ${cycle.mainGoal}`))
    if (cycle.nextStep) hero.append(el('p', 'hero-desc', `Próxima etapa: ${cycle.nextStep}`))
  } else {
    if (copy.desc) hero.append(el('p', 'hero-desc', copy.desc))
  }

  if (copy.timelineIndex != null) {
    hero.append(renderTimeline(copy.timelineIndex))
  }

  if (copy.meta) hero.append(el('p', 'hero-meta', copy.meta))

  if (['waiting_review', 'revision_requested', 'waiting_match'].includes(state)) {
    const actions = el('div', 'hero-actions')
    const seeData = el('button', 'btn btn-ghost btn-sm', 'Ver dados enviados')
    seeData.type = 'button'
    seeData.addEventListener('click', () => scrollToSection('crianca'))
    actions.append(seeData)
    hero.append(actions)
  }

  return hero
}

// ── Resumo da criança + "Enquanto isso" (estados pré-match) ──────────────────

function renderPrematchRow() {
  const row = el('div', 'row')
  row.dataset.section = 'crianca'

  const resumo = el('div', 'card')
  const resumoHead = el('div', 'card-h')
  resumoHead.append(el('h3', null, `Resumo do ${firstName(MOCK.child.name)}`))
  const resumoBody = el('div', 'card-b')
  const kv = el('dl', 'kv')
  kv.append(
    el('dt', null, 'Idade'), el('dd', null, `${MOCK.child.age} anos`),
    el('dt', null, 'Ano escolar'), el('dd', null, MOCK.child.schoolYear),
    el('dt', null, 'Aprende melhor'), el('dd', null, MOCK.child.preferredFormats.join(', ')),
    el('dt', null, 'Foco'), el('dd', null, MOCK.child.mainDifficulties.join(', ')),
  )
  resumoBody.append(kv)
  const editBtn = el('button', 'btn btn-ghost btn-sm', 'Editar perfil')
  editBtn.type = 'button'
  editBtn.style.marginTop = '12px'
  // TODO(wiring:fatia4): abrir edição real do perfil pedagógico na Fatia 4.
  resumoBody.append(editBtn)
  resumo.append(resumoHead, resumoBody)

  const enquanto = el('div', 'card')
  const enquantoHead = el('div', 'card-h')
  enquantoHead.append(el('h3', null, 'Enquanto isso'))
  const enquantoBody = el('div', 'card-b stack')
  const lib = el('a', 'card-h-link', 'Conheça as atividades →')
  lib.href = 'atividades.html'
  const perfil = el('button', 'card-h-link', 'Revise o perfil enviado →')
  perfil.type = 'button'
  perfil.style.cssText = 'background:none;border:none;text-align:left;cursor:pointer;font-family:inherit'
  perfil.addEventListener('click', () => scrollToSection('crianca'))
  enquantoBody.append(lib, perfil)
  enquanto.append(enquantoHead, enquantoBody)

  row.append(resumo, enquanto)
  return row
}

// ── Ciclo ativo: tutor + atividade sugerida ───────────────────────────────────

function renderTutorAndActivityRow() {
  const row = el('div', 'row')
  row.dataset.section = 'crianca'

  const tutorCard = el('div', 'card')
  const tutorHead = el('div', 'card-h')
  tutorHead.append(el('h3', null, 'Tutor vinculado'))
  tutorCard.append(tutorHead)
  const tutorBody = el('div', 'card-b')
  const tutorInner = el('div', 'tutor-card')
  tutorInner.append(el('div', 'av', initials(MOCK.cycle.tutor.name)))
  const tx = el('div', 'tx')
  tx.append(el('b', null, MOCK.cycle.tutor.name), el('span', null, MOCK.cycle.tutor.formation))
  tutorInner.append(tx)
  tutorBody.append(tutorInner)
  tutorBody.append(el('div', 'tutor-note', 'Contato é sempre mediado pela equipe Cognita.'))
  tutorCard.append(tutorBody)

  const activityCard = el('div', 'card')
  const activityHead = el('div', 'card-h')
  activityHead.append(el('h3', null, 'Próxima atividade sugerida'))
  activityCard.append(activityHead)
  const activityBody = el('div', 'card-b')
  const activity = MOCK.cycle.suggestedActivity
  activityBody.append(el('div', 'sg-title', activity.title))
  activityBody.append(el('div', 'sg-why', `Por quê: ${activity.why}`))
  const facts = el('div', 'sg-facts')
  facts.append(el('span', null, activity.format), el('span', null, activity.time))
  activityBody.append(facts)
  const actions = el('div', 'hero-actions')
  const openLib = el('a', 'btn btn-ghost btn-sm', 'Ver atividade')
  openLib.href = 'atividades.html'
  actions.append(openLib)
  activityBody.append(actions)
  activityCard.append(activityBody)

  row.append(tutorCard, activityCard)
  return row
}

// ── Sessões recentes (resumo para a família — nunca notas internas) ──────────

function renderSessionsCard() {
  const card = el('div', 'card')
  card.dataset.section = 'sessoes'
  const head = el('div', 'card-h')
  head.append(el('h3', null, 'Sessões recentes'))
  card.append(head)
  const body = el('div', 'card-b')

  if (!MOCK.cycle.sessions.length) {
    const empty = el('div', 'empty-state')
    empty.append(
      el('strong', null, 'Nenhuma sessão registrada ainda.'),
      el('span', null, 'Assim que o tutor registrar a primeira sessão, o resumo aparece aqui.'),
    )
    body.append(empty)
  } else {
    MOCK.cycle.sessions.forEach((session) => {
      const item = el('div', 'session-card')
      const scHead = el('div', 'sc-head')
      scHead.append(el('span', 'sc-date', formatDate(session.date) ?? '—'))
      if (session.durationMinutes) scHead.append(el('span', 'sc-date', `${session.durationMinutes} min`))
      item.append(scHead)
      item.append(el('div', 'sc-title', session.activityTitle))
      item.append(el('p', 'sc-summary', session.familySummary))
      if (session.nextStep) item.append(el('p', 'sc-next', `Próximo passo: ${session.nextStep}`))
      const foot = el('div', 'sc-foot')
      const flag = el('button', 'sc-flag', '⚑ Sinalizar')
      flag.type = 'button'
      // TODO(wiring:fatia3): abrir fluxo real de sinalização quando o Registro
      // de Sessão tiver os 3 níveis (estruturado / resumo família / interno).
      foot.append(flag)
      item.append(foot)
      body.append(item)
    })
  }

  card.append(body)
  return card
}

// ── Progresso qualitativo (habilidade + etapa — sem % como métrica principal) ─

function renderProgressCard() {
  const card = el('div', 'card')
  const head = el('div', 'card-h')
  head.append(el('h3', null, 'Progresso'))
  card.append(head)
  const body = el('div', 'card-b progress-row')

  MOCK.cycle.progress.forEach((item) => {
    const row = el('div', 'progress-item')
    const rowHead = el('div', 'pi-head')
    rowHead.append(el('span', 'pi-skill', item.skill), el('span', 'pi-label', item.label))
    row.append(rowHead)
    const bar = el('div', 'pi-bar')
    const fill = el('div', 'pi-fill')
    fill.style.width = `${(item.level + 1) * 30}%`
    bar.append(fill)
    row.append(bar)
    body.append(row)
  })

  body.append(el('p', 'progress-note', 'Qualitativo — sem nota, sem comparar com outras crianças.'))
  card.append(body)
  return card
}

// ── Relatórios (só os revisados) ──────────────────────────────────────────────

function renderReportsCard() {
  const card = el('div', 'card')
  card.dataset.section = 'relatorios'
  const head = el('div', 'card-h')
  head.append(el('h3', null, 'Relatórios'))
  card.append(head)
  const body = el('div', 'card-b')

  MOCK.cycle.reports.forEach((report) => {
    const row = el('div', 'report-row')
    row.append(el('b', null, `Mês ${report.month}`))
    if (report.status === 'available') {
      const wrap = el('span')
      wrap.style.cssText = 'display:flex;align-items:center;gap:10px'
      wrap.append(el('span', 'pill pill-ok', 'Disponível'))
      const link = el('a', 'card-h-link', 'Ver →')
      link.href = '#'
      wrap.append(link)
      row.append(wrap)
    } else {
      row.append(el('span', 'pill pill-mid', 'Em revisão'))
    }
    body.append(row)
  })

  card.append(body)
  return card
}

// ── Monta a página conforme o estado ──────────────────────────────────────────

function render(state) {
  const box = document.querySelector('[data-guardian-state]')
  if (!box) return

  const panel = el('div', 'panel')
  panel.append(renderStatusHero(state))

  if (['waiting_review', 'revision_requested', 'waiting_match'].includes(state)) {
    panel.append(renderPrematchRow())
  } else if (['matched'].includes(state)) {
    panel.append(renderPrematchRow())
  } else {
    panel.append(renderTutorAndActivityRow())
    panel.append(renderSessionsCard())
    panel.append(renderProgressCard())
    panel.append(renderReportsCard())
  }

  box.replaceChildren(panel)
}

fillIdentity()
render(estadoAtual)
