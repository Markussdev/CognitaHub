import { el, ageFrom, initials } from '../lib/ui.js'
import { requireRole, signOut } from '../lib/auth.js'
import { getGuardianChildren } from '../data/guardian.js'
import astronautaSrc from '../../assets/cat-astronauta.png'
import cientistaSrc from '../../assets/cat-cientista.png'
import magoSrc from '../../assets/cat-mago.png'
import pintorSrc from '../../assets/cat-pintor.png'

// ── Ligado ao Supabase ────────────────────────────────────────────────────────
// Início/Criança/Sessões usam dado real (children → support_cycles → tutor →
// sessions, via js/data/guardian.js). Relatórios e Atividades continuam
// mockados de propósito — não há monthly_reports nem curadoria de atividades
// pra família no banco ainda.
//
// O `?estado=` na URL vira fallback de demo: só é usado se NÃO houver ciclo
// real (ver boot() no fim do arquivo). Assim que existir support_cycles de
// verdade, o dado real sempre vence — a URL nunca sobrepõe uma família real.

const ESTADOS_VALIDOS = [
  'waiting_review', 'revision_requested', 'waiting_match',
  'matched', 'active', 'paused', 'completed', 'rejected',
]

const estadoParam = new URLSearchParams(location.search).get('estado')
const estadoOverride = ESTADOS_VALIDOS.includes(estadoParam) ? estadoParam : null

// Estados em que já existe tutor vinculado E sessão/relatório de verdade.
// 'matched' fica de fora: já tem tutor, mas o ciclo ainda não começou —
// por isso cai no mesmo tratamento "pré-match" nas 4 abas.
const SESSION_REPORT_STATES = ['active', 'paused', 'completed']

// ── Avatar Cognita da criança (SEM foto — decisão deliberada) ────────────────
// A criança nunca usa foto própria no produto. O avatar é um mascote (gato
// temático) + cor de anel, puramente decorativo, para o tutor "ver" a criança
// sem expor imagem real. Ainda visual-only: children.avatar_key/avatar_color
// entram no schema na Fatia E, junto com o resto da personalização de conta.
const AVATAR_META = {
  astronauta: { src: astronautaSrc, label: 'Astronauta' },
  cientista: { src: cientistaSrc, label: 'Cientista' },
  mago: { src: magoSrc, label: 'Mago' },
  pintor: { src: pintorSrc, label: 'Pintor' },
}
const AVATAR_COLORS = ['#141162', '#540042', '#1c7c54', '#b3590a']

// Ícones pequenos para os itens de "o que ajuda" / "o que pode dificultar".
const TRAIT_ICONS = {
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8a4 4 0 0 1 0 8"/><path d="M18 5a8 8 0 0 1 0 14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
}

// Ícones das atividades sugeridas (aba Atividades) — um por tipo de exercício.
const ACTIVITY_ICONS = {
  contar: '<svg viewBox="0 0 24 24"><rect x="3" y="10" width="4" height="8" rx="1"/><rect x="10" y="6" width="4" height="12" rx="1"/><rect x="17" y="13" width="4" height="5" rx="1"/></svg>',
  comparar: '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M4 8l3 5h-6z"/><path d="M20 8l3 5h-6z"/><path d="M2 13a3 2 0 0 0 5 0"/><path d="M17 13a3 2 0 0 0 5 0"/></svg>',
  trilha: '<svg viewBox="0 0 24 24"><circle cx="5" cy="19" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="5" r="2.2"/><path d="M6.6 17.4l3.8-3.8"/><path d="M13.6 10.4l3.8-3.8"/></svg>',
}

const CARE_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'

const MOCK = {
  guardianName: 'Ana',
  guardianPhone: '(91) 90000-0000',
  guardianEmail: 'ana@email.com',
  child: {
    name: 'Lucas',
    age: 6,
    schoolYear: 'Educação Infantil',
    mainDifficulties: ['reconhecer números', 'contar objetos'],
    preferredFormats: ['visual', 'objetos concretos'],
    identityChips: ['Aprende melhor com apoio visual', 'Gosta de temas com animais', 'Sessões curtas funcionam melhor'],
    favoriteTheme: 'Animais',
    avatarIcon: 'astronauta',
    avatarColor: AVATAR_COLORS[0],
    learning: {
      formatoIdeal: 'Passos curtos',
      duracaoIdeal: '10 a 15 minutos',
      oQueAjuda: [
        { icon: 'clock', text: 'Sessões curtas, de 10 a 15 minutos' },
        { icon: 'chat', text: 'Elogio específico durante a atividade' },
        { icon: 'heart', text: 'Temas com animais' },
      ],
      oQueDificulta: [
        { icon: 'doc', text: 'Muito texto de uma vez' },
        { icon: 'megaphone', text: 'Instruções longas' },
        { icon: 'shuffle', text: 'Troca brusca de uma tarefa para outra' },
      ],
      focoAtual: 'Reconhecer números e contar objetos até 10.',
      focoChips: ['Reconhecer números', 'Contar objetos', 'Até 10'],
    },
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
    // Mais recente primeiro — o resto do código assume sessions[0] = última sessão.
    sessions: [
      {
        date: '2026-06-29',
        title: 'Soma com apoio visual',
        activity: 'Blocos de contagem coloridos',
        focus: 'Juntar pequenas quantidades',
        duration: 15,
        howItWent: 'Conseguiu acompanhar melhor com mediação e tempo de pausa.',
        whatHelped: 'Apoio visual, ritmo calmo',
        whatHindered: 'Instrução longa no começo',
        nextStep: 'Reforçar contagem antes de avançar para soma.',
      },
      {
        date: '2026-06-27',
        title: 'Contagem com objetos',
        activity: 'Conte os dinossauros',
        focus: 'Contagem um a um até 5',
        duration: 15,
        howItWent: 'Participou bem quando pôde tocar os objetos um por um.',
        whatHelped: 'Objetos concretos, elogio curto',
        whatHindered: 'Distração com outros itens da mesa',
        nextStep: 'Repetir com menos estímulos visuais.',
      },
      {
        date: '2026-06-24',
        title: 'Reconhecendo números',
        activity: 'Toque no número',
        focus: 'Reconhecer números de 1 a 5',
        duration: 12,
        howItWent: 'Lucas respondeu melhor com apoio visual e repetição curta.',
        whatHelped: 'Números grandes, instruções simples',
        whatHindered: 'Troca rápida entre tarefas',
        nextStep: 'Manter números de 1 a 5 antes de avançar.',
      },
    ],
    nextStepTips: [
      'Continuar o reconhecimento de números de 1 a 5.',
      'Repetir atividades curtas com apoio visual.',
      'Evitar instruções longas — preferir passos curtos.',
    ],
    // Um relatório completo por mês — só "available" tem o conteúdo cheio;
    // "in_review" é intencionalmente enxuto (a tela mostra "em preparação").
    reports: [
      {
        month: 1, status: 'available', monthLabel: 'Junho de 2026',
        sessionsCount: 3,
        mainFocus: 'Reconhecer números e contar objetos até 10',
        bestSupport: 'Apoio visual e objetos concretos',
        nextFocus: 'Comparar quantidades pequenas',
        summary: 'Lucas iniciou o acompanhamento trabalhando reconhecimento de números e contagem com apoio visual. As atividades curtas funcionaram melhor, principalmente quando usaram objetos concretos e temas com animais. Neste mês, o principal avanço foi conseguir contar pequenas quantidades com menos ajuda.',
        skills: [
          { label: 'Reconhecer números', level: 70, status: 'Mais consistente' },
          { label: 'Contar objetos 1:1', level: 52, status: 'Em desenvolvimento' },
          { label: 'Comparar quantidades', level: 24, status: 'Início' },
          { label: 'Adição simples', level: 10, status: 'Ainda não iniciado' },
        ],
        timeline: [
          { week: 'Semana 1', text: 'Reconheceu números com apoio visual.' },
          { week: 'Semana 2', text: 'Contou objetos pequenos com ajuda.' },
          { week: 'Semana 3', text: 'Participou melhor com objetos concretos.' },
          { week: 'Semana 4', text: 'Começou a juntar pequenas quantidades.' },
        ],
        advances: [
          'Mais segurança ao contar objetos pequenos.',
          'Melhor resposta quando a atividade é dividida em passos curtos.',
          'Maior interesse quando o tema envolve animais.',
        ],
        supports: [
          { label: 'Apoio visual', count: 4 },
          { label: 'Objetos concretos', count: 3 },
          { label: 'Elogio específico', count: 2 },
          { label: 'Pausa entre passos', count: 2 },
        ],
        attention: [
          'Instruções longas ainda dificultam a participação.',
          'Muitos elementos visuais ao mesmo tempo podem distrair.',
        ],
        homeTips: [
          'Conte objetos do dia a dia (brinquedos, frutas) por poucos minutos.',
          'Evite transformar a atividade em prova.',
          'Celebre tentativas e pequenos avanços, não só acertos.',
        ],
      },
      { month: 2, status: 'in_review', monthLabel: 'Julho de 2026' },
    ],
  },
  familyActivities: [
    {
      title: 'Conte objetos da casa',
      time: '5 min', tag: 'objetos concretos', icon: 'contar', tone: 'brand',
      how: 'Escolha até 5 objetos (talheres, brinquedos, frutas) e conte junto com a criança, apontando um por um.',
      careNote: 'Não transforme em prova. Faça como brincadeira, sem cobrar acerto.',
    },
    {
      title: 'Qual grupo tem mais?',
      time: '10 min', tag: 'comparação visual', icon: 'comparar', tone: 'ok',
      how: 'Separe dois grupos pequenos de objetos iguais e pergunte qual tem mais, apontando para os dois.',
      careNote: 'Se não responder de primeira, mostre contando os dois grupos em voz alta.',
    },
    {
      title: 'Trilha numerada',
      time: '15 min', tag: 'sequência visual', icon: 'trilha', tone: 'warn',
      how: 'Desenhe uma trilha de 1 a 10 no chão ou papel e peça para pular/apontar na ordem certa.',
      careNote: 'Pare em 5 se perceber cansaço — não precisa completar até 10 sempre.',
    },
  ],
}

// ── Adaptação de dado real → o mesmo formato que os render*Panel já leem ────
// Estratégia: em vez de reescrever cada função de render, sobrescreve os
// campos de MOCK.* com dado real quando ele existe. Campo sem valor real
// mantém o mock como fallback — nunca fica um card vazio por causa de um
// campo opcional que a família não preencheu.

// Prioriza o ciclo mais "adiante" no fluxo — planned > active > paused >
// completed — quando por algum motivo existir mais de um em support_cycles.
function pickCycle(child) {
  const cycles = child?.support_cycles ?? []
  if (!cycles.length) return null
  const priority = ['active', 'paused', 'completed', 'planned']
  for (const status of priority) {
    const found = cycles.find((cycle) => cycle.status === status)
    if (found) return found
  }
  return cycles[0]
}

function applyRealChild(child) {
  const learningProfile = Array.isArray(child.learning_profiles) ? child.learning_profiles[0] : child.learning_profiles
  const age = ageFrom(child.birth_date)

  MOCK.child.name = child.name || MOCK.child.name
  MOCK.child.age = age ?? MOCK.child.age
  MOCK.child.schoolYear = child.school_year || MOCK.child.schoolYear

  const difficulties = toList(child.main_difficulties).length
    ? toList(child.main_difficulties)
    : toList(learningProfile?.math_difficulties)
  if (difficulties.length) MOCK.child.mainDifficulties = difficulties

  const formats = toList(learningProfile?.preferred_formats)
  if (formats.length) MOCK.child.preferredFormats = formats.map(cap)

  const motivators = toList(learningProfile?.motivators)
  if (motivators.length) {
    MOCK.child.learning.oQueAjuda = motivators.map((text, index) => ({
      icon: ['heart', 'chat', 'clock'][index % 3],
      text,
    }))
  }

  const avoidances = toList(learningProfile?.avoidances)
  if (avoidances.length) {
    MOCK.child.learning.oQueDificulta = avoidances.map((text, index) => ({
      icon: ['doc', 'megaphone', 'shuffle'][index % 3],
      text,
    }))
  }

  if (difficulties.length) {
    MOCK.child.learning.focoChips = difficulties.map(cap)
    MOCK.child.learning.focoAtual = `Trabalhar ${difficulties.join(', ')}.`
  }

  if (learningProfile?.attention_span) {
    MOCK.child.learning.duracaoIdeal = ATTENTION_SPAN_DURATION[learningProfile.attention_span] ?? MOCK.child.learning.duracaoIdeal
  }
  if (formats.length) {
    MOCK.child.learning.formatoIdeal = `Apoio em ${formats.join(', ').toLowerCase()}`
  }

  // Chips de identidade do hero — só entram quando há dado real por trás.
  const chips = []
  if (formats[0]) chips.push(`Aprende melhor com ${formats[0].toLowerCase()}`)
  if (learningProfile?.attention_span) chips.push(`Duração ideal: ${ATTENTION_SPAN_DURATION[learningProfile.attention_span] ?? ''}`)
  if (difficulties[0]) chips.push(`Foco: ${difficulties[0]}`)
  if (chips.length) MOCK.child.identityChips = chips
}

function applyRealCycle(cycle) {
  const tutor = Array.isArray(cycle.profiles) ? cycle.profiles[0] : cycle.profiles
  const sessions = cycle.sessions ?? []

  MOCK.cycle.totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
  MOCK.cycle.currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  MOCK.cycle.mainGoal = cycle.main_goal || MOCK.cycle.mainGoal
  MOCK.cycle.nextStep = sessions[0]?.next_step || cycle.current_plan || MOCK.cycle.nextStep

  if (tutor?.name) {
    MOCK.cycle.tutor = {
      name: tutor.name,
      formation: tutor.tutor_formation
        ? `${tutor.tutor_formation} · validada pela equipe Cognita`
        : 'Validado(a) pela equipe Cognita',
      presentation: tutor.tutor_presentation || null,
    }
  }

  if (sessions.length) {
    MOCK.cycle.sessions = sessions.map((session) => ({
      date: session.date,
      title: session.activity_title || 'Sessão registrada',
      activity: session.activity_title || '—',
      focus: session.focus_area || '—',
      howItWent: session.family_summary || 'O tutor ainda não deixou um resumo para esta sessão.',
      whatHelped: null,
      whatHindered: null,
      nextStep: session.next_step || null,
      duration: session.duration_minutes || null,
    }))
  }
}

// cycle.status já cobre o pós-match (planned/active/paused/completed);
// antes disso, quem manda é child.status (waiting_review → ... → waiting_match).
function deriveGuardianStatus(child, cycle) {
  if (!child) return null
  if (cycle?.status === 'planned') return 'matched'
  if (cycle?.status === 'active') return 'active'
  if (cycle?.status === 'paused') return 'paused'
  if (cycle?.status === 'completed') return 'completed'
  return child.status || 'waiting_review'
}

const CRUMB_LABEL = {
  home: 'Painel da família',
  child: 'Criança',
  sessions: 'Sessões',
  reports: 'Relatórios',
  activities: 'Atividades',
}

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    event.preventDefault()
    await signOut()
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normaliza valores vindos do Postgres em formatos diferentes: array real,
// JSON stringificado ("[\"a\",\"b\"]") ou literal de array ("{a,\"b c\"}") —
// mesma robustez usada em tutor.js pro mesmo problema.
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

function monthsBetween(start, end) {
  if (!start || !end) return 6
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 6
  const months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startDate.getUTCMonth())
  return Math.max(1, months)
}

function currentCycleMonth(start, end) {
  if (!start) return 1
  const now = new Date()
  const startDate = new Date(`${start}T00:00:00Z`)
  if (Number.isNaN(startDate.getTime())) return 1
  const total = monthsBetween(start, end)
  const elapsed = (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - startDate.getUTCMonth()) + 1
  return Math.min(Math.max(elapsed, 1), total)
}

const ATTENTION_SPAN_DURATION = { short: '5 a 10 minutos', medium: '15 a 20 minutos', long: '30 minutos ou mais' }

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
  const setAll = (sel, val) => document.querySelectorAll(sel).forEach((node) => { node.textContent = val })
  set('[data-account-name]', name)
  set('[data-account-avatar]', initials(name))
  set('[data-topbar-avatar]', initials(name))
  setAll('[data-account-menu-name]', name)
  setAll('[data-account-menu-avatar]', initials(name))
  set('[data-account-email]', MOCK.guardianEmail)
}

// ── Navegação por abas (rail) ─────────────────────────────────────────────────

let activeTab = 'home'

function switchTab(tab) {
  activeTab = tab
  document.querySelectorAll('[data-rail-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.railTab === tab)
  })
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab
  })
  const crumb = document.querySelector('[data-crumb]')
  if (crumb) crumb.textContent = CRUMB_LABEL[tab] ?? CRUMB_LABEL.home
  document.querySelector('#main-content')?.scrollTo({ top: 0 })
}

document.querySelectorAll('[data-rail-tab]').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.railTab))
})

// ── Menu da conta (avatar → Meu perfil / Preferências / Sair) ─────────────────

const accountTrigger = document.querySelector('[data-account-trigger]')
const accountMenu = document.querySelector('[data-account-menu]')

function closeAccountMenu() {
  accountMenu?.classList.remove('open')
  accountTrigger?.classList.remove('is-open')
  accountTrigger?.setAttribute('aria-expanded', 'false')
}

accountTrigger?.addEventListener('click', (event) => {
  event.stopPropagation()
  const isOpen = accountMenu.classList.toggle('open')
  accountTrigger.classList.toggle('is-open', isOpen)
  accountTrigger.setAttribute('aria-expanded', String(isOpen))
})
accountMenu?.addEventListener('click', (event) => event.stopPropagation())
document.addEventListener('click', closeAccountMenu)

function profileField(label, value) {
  const field = el('div', 'field')
  field.append(el('label', null, label))
  const input = document.createElement('input')
  input.type = 'text'
  input.value = value
  field.append(input)
  return field
}

function buildAccountDrawerContent(kind) {
  const frag = document.createDocumentFragment()

  if (kind === 'perfil') {
    const photoField = el('div', 'field')
    photoField.append(el('label', null, 'Foto de perfil'))
    const photoRow = el('div')
    photoRow.style.cssText = 'display:flex;align-items:center;gap:10px'
    const preview = el('div', null, initials(MOCK.guardianName))
    preview.style.cssText = 'width:40px;height:40px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:700;flex-shrink:0'
    const changeBtn = el('button', 'btn btn-ghost btn-sm', 'Alterar foto')
    changeBtn.type = 'button'
    photoRow.append(preview, changeBtn)
    photoField.append(photoRow)

    frag.append(
      profileField('Nome exibido', MOCK.guardianName),
      photoField,
      profileField('Telefone', MOCK.guardianPhone),
      profileField('E-mail', MOCK.guardianEmail),
    )
  } else {
    frag.append(profileField('Preferência de contato', 'WhatsApp'))
    const notifyField = el('div', 'field')
    notifyField.append(el('label', null, 'Notificações'))
    const checkboxRow = document.createElement('label')
    checkboxRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:.86rem;color:var(--ink-soft);font-weight:400'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkboxRow.append(checkbox, document.createTextNode('Avisar por e-mail quando houver atualização do cadastro'))
    notifyField.append(checkboxRow)
    frag.append(notifyField)
  }

  const saveBtn = el('button', 'btn btn-accent btn-sm', 'Salvar')
  saveBtn.type = 'button'
  saveBtn.style.marginTop = '4px'
  frag.append(saveBtn)
  frag.append(el('p', 'stub-note', 'Personalização de conta — visual por enquanto. Isso ainda não é salvo de verdade (entra quando o Supabase for ligado).'))

  return frag
}

function openAccountDrawer(kind) {
  const body = document.querySelector('[data-account-body]')
  const drawer = document.querySelector('[data-account-drawer]')
  const backdrop = document.querySelector('[data-account-backdrop]')
  const title = document.querySelector('[data-account-drawer-title]')
  if (!body || !drawer || !backdrop) return
  if (title) title.textContent = kind === 'perfil' ? 'Meu perfil' : 'Preferências'
  body.replaceChildren(buildAccountDrawerContent(kind))
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

function closeAccountDrawer() {
  document.querySelector('[data-account-drawer]')?.classList.remove('open')
  document.querySelector('[data-account-backdrop]')?.classList.remove('open')
  document.querySelector('[data-account-drawer]')?.setAttribute('aria-hidden', 'true')
}

document.querySelectorAll('[data-account-open]').forEach((button) => {
  button.addEventListener('click', () => {
    closeAccountMenu()
    openAccountDrawer(button.dataset.accountOpen)
  })
})
document.querySelector('[data-account-close]')?.addEventListener('click', closeAccountDrawer)
document.querySelector('[data-account-backdrop]')?.addEventListener('click', closeAccountDrawer)

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
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  closeSupportDrawer()
  closeAccountDrawer()
  closeSessionDrawer()
  accountMenu?.classList.remove('open')
})

// ── status-hero: um por tela, sempre no topo ──────────────────────────────────

const TIMELINE_LABELS = ['Cadastro enviado', 'Em análise', 'Aguardando tutor', 'Ciclo ativo']

// timelineIndex = etapa "now"; tudo antes fica "done", tudo depois fica neutro.
// next = o mini bloco "O que acontece agora" ao lado do texto principal.
const STATUS_COPY = {
  waiting_review: {
    tone: 'warn', timelineIndex: 1,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    label: 'Cadastro em análise',
    title: (child) => `Recebemos o cadastro do ${child}.`,
    desc: 'A equipe Cognita está analisando as informações para organizar o acompanhamento.',
    next: { desc: 'A equipe revisa as informações e avisa quando houver atualização.', eta: 'Tempo estimado: até 5 dias úteis.' },
  },
  revision_requested: {
    tone: 'bad', timelineIndex: 0,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    label: 'Revisão solicitada',
    title: (child) => `A equipe pediu ajustes no cadastro do ${child}.`,
    desc: 'Em breve você poderá editar as informações por aqui; enquanto isso, fique de olho no seu e-mail.',
    next: { desc: 'Aguarde o link de edição, enviado por e-mail.', eta: 'Tempo estimado: até 2 dias úteis.' },
  },
  waiting_match: {
    tone: 'ok', timelineIndex: 2,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
    label: 'Cadastro aprovado',
    title: (child) => `Cadastro do ${child} aprovado — aguardando tutor.`,
    desc: 'A equipe Cognita está organizando o pareamento com um tutor compatível.',
    next: { desc: 'Avisaremos assim que o pareamento com um tutor acontecer.', eta: 'Tempo estimado: varia conforme disponibilidade.' },
  },
  matched: {
    tone: 'ok', timelineIndex: 3,
    icon: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    label: 'Pareamento criado',
    title: (child) => `Um tutor foi reservado para ${child}.`,
    desc: 'O acompanhamento vai começar em breve — a equipe confirma a data do primeiro encontro.',
    next: { desc: 'A equipe confirma a data do primeiro encontro.', eta: 'Tempo estimado: até 5 dias úteis.' },
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
    next: { desc: 'Fale com a equipe se tiver dúvidas sobre a pausa.' },
  },
  completed: {
    tone: 'ok',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
    label: 'Ciclo concluído',
    title: (child) => `O ciclo de acompanhamento do ${child} foi concluído.`,
    desc: 'Obrigado por caminhar com a gente. O histórico de sessões e relatórios continua disponível nas abas ao lado.',
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

function renderNextBox(next) {
  const box = el('div', 'next-box')
  box.append(el('b', null, 'O que acontece agora'))
  box.append(el('p', null, next.desc))
  if (next.eta) box.append(el('p', 'eta', next.eta))
  return box
}

function renderStatusHero(state) {
  const copy = STATUS_COPY[state] ?? STATUS_COPY.waiting_review
  const childName = MOCK.child.name

  const hero = el('section', 'status-hero')

  const main = el('div', 'hero-main')
  const text = el('div')

  const chip = el('span', `hero-chip tone-${copy.tone}`)
  chip.innerHTML = copy.icon
  chip.append(document.createTextNode(copy.label))
  text.append(chip)

  text.append(el('h1', 'hero-title', copy.title(childName)))

  if (state === 'active' || state === 'matched') {
    const cycle = MOCK.cycle
    text.append(el('p', 'hero-meta', `Mês ${cycle.currentMonth} de ${cycle.totalMonths}`))
    text.append(el('p', 'hero-desc', `Objetivo atual: ${cycle.mainGoal}`))
    if (cycle.nextStep) text.append(el('p', 'hero-desc', `Próxima etapa: ${cycle.nextStep}`))
  } else if (copy.desc) {
    text.append(el('p', 'hero-desc', copy.desc))
  }

  if (['waiting_review', 'revision_requested', 'waiting_match'].includes(state)) {
    const actions = el('div', 'hero-actions')
    const seeData = el('button', 'btn btn-ghost btn-sm', 'Ver dados enviados')
    seeData.type = 'button'
    seeData.addEventListener('click', () => switchTab('child'))
    actions.append(seeData)
    text.append(actions)
  }

  main.append(text)
  if (copy.next) main.append(renderNextBox(copy.next))
  hero.append(main)

  if (copy.timelineIndex != null) {
    hero.append(renderTimeline(copy.timelineIndex))
  }

  return hero
}

function renderGuardianHeader() {
  const head = el('header', 'family-head')
  head.append(
    el('p', 'kicker', 'Hoje'),
    el('h1', null, `Olá, ${MOCK.guardianName}.`),
    el('p', null, `Acompanhe aqui o processo do ${MOCK.child.name} no Cognita.`),
  )
  return head
}

// ── Resumo da criança + "Enquanto isso" (estados pré-match) ──────────────────

function renderPrematchRow() {
  const row = el('div', 'row')

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
  const editBtn = el('button', 'btn btn-ghost btn-sm', 'Ver perfil completo')
  editBtn.type = 'button'
  editBtn.style.marginTop = '12px'
  editBtn.addEventListener('click', () => switchTab('child'))
  resumoBody.append(editBtn)
  resumo.append(resumoHead, resumoBody)

  const enquanto = el('div', 'card')
  const enquantoHead = el('div', 'card-h')
  enquantoHead.append(el('h3', null, 'Enquanto isso'))
  const enquantoBody = el('div', 'card-b')
  const actionList = el('div', 'action-list')

  const buildAction = (tag, icon, title, desc) => {
    const item = el(tag, 'action-item')
    const ico = el('div', 'ico')
    ico.innerHTML = icon
    const tx = el('div')
    tx.append(el('strong', null, title), el('span', null, desc))
    item.append(ico, tx)
    return item
  }

  const perfilAction = buildAction('button', '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>', 'Revise o perfil enviado', 'Veja se as preferências e dificuldades estão corretas.')
  perfilAction.type = 'button'
  perfilAction.addEventListener('click', () => switchTab('child'))

  const libAction = buildAction('button', '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', 'Conheça a biblioteca', 'Entenda exemplos de atividades usadas no Cognita.')
  libAction.type = 'button'
  libAction.addEventListener('click', () => switchTab('activities'))

  const teamAction = buildAction('button', '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>', 'Fale com a equipe', 'Tire dúvidas sobre o processo de análise.')
  teamAction.type = 'button'
  teamAction.addEventListener('click', () => openSupportDrawer())

  actionList.append(perfilAction, libAction, teamAction)
  enquantoBody.append(actionList)
  enquanto.append(enquantoHead, enquantoBody)

  row.append(resumo, enquanto)
  return row
}

// ── Ciclo ativo: tutor + atividade sugerida (fica na aba Início) ─────────────

function renderTutorAndActivityRow() {
  const row = el('div', 'row')

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
  const note = MOCK.cycle.tutor.presentation
    ? `"${MOCK.cycle.tutor.presentation}" — contato é sempre mediado pela equipe Cognita.`
    : 'Contato é sempre mediado pela equipe Cognita.'
  tutorBody.append(el('div', 'tutor-note', note))
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
  const openLib = el('button', 'btn btn-ghost btn-sm', 'Ver em Atividades')
  openLib.type = 'button'
  openLib.addEventListener('click', () => switchTab('activities'))
  actions.append(openLib)
  activityBody.append(actions)
  activityCard.append(activityBody)

  row.append(tutorCard, activityCard)
  return row
}

function renderQuickLinksRow() {
  const card = el('div', 'card')
  const head = el('div', 'card-h')
  head.append(el('h3', null, 'Acompanhamento rápido'))
  card.append(head)
  const body = el('div', 'card-b')
  const list = el('div', 'action-list')

  const buildLink = (icon, title, desc, tab) => {
    const item = el('button', 'action-item')
    item.type = 'button'
    const ico = el('div', 'ico')
    ico.innerHTML = icon
    const tx = el('div')
    tx.append(el('strong', null, title), el('span', null, desc))
    item.append(ico, tx)
    item.addEventListener('click', () => switchTab(tab))
    return item
  }

  const lastSession = MOCK.cycle.sessions[0]
  list.append(
    buildLink('<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>', 'Ver sessões', lastSession ? `Última: ${formatDate(lastSession.date)}` : 'Nenhuma sessão ainda', 'sessions'),
    buildLink('<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>', 'Ver relatórios', 'Progresso mês a mês', 'reports'),
    buildLink('<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', 'Atividades para casa', 'Ideias curtas e seguras', 'activities'),
  )
  body.append(list)
  card.append(body)
  return card
}

// ── Painel: Início ─────────────────────────────────────────────────────────────

function renderHomePanel(state) {
  const wrap = el('div')
  wrap.append(renderGuardianHeader())
  wrap.append(renderStatusHero(state))

  if (SESSION_REPORT_STATES.includes(state)) {
    wrap.append(renderTutorAndActivityRow())
    wrap.append(renderQuickLinksRow())
  } else {
    wrap.append(renderPrematchRow())
  }

  return wrap
}

// ── Painel: Criança ────────────────────────────────────────────────────────────

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function renderChildAvatarPreview(size) {
  const wrap = el('div', 'avatar-circle')
  wrap.style.width = wrap.style.height = `${size}px`
  wrap.style.borderColor = MOCK.child.avatarColor
  const img = document.createElement('img')
  img.src = AVATAR_META[MOCK.child.avatarIcon].src
  img.alt = ''
  wrap.append(img)
  return wrap
}

function buildChildHero(state) {
  const copy = STATUS_COPY[state] ?? STATUS_COPY.waiting_review
  const hero = el('div', 'child-hero')
  hero.append(renderChildAvatarPreview(88))
  const tx = el('div')
  tx.append(
    el('h1', null, MOCK.child.name),
    el('p', 'meta', `${MOCK.child.age} anos · ${MOCK.child.schoolYear} · ${copy.label}`),
  )
  const chips = el('div', 'chips')
  chips.style.marginTop = '10px'
  MOCK.child.identityChips.forEach((text) => chips.append(el('span', 'chip', text)))
  tx.append(chips)
  hero.append(tx)
  return hero
}

function buildInfoCard(title, body, extraClass) {
  const card = el('div', extraClass ? `card ${extraClass}` : 'card')
  const headEl = el('div', 'card-h')
  headEl.append(el('h3', null, title))
  card.append(headEl)
  const bodyEl = el('div', 'card-b')
  bodyEl.append(body)
  card.append(bodyEl)
  return card
}

function buildMiniList(items) {
  const list = el('ul', 'mini')
  items.forEach((item) => list.append(el('li', null, item)))
  return list
}

function buildFactChips(items) {
  const wrap = el('div', 'fact-chips')
  items.forEach((text) => wrap.append(el('span', 'fact-chip', text)))
  return wrap
}

function buildTraitList(items) {
  const list = el('div', 'trait-list')
  items.forEach(({ icon, text }) => {
    const row = el('div', 'trait-item')
    const ico = el('span', 'ico')
    ico.innerHTML = TRAIT_ICONS[icon] ?? TRAIT_ICONS.clock
    row.append(ico, document.createTextNode(text))
    list.append(row)
  })
  return list
}

function buildAvatarCard(onChange) {
  const childFirst = firstName(MOCK.child.name)
  const body = el('div', 'avatar-card-body')

  body.append(renderChildAvatarPreview(120))
  body.append(el('p', 'avatar-caption', `Escolha um avatar lúdico para representar ${childFirst} no Cognita.`))

  const options = el('div', 'avatar-options')
  Object.entries(AVATAR_META).forEach(([key, meta]) => {
    const btn = el('button', `avatar-option${key === MOCK.child.avatarIcon ? ' selected' : ''}`)
    btn.type = 'button'
    btn.title = meta.label
    btn.setAttribute('aria-label', meta.label)
    const img = document.createElement('img')
    img.src = meta.src
    img.alt = ''
    btn.append(img)
    btn.addEventListener('click', () => { MOCK.child.avatarIcon = key; onChange() })
    options.append(btn)
  })
  body.append(options)

  const colors = el('div', 'avatar-colors')
  AVATAR_COLORS.forEach((color) => {
    const dot = el('button', `avatar-color-dot${color === MOCK.child.avatarColor ? ' selected' : ''}`)
    dot.type = 'button'
    dot.style.background = color
    dot.style.color = color
    dot.setAttribute('aria-label', `Cor ${color}`)
    dot.addEventListener('click', () => { MOCK.child.avatarColor = color; onChange() })
    colors.append(dot)
  })
  body.append(colors)

  body.append(el('p', 'stub-note', 'Só visual por enquanto — o tutor vai ver o mesmo avatar em breve. Sem foto real da criança, de propósito.'))

  return buildInfoCard(`Avatar de ${childFirst}`, body)
}

function renderChildPanel(state) {
  const wrap = el('div')
  const heroWrap = el('div')
  const gridWrap = el('div', 'row')
  const bottomWrap = el('div')
  bottomWrap.style.marginTop = '16px'
  wrap.append(heroWrap, gridWrap, bottomWrap)

  function paint() {
    heroWrap.replaceChildren(buildChildHero(state))

    const lp = MOCK.child.learning

    const comoAprendeBody = el('div')
    comoAprendeBody.append(buildFactChips(MOCK.child.preferredFormats.map(cap)))
    const comoAprendeLine = el('p', 'card-copy', `${lp.formatoIdeal} · sessões de ${lp.duracaoIdeal}.`)
    comoAprendeLine.style.marginTop = '10px'
    comoAprendeBody.append(comoAprendeLine)

    const leftStack = el('div', 'stack')
    leftStack.append(
      buildInfoCard(`Como ${firstName(MOCK.child.name)} aprende melhor`, comoAprendeBody),
      buildInfoCard('O que ajuda', buildTraitList(lp.oQueAjuda)),
      buildInfoCard('O que pode dificultar', buildTraitList(lp.oQueDificulta), 'card--dificulta'),
    )

    const focoBody = el('div')
    const focoLine = el('p', 'card-copy', lp.focoAtual)
    focoLine.style.cssText = 'font-weight:700;color:var(--ink)'
    focoBody.append(focoLine)
    const focoChips = buildFactChips(lp.focoChips)
    focoChips.style.marginTop = '10px'
    focoBody.append(focoChips)
    focoBody.append(el('p', 'stub-note', 'Esse é o foco principal do início do acompanhamento.'))

    const rightStack = el('div', 'stack')
    rightStack.append(
      buildInfoCard('Foco atual', focoBody, 'card--focus'),
      buildAvatarCard(paint),
    )

    gridWrap.replaceChildren(leftStack, rightStack)

    const infoBody = el('div')
    const kv = el('dl', 'kv')
    kv.append(
      el('dt', null, 'Idade'), el('dd', null, `${MOCK.child.age} anos`),
      el('dt', null, 'Ano escolar'), el('dd', null, MOCK.child.schoolYear),
      el('dt', null, 'Dificuldades observadas'), el('dd', null, MOCK.child.mainDifficulties.join(', ')),
      el('dt', null, 'Aprende melhor com'), el('dd', null, MOCK.child.preferredFormats.join(', ')),
    )
    infoBody.append(kv)
    const reviewBtn = el('button', 'btn btn-ghost btn-sm', 'Revisar informações')
    reviewBtn.type = 'button'
    reviewBtn.style.marginTop = '12px'
    infoBody.append(reviewBtn)

    bottomWrap.replaceChildren(buildInfoCard('Informações cadastradas', infoBody))
  }

  paint()
  return wrap
}

// ── Painel: Sessões (resumo para a família — nunca notas internas) ──────────

const BELL_ICON = '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'

// ── Gaveta lateral de detalhe da sessão ───────────────────────────────────────

function buildSessionDetailBody(session) {
  const frag = document.createDocumentFragment()
  const note = el('p', 'session-detail-note', session.howItWent)
  frag.append(note)

  // Nem toda sessão real tem os 6 campos (whatHelped/whatHindered ainda não
  // existem no schema) — só entra na lista o que existir de verdade.
  const kv = el('dl', 'kv')
  const addRow = (label, value) => {
    if (!value) return
    kv.append(el('dt', null, label), el('dd', null, value))
  }
  addRow('Atividade usada', session.activity)
  addRow('Foco / objetivo', session.focus)
  addRow('Duração', session.duration ? `${session.duration} min` : null)
  addRow('O que ajudou', session.whatHelped)
  addRow('O que dificultou', session.whatHindered)
  addRow('Próximo foco', session.nextStep)
  frag.append(kv)

  const flag = el('button', 'btn btn-ghost btn-sm', '⚑ Sinalizar essa sessão')
  flag.type = 'button'
  flag.style.marginTop = '4px'
  // TODO(wiring:fatia-sessoes): abrir fluxo real de sinalização quando o
  // Registro de Sessão tiver os 3 níveis (estruturado / resumo família / interno).
  frag.append(flag)

  return frag
}

function openSessionDrawer(session) {
  const body = document.querySelector('[data-session-body]')
  const drawer = document.querySelector('[data-session-drawer]')
  const backdrop = document.querySelector('[data-session-backdrop]')
  const title = document.querySelector('[data-session-drawer-title]')
  const kicker = document.querySelector('[data-session-drawer-kicker]')
  if (!body || !drawer || !backdrop) return
  if (kicker) kicker.textContent = formatDate(session.date) ?? 'Sessão'
  if (title) title.textContent = session.title
  body.replaceChildren(buildSessionDetailBody(session))
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

function closeSessionDrawer() {
  document.querySelector('[data-session-drawer]')?.classList.remove('open')
  document.querySelector('[data-session-backdrop]')?.classList.remove('open')
  document.querySelector('[data-session-drawer]')?.setAttribute('aria-hidden', 'true')
}

document.querySelector('[data-session-close]')?.addEventListener('click', closeSessionDrawer)
document.querySelector('[data-session-backdrop]')?.addEventListener('click', closeSessionDrawer)

// ── Cards de sessão (clicáveis, abrem a gaveta de detalhe) ───────────────────

function renderSessionCard(session) {
  const item = el('button', 'session-card')
  item.type = 'button'

  const scHead = el('div', 'sc-head')
  scHead.append(el('span', 'sc-date', formatDate(session.date) ?? '—'))
  if (session.duration) scHead.append(el('span', 'sc-date', `${session.duration} min`))
  item.append(scHead)

  item.append(el('div', 'sc-title', session.title))
  item.append(el('p', 'sc-summary', session.howItWent))

  const facts = el('div', 'sc-facts')
  facts.append(el('span', null, session.activity), el('span', null, session.focus))
  item.append(facts)

  const foot = el('div', 'sc-foot')
  foot.append(el('span', 'sc-link', 'Ver detalhes →'))
  item.append(foot)

  item.addEventListener('click', () => openSessionDrawer(session))
  return item
}

// ── Sem sessão ainda (a tela precisa acolher, não só avisar "vazio") ─────────

function renderSessionsEmptyState(state) {
  const wrap = el('div')
  const copy = STATUS_COPY[state] ?? STATUS_COPY.waiting_review

  if (copy.timelineIndex != null) {
    // Estado B: já existe um lugar na fila (cadastro em análise → tutor
    // encontrado) — o vazio tem um motivo claro, mostra a timeline.
    const card = el('div', 'card')
    const body = el('div', 'card-b')
    const title = el('p', 'card-copy', 'Acompanhamento ainda não começou')
    title.style.cssText = 'font-weight:700;color:var(--ink);font-size:.94rem'
    const desc = el('p', 'card-copy', `A equipe ainda está organizando o início do ciclo de ${firstName(MOCK.child.name)}.`)
    desc.style.marginTop = '4px'
    body.append(title, desc, renderTimeline(copy.timelineIndex))
    card.append(body)
    wrap.append(card)
  } else {
    const card = el('div', 'card')
    const body = el('div', 'card-b')
    const empty = el('div', 'empty-state')
    empty.append(
      el('strong', null, 'Ainda não há sessões registradas.'),
      el('span', null, 'As sessões aparecerão aqui quando o acompanhamento começar.'),
    )
    body.append(empty)
    card.append(body)
    wrap.append(card)
  }

  const row = el('div', 'row')
  row.style.marginTop = '16px'

  const whatShowsUp = el('div', 'card')
  const whatHead = el('div', 'card-h')
  whatHead.append(el('h3', null, 'O que aparece aqui'))
  whatShowsUp.append(whatHead)
  const whatBody = el('div', 'card-b')
  whatBody.append(buildMiniList(['Resumo de cada sessão', 'Atividades usadas', 'Próximos passos combinados com o tutor']))
  whatShowsUp.append(whatBody)

  const meanwhile = el('div', 'card')
  const meanwhileHead = el('div', 'card-h')
  meanwhileHead.append(el('h3', null, 'Enquanto isso'))
  meanwhile.append(meanwhileHead)
  const meanwhileBody = el('div', 'card-b')
  const actionList = el('div', 'action-list')

  const buildAction = (icon, title, desc, onClick) => {
    const btn = el('button', 'action-item')
    btn.type = 'button'
    const ico = el('div', 'ico')
    ico.innerHTML = icon
    const tx = el('div')
    tx.append(el('strong', null, title), el('span', null, desc))
    btn.append(ico, tx)
    btn.addEventListener('click', onClick)
    return btn
  }

  actionList.append(
    buildAction('<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>', 'Revisar o perfil da criança', 'Confira se as informações enviadas estão corretas.', () => switchTab('child')),
    buildAction('<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', 'Conhecer a biblioteca de atividades', 'Veja exemplos do que é usado no Cognita.', () => switchTab('activities')),
  )
  meanwhileBody.append(actionList)
  meanwhile.append(meanwhileBody)

  row.append(whatShowsUp, meanwhile)
  wrap.append(row)

  return wrap
}

// ── Ciclo ativo: resumo + próxima atualização + lista de sessões ────────────

function renderSessionsStatRow() {
  const sessions = MOCK.cycle.sessions
  const row = el('div', 'stat-row')

  const addStat = (label, value) => {
    const card = el('div', 'card stat-card')
    card.append(el('div', 'lbl', label), el('div', 'val', value))
    row.append(card)
  }

  addStat('Sessões registradas', String(sessions.length))
  addStat('Última atividade', sessions[0]?.activity ?? '—')
  addStat('Foco atual', MOCK.child.learning.focoChips[0] ?? MOCK.cycle.mainGoal)
  addStat('Tutor', MOCK.cycle.tutor.name)

  return row
}

function renderUpdateBar() {
  const sessions = MOCK.cycle.sessions
  const bar = el('div', 'update-bar')
  const ico = el('div', 'ico')
  ico.innerHTML = BELL_ICON
  const tx = el('div', 'tx')
  tx.append(
    el('b', null, sessions[0] ? `Última sessão em ${formatDate(sessions[0].date)}` : 'Nenhuma sessão ainda'),
    el('span', null, 'Próxima atualização: quando o tutor registrar uma nova sessão.'),
  )
  bar.append(ico, tx)
  bar.append(el('span', 'meta', `Ciclo: mês ${MOCK.cycle.currentMonth} de ${MOCK.cycle.totalMonths}`))
  return bar
}

function renderNextStepsCard() {
  const card = el('div', 'card')
  const head = el('div', 'card-h')
  head.append(el('h3', null, 'Próximo passo'))
  card.append(head)
  const body = el('div', 'card-b')
  body.append(buildMiniList(MOCK.cycle.nextStepTips))
  card.append(body)
  return card
}

function renderSessionsPanel(state) {
  const wrap = el('div')

  const head = el('header', 'section-head')
  head.append(
    el('h1', null, `Sessões de ${firstName(MOCK.child.name)}`),
    el('p', null, 'Acompanhe aqui o que foi trabalhado em cada encontro.'),
  )
  wrap.append(head)

  if (!SESSION_REPORT_STATES.includes(state)) {
    wrap.append(renderSessionsEmptyState(state))
    return wrap
  }

  const sessions = MOCK.cycle.sessions
  wrap.append(renderSessionsStatRow())
  wrap.append(renderUpdateBar())

  const list = el('div', 'session-list')
  if (!sessions.length) {
    const card = el('div', 'card')
    const body = el('div', 'card-b')
    const empty = el('div', 'empty-state')
    empty.append(
      el('strong', null, 'Nenhuma sessão registrada ainda.'),
      el('span', null, 'Assim que o tutor registrar a primeira sessão, o resumo aparece aqui.'),
    )
    body.append(empty)
    card.append(body)
    list.append(card)
  } else {
    sessions.forEach((session) => list.append(renderSessionCard(session)))
  }
  wrap.append(list)

  if (sessions.length) {
    const spacer = el('div')
    spacer.style.marginTop = '16px'
    spacer.append(renderNextStepsCard())
    wrap.append(spacer)
  }

  return wrap
}

// ── Painel: Relatórios — evolução observável, nunca boletim/laudo ───────────

function renderReportSkillBars(skills) {
  const wrap = el('div', 'skill-bars')
  skills.forEach((skill) => {
    const row = el('div', 'skill-bar-item')
    const head = el('div', 'sb-head')
    head.append(el('span', 'sb-label', skill.label), el('span', 'sb-status', skill.status))
    row.append(head)
    const track = el('div', 'sb-track')
    const fill = el('div', 'sb-fill')
    fill.style.width = `${skill.level}%`
    track.append(fill)
    row.append(track)
    wrap.append(row)
  })
  return wrap
}

function renderReportTimeline(timeline) {
  const wrap = el('div', 'week-timeline')
  timeline.forEach((entry, index) => {
    const item = el('div', 'week-item')
    item.append(el('div', 'week-dot', String(index + 1)))
    const tx = el('div')
    tx.append(el('b', null, entry.week), el('p', null, entry.text))
    item.append(tx)
    wrap.append(item)
  })
  return wrap
}

function renderSupportBars(supports) {
  const max = Math.max(...supports.map((support) => support.count))
  const wrap = el('div', 'support-bars')
  supports.forEach((support) => {
    const row = el('div', 'support-bar-item')
    row.append(el('span', 'sup-label', support.label))
    const track = el('div', 'sup-track')
    const fill = el('div', 'sup-fill')
    fill.style.width = `${(support.count / max) * 100}%`
    track.append(fill)
    row.append(track)
    row.append(el('span', 'sup-count', support.count === 1 ? '1 uso' : `${support.count} usos`))
    wrap.append(row)
  })
  return wrap
}

function buildReportAvailable(report) {
  const wrap = el('div')

  const summaryCard = buildInfoCard(`Resumo de ${report.monthLabel}`, el('p', 'card-copy', report.summary), 'card--focus')
  wrap.append(summaryCard)

  const stats = el('div', 'stat-row')
  stats.style.marginTop = '16px'
  const addStat = (label, value) => {
    const statCard = el('div', 'card stat-card')
    statCard.append(el('div', 'lbl', label), el('div', 'val', value))
    stats.append(statCard)
  }
  addStat('Sessões realizadas', String(report.sessionsCount))
  addStat('Foco principal', report.mainFocus)
  addStat('Melhor resposta', report.bestSupport)
  addStat('Próximo foco', report.nextFocus)
  wrap.append(stats)

  const row = el('div', 'row')
  row.style.marginTop = '16px'

  const leftStack = el('div', 'stack')
  leftStack.append(
    buildInfoCard('Progresso por habilidade', renderReportSkillBars(report.skills)),
    buildInfoCard('Linha do tempo do mês', renderReportTimeline(report.timeline)),
  )

  const rightStack = el('div', 'stack')
  rightStack.append(
    buildInfoCard('O que avançou', buildMiniList(report.advances)),
    buildInfoCard('O que ajudou', renderSupportBars(report.supports)),
    buildInfoCard('O que ainda precisa de apoio', buildMiniList(report.attention), 'card--dificulta'),
  )

  row.append(leftStack, rightStack)
  wrap.append(row)

  const tipsCard = buildInfoCard('Como apoiar em casa', buildMiniList(report.homeTips), 'card--home-tips')
  tipsCard.style.marginTop = '16px'
  wrap.append(tipsCard)

  return wrap
}

function buildReportPreparing() {
  const card = el('div', 'card')
  const body = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  empty.append(
    el('strong', null, 'Relatório em preparação'),
    el('span', null, 'A equipe está revisando as sessões do mês para gerar um resumo seguro e claro para a família.'),
  )
  body.append(empty)
  card.append(body)
  return card
}

function buildReportsEmpty() {
  const card = el('div', 'card')
  const body = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  empty.append(
    el('strong', null, 'Nenhum relatório ainda.'),
    el('span', null, 'O primeiro relatório aparece ao final do primeiro mês de ciclo. Enquanto isso, acompanhe as sessões registradas.'),
  )
  body.append(empty)

  const actions = el('div', 'hero-actions')
  actions.style.justifyContent = 'center'
  const seeSessions = el('button', 'btn btn-ghost btn-sm', 'Ver sessões')
  seeSessions.type = 'button'
  seeSessions.addEventListener('click', () => switchTab('sessions'))
  const seeChild = el('button', 'btn btn-ghost btn-sm', 'Ver perfil da criança')
  seeChild.type = 'button'
  seeChild.addEventListener('click', () => switchTab('child'))
  actions.append(seeSessions, seeChild)
  body.append(actions)

  card.append(body)
  return card
}

// Guarda a seleção entre repaints da própria aba (não persiste entre reloads).
let selectedReportMonth = null

function renderMonthPicker(reports, onSelect) {
  const wrap = el('div', 'month-picker')
  reports.forEach((report) => {
    const btn = el('button', `month-pill${report.month === selectedReportMonth ? ' active' : ''}`, `Mês ${report.month}`)
    btn.type = 'button'
    btn.addEventListener('click', () => onSelect(report.month))
    wrap.append(btn)
  })
  return wrap
}

function renderReportsPanel(state) {
  const wrap = el('div')
  const reports = SESSION_REPORT_STATES.includes(state) ? MOCK.cycle.reports : []
  const childFirst = firstName(MOCK.child.name)

  if (!reports.length) {
    const head = el('header', 'section-head')
    head.append(
      el('h1', null, `Relatórios de ${childFirst}`),
      el('p', null, `Acompanhe, de forma simples, como ${childFirst} está evoluindo.`),
    )
    wrap.append(head, buildReportsEmpty())
    return wrap
  }

  if (selectedReportMonth == null || !reports.some((report) => report.month === selectedReportMonth)) {
    const available = reports.filter((report) => report.status === 'available')
    selectedReportMonth = (available[available.length - 1] ?? reports[reports.length - 1]).month
  }

  const headWrap = el('div')
  const bodyWrap = el('div')
  wrap.append(headWrap, bodyWrap)

  function paint() {
    const head = el('header', 'section-head')
    const headRow = el('div', 'section-head-row')
    const tx = el('div')
    tx.append(
      el('h1', null, `Relatórios de ${childFirst}`),
      el('p', null, `Acompanhe, de forma simples, como ${childFirst} está evoluindo nas atividades de matemática.`),
    )
    headRow.append(tx, renderMonthPicker(reports, (month) => { selectedReportMonth = month; paint() }))
    head.append(headRow)
    headWrap.replaceChildren(head)

    const current = reports.find((report) => report.month === selectedReportMonth)
    bodyWrap.replaceChildren(
      current.status === 'available' ? buildReportAvailable(current) : buildReportPreparing(current),
    )
  }

  paint()
  return wrap
}

// ── Painel: Atividades (versão simplificada para a família) ─────────────────

function renderActivityCard(activity) {
  const card = el('div', 'card')
  const body = el('div', 'card-b')

  const icon = el('div', `activity-icon tone-${activity.tone}`)
  icon.innerHTML = ACTIVITY_ICONS[activity.icon] ?? ACTIVITY_ICONS.contar
  body.append(icon)

  body.append(el('div', 'activity-title', activity.title))

  const facts = el('div', 'sg-facts')
  facts.style.marginTop = '8px'
  facts.append(el('span', null, activity.time), el('span', null, activity.tag))
  body.append(facts)

  const howBlock = el('div', 'activity-block')
  howBlock.append(el('div', 'lbl', 'Como fazer'), el('p', null, activity.how))
  body.append(howBlock)

  const care = el('div', 'activity-care')
  const careIco = document.createElement('span')
  careIco.innerHTML = CARE_ICON
  care.append(careIco, el('p', null, activity.careNote))
  body.append(care)

  card.append(body)
  return card
}

function renderActivitiesPanel() {
  const wrap = el('div')
  const childFirst = firstName(MOCK.child.name)

  const head = el('header', 'section-head')
  head.append(
    el('h1', null, `Atividades para ${childFirst}`),
    el('p', null, 'Ideias curtas e seguras para apoiar o acompanhamento em casa — a versão técnica, com passo a passo pedagógico, fica com o tutor.'),
  )
  wrap.append(head)

  const stats = el('div', 'stat-row')
  const addStat = (label, value) => {
    const statCard = el('div', 'card stat-card')
    statCard.append(el('div', 'lbl', label), el('div', 'val', value))
    stats.append(statCard)
  }
  const avgTime = Math.round(
    MOCK.familyActivities.reduce((sum, activity) => sum + parseInt(activity.time, 10), 0) / MOCK.familyActivities.length,
  )
  addStat('Atividades sugeridas', String(MOCK.familyActivities.length))
  addStat('Foco atual', MOCK.child.learning.focoChips.slice(0, 2).join(' · '))
  addStat('Tema preferido', MOCK.child.favoriteTheme)
  addStat('Duração média', `${avgTime} min`)
  wrap.append(stats)

  const grid = el('div', 'activity-grid')
  grid.style.marginTop = '16px'
  MOCK.familyActivities.forEach((activity) => grid.append(renderActivityCard(activity)))
  wrap.append(grid)

  return wrap
}

// ── Monta a página: 5 painéis, um visível por vez ─────────────────────────────

function buildPanel(name, content) {
  const panel = el('section', 'panel')
  panel.dataset.panel = name
  panel.append(content)
  return panel
}

function render(state) {
  const box = document.querySelector('[data-guardian-state]')
  if (!box) return

  box.replaceChildren(
    buildPanel('home', renderHomePanel(state)),
    buildPanel('child', renderChildPanel(state)),
    buildPanel('sessions', renderSessionsPanel(state)),
    buildPanel('reports', renderReportsPanel(state)),
    buildPanel('activities', renderActivitiesPanel(state)),
  )
  switchTab(activeTab)
}

// ── Estados sem conteúdo normal (sem sessão do Supabase, ou sem criança) ─────

function renderLoadError() {
  const box = document.querySelector('[data-guardian-state]')
  if (!box) return
  const panel = el('div', 'panel')
  const card = el('div', 'card')
  const body = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  empty.append(
    el('strong', null, 'Não foi possível carregar seus dados.'),
    el('span', null, 'Verifique sua conexão e atualize a página. Se o problema continuar, fale com a equipe Cognita.'),
  )
  body.append(empty)
  card.append(body)
  panel.append(card)
  box.replaceChildren(panel)
}

function renderNoChild() {
  const box = document.querySelector('[data-guardian-state]')
  if (!box) return
  const panel = el('div', 'panel')
  const head = el('header', 'family-head')
  head.append(
    el('p', 'kicker', 'Hoje'),
    el('h1', null, `Olá, ${MOCK.guardianName}.`),
  )
  panel.append(head)
  const card = el('div', 'card')
  const body = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  empty.append(
    el('strong', null, 'Nenhuma criança cadastrada ainda.'),
    el('span', null, 'Se você acabou de concluir o cadastro, atualize a página em alguns instantes. Qualquer dúvida, fale com a equipe Cognita.'),
  )
  body.append(empty)
  card.append(body)
  panel.append(card)
  box.replaceChildren(panel)
}

// ── Boot: autentica, busca dado real, deriva o estado, então renderiza ──────

async function boot() {
  const session = await requireRole('guardian')
  if (!session) return // requireRole já redirecionou pro login

  MOCK.guardianName = session.profile.name || MOCK.guardianName
  MOCK.guardianEmail = session.user.email || MOCK.guardianEmail
  MOCK.guardianPhone = session.profile.phone || MOCK.guardianPhone
  fillIdentity()

  const { data: children, error } = await getGuardianChildren(session.user.id)
  if (error) {
    renderLoadError()
    return
  }

  const child = children?.[0] ?? null
  if (!child) {
    renderNoChild()
    return
  }

  applyRealChild(child)
  const cycle = pickCycle(child)
  if (cycle) applyRealCycle(cycle)

  const realState = deriveGuardianStatus(child, cycle)
  // A URL só decide quando ainda não existe ciclo real — serve pra revisar
  // os estados pós-match (matched/active/paused/completed) num cadastro de
  // teste que só chegou até "aguardando tutor". Com ciclo real, ela é ignorada.
  const state = (!cycle && estadoOverride) ? estadoOverride : realState

  render(state)
}

boot()
