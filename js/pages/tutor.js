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
  if (diffDays <= 30) return `ha ${diffDays} dias`
  return formatDate(value) ?? 'sem registro'
}

const SUGGESTED_ACTIVITY = {
  title: 'Blocos de contagem coloridos',
  skill: 'contagem ate 10',
  focus: 'contagem, adicao simples e comparacao de quantidades',
  time: '15-20 min',
  materials: 'blocos, tampinhas ou objetos pequenos',
  steps: [
    'Mostre 3 objetos.',
    'Peca para a crianca contar apontando.',
    'Aumente ate 10 aos poucos.',
    'Repita usando cores diferentes.',
  ],
  easier: 'Reduza para 5 objetos e conte junto.',
  harder: 'Peca para comparar dois grupos: qual tem mais?',
  nextStep: 'Repetir contagem ate 10 com apoio visual e comparar dois grupos pequenos.',
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

function makeSvg(path, extraAttrs = '') {
  const wrap = document.createElement('span')
  wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extraAttrs}>${path}</svg>`
  return wrap.firstElementChild
}

// ── Identidade ────────────────────────────────────────────────────────────────

function fillIdentity() {
  const name = session.profile.name || 'Tutor'
  const set = (sel, val) => { const n = document.querySelector(sel); if (n) n.textContent = val }
  set('[data-tutor-title]', greeting(name))
  set('[data-tutor-name]', name)
  set('[data-account-name]', name)
  set('[data-account-email]', session.user.email ?? '')
  set('[data-account-avatar]', initials(name))
}

// ── Topbar ────────────────────────────────────────────────────────────────────

function updateTopbarBtn(state) {
  const btn = document.querySelector('[data-open-session]')
  if (!btn) return

  const CONFIG = {
    cycle_active:    { enabled: true,  text: 'Registrar sessão' },
    cycle_planned:   { enabled: false, text: 'Ciclo não iniciado' },
    cycle_paused:    { enabled: false, text: 'Ciclo pausado' },
    cycle_completed: { enabled: false, text: 'Ver histórico' },
  }

  const cfg = CONFIG[state]
  if (!cfg) { btn.hidden = true; return }

  btn.hidden = false
  btn.disabled = !cfg.enabled
  const span = btn.querySelector('span')
  if (span) span.textContent = cfg.text
}

function wireOpenSessionBtn() {
  document.querySelectorAll('[data-open-session]').forEach((btn) => {
    if (btn.dataset.wired) return
    btn.dataset.wired = '1'
    btn.addEventListener('click', () => {
      const form = document.querySelector('.tp-session-form')
      if (!form) return
      form.open = true
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })
}

// ── Status strip ──────────────────────────────────────────────────────────────

function renderStatusStrip(state, cycle) {
  const stripEl = document.querySelector('[data-tp-strip]')
  if (!stripEl) return

  const childName = cycle?.children?.name
  const CONFIG = {
    loading:             { dot: 'info',    label: 'Carregando…',              detail: null },
    error:               { dot: 'bad',     label: 'Erro ao carregar',         detail: 'Verifique sua conexão.' },
    pending:             { dot: 'pending', label: 'Candidatura em análise',   detail: 'A equipe Cognita vai revisar seu perfil e disponibilidade.' },
    orientation_pending: { dot: 'pending', label: 'Orientação pendente',      detail: 'Conclua a orientação inicial antes do pareamento.' },
    available:           { dot: 'ok',      label: 'Pronto para acompanhar',   detail: 'Aguardando pareamento da equipe Cognita.' },
    cycle_planned:       { dot: 'info',    label: 'Ciclo planejado',          detail: childName ? `Com ${childName} — aguardando ativação.` : 'Aguardando ativação do ciclo.' },
    cycle_active:        { dot: 'ok',      label: 'Ciclo ativo',              detail: 'Registre a sessão desta semana.' },
    cycle_paused:        { dot: 'pending', label: 'Ciclo pausado',            detail: 'Registros bloqueados — aguarde orientação da equipe.' },
    cycle_completed:     { dot: 'ok',      label: 'Acompanhamento concluído', detail: 'Ciclo de 6 meses finalizado.' },
  }

  const cfg = CONFIG[state] ?? CONFIG.error
  const dot = el('span', `tp-strip-dot tp-strip-dot--${cfg.dot}`)
  dot.setAttribute('aria-hidden', 'true')

  const text = document.createElement('span')
  if (cfg.detail) {
    text.append(el('strong', null, cfg.label), document.createTextNode(` — ${cfg.detail}`))
  } else {
    text.append(el('strong', null, cfg.label))
  }

  stripEl.replaceChildren(dot, text)
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar(state, cycle) {
  const sidebarEl = document.querySelector('[data-tutor-sidebar]')
  if (!sidebarEl) return

  const name = session.profile.name || 'Tutor'
  const frag = document.createDocumentFragment()

  // Seção do tutor
  const tutorRow = el('div', 'tp-sb-tutor')
  const avatar = el('div', 'tp-sb-avatar', initials(name))

  const tutorInfo = el('div')
  tutorInfo.append(el('div', 'tp-sb-name', name))
  tutorInfo.append(el('div', 'tp-sb-role', 'Tutor voluntário'))

  const chipMap = {
    pending:             { cls: 'warn', label: 'Em análise' },
    orientation_pending: { cls: 'warn', label: 'Orientação pendente' },
    available:           { cls: 'ok',   label: 'Aprovado' },
    cycle_planned:       { cls: 'info', label: 'Ciclo planejado' },
    cycle_active:        { cls: 'ok',   label: 'Ciclo ativo' },
    cycle_paused:        { cls: 'warn', label: 'Ciclo pausado' },
    cycle_completed:     { cls: 'info', label: 'Ciclo concluído' },
  }
  const chipCfg = chipMap[state] ?? chipMap.available
  const chip = el('span', `tp-sb-chip tp-sb-chip--${chipCfg.cls}`)
  chip.append(el('i'), document.createTextNode(chipCfg.label))
  tutorInfo.append(chip)

  tutorRow.append(avatar, tutorInfo)
  frag.append(tutorRow)

  frag.append(el('div', 'tp-sb-divider'))

  if (cycle) {
    const child = cycle.children ?? {}
    const age = ageFrom(child.birth_date)
    const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
    const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)

    frag.append(el('div', 'tp-sb-section-label', 'Criança em acompanhamento'))
    frag.append(el('div', 'tp-sb-child-name', child.name ?? 'Criança'))

    const metaParts = []
    if (age != null)        metaParts.push(`${age} anos`)
    if (child.school_year) metaParts.push(child.school_year)
    if (metaParts.length)  frag.append(el('div', 'tp-sb-child-meta', metaParts.join(' · ')))

    // Widget de progresso do ciclo
    const widget = el('div', 'tp-cycle-widget')
    const row = el('div', 'tp-cycle-row')
    row.append(
      el('span', 'tp-cycle-month-num', String(currentMonth)),
      el('span', 'tp-cycle-month-of', `de ${totalMonths} meses`)
    )
    widget.append(row)

    const track = el('div', 'tp-cycle-track')
    for (let i = 1; i <= totalMonths; i++) {
      const cls = i < currentMonth ? 'tp-cycle-seg tp-cycle-seg--done'
                : i === currentMonth ? 'tp-cycle-seg tp-cycle-seg--active'
                : 'tp-cycle-seg'
      track.append(el('span', cls))
    }
    widget.append(track)
    widget.append(el('div', 'tp-cycle-stat', 'Mês atual do ciclo'))
    frag.append(widget)

    frag.append(el('div', 'tp-sb-divider'))

    const links = el('div', 'tp-sb-links')

    const profileLink = el('a', 'tp-sb-link')
    profileLink.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
    profileLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    profileLink.append(document.createTextNode('Ver perfil pedagógico'))
    links.append(profileLink)

    const libLink = el('a', 'tp-sb-link')
    libLink.href = 'atividades.html'
    libLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
    libLink.append(document.createTextNode('Biblioteca de atividades'))
    links.append(libLink)

    const reportsLink = el('a', 'tp-sb-link')
    reportsLink.href = '#monthly-report'
    reportsLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>`
    reportsLink.append(document.createTextNode('Relatórios mensais'))
    links.append(reportsLink)

    const teamLink = el('a', 'tp-sb-link')
    teamLink.href = '#team-support'
    teamLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`
    teamLink.append(document.createTextNode('Falar com equipe'))
    links.append(teamLink)

    frag.append(links)
  } else {
    const isWaiting = ['pending', 'orientation_pending'].includes(state)
    frag.append(el('p', 'tp-sb-empty', isWaiting
      ? 'Ainda sem criança vinculada. Aguardando validação e pareamento.'
      : 'Nenhuma criança vinculada. A equipe Cognita fará o pareamento em breve.'
    ))

    frag.append(el('div', 'tp-sb-divider'))

    const links = el('div', 'tp-sb-links')
    const libLink = el('a', 'tp-sb-link')
    libLink.href = 'atividades.html'
    libLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
    libLink.append(document.createTextNode('Biblioteca de atividades'))
    links.append(libLink)
    frag.append(links)
  }

  sidebarEl.replaceChildren(frag)
}

// ── Máquina de estados ────────────────────────────────────────────────────────

function deriveTutorState(profileStatus, cycles) {
  if (REVIEW_STATUSES.includes(profileStatus)) return { state: 'pending' }
  if (profileStatus === 'orientation_pending')  return { state: 'orientation_pending' } // TODO(wiring:profiles)

  if (!cycles?.length) return { state: 'available' }

  const active  = cycles.find((c)  => c.status === 'active')
  const planned = cycles.find((c)  => c.status === 'planned')
  const paused  = cycles.filter((c) => c.status === 'paused')
  const done    = cycles.filter((c) => c.status === 'completed')

  if (active)        return { state: 'cycle_active',    cycle: active }
  if (planned)       return { state: 'cycle_planned',   cycle: planned }
  if (paused.length) return { state: 'cycle_paused',    cycles: paused }
  if (done.length)   return { state: 'cycle_completed', cycles: done }
  return { state: 'available' }
}

// ── Estados sem ciclo ─────────────────────────────────────────────────────────

function renderPending() {
  const card = el('div', 'tp-status-card')
  const icon = el('div', 'tp-status-icon tp-status-icon--pending')
  icon.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`

  const body = el('div', 'tp-status-body')
  body.append(
    el('p', 'tp-status-kicker', 'Painel do tutor'),
    el('h1', 'tp-status-title', 'Candidatura em análise'),
    el('p', null, 'A equipe Cognita vai revisar seu perfil e disponibilidade antes de liberar os pareamentos com crianças.')
  )

  const steps = el('ol', 'tp-steps')
  ;[
    { label: 'Cadastro enviado',       desc: 'Suas informações foram recebidas.',                           state: 'done'   },
    { label: 'Revisão pela equipe',    desc: 'A equipe analisa formação e disponibilidade.',                state: 'active' },
    { label: 'Orientação inicial',     desc: 'Encontro introdutório com a equipe Cognita.',                 state: ''       },
    { label: 'Pareamento com criança', desc: 'Você recebe o perfil pedagógico e começa o acompanhamento.', state: ''       },
  ].forEach(({ label, desc, state }) => {
    const li = el('li', 'tp-step')
    const dot = el('div', `tp-step-dot${state ? ` tp-step-dot--${state}` : ''}`, state === 'done' ? '✓' : '')
    const copy = el('div', 'tp-step-copy')
    copy.append(el('strong', null, label), el('span', null, desc))
    li.append(dot, copy)
    steps.append(li)
  })

  body.append(steps)
  card.append(icon, body)
  return card
}

function renderOrientationPending() {
  const card = el('div', 'tp-status-card')
  const icon = el('div', 'tp-status-icon tp-status-icon--pending')
  icon.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`

  const body = el('div', 'tp-status-body')
  body.append(
    el('p', 'tp-status-kicker', 'Painel do tutor'),
    el('h1', 'tp-status-title', 'Orientação inicial pendente'),
    el('p', null, 'Antes do primeiro pareamento, a equipe Cognita realiza uma orientação introdutória. Conclua as etapas abaixo.')
  )

  const steps = el('div', 'tp-orient-steps')
  ;[
    { num: 1, label: 'Ler os compromissos do tutor',  desc: 'Leia e aceite o guia de atuação pedagógica inclusiva.' },
    { num: 2, label: 'Treinar a escrita de resumo',   desc: 'Pratique escrever resumos claros e respeitosos para os responsáveis.' },
    { num: 3, label: 'Confirmar com a equipe',        desc: 'Acuse recebimento da orientação com a equipe Cognita.' },
  ].forEach(({ num, label, desc }) => {
    const step = el('div', 'tp-orient-step')
    step.append(el('div', 'tp-orient-num', String(num)))
    const copy = el('div', 'tp-orient-copy')
    copy.append(el('strong', null, label), el('span', null, desc))
    step.append(copy)
    steps.append(step)
  })

  body.append(steps)
  card.append(icon, body)
  return card
}

function renderAvailable() {
  const card = el('div', 'tp-status-card')
  const icon = el('div', 'tp-status-icon tp-status-icon--ok')
  icon.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`

  const body = el('div', 'tp-status-body')
  body.append(
    el('p', 'tp-status-kicker', 'Painel do tutor'),
    el('h1', 'tp-status-title', 'Pronto para acompanhar'),
    el('p', null, 'Seu cadastro foi aprovado e a orientação inicial foi concluída. A equipe Cognita vai criar o pareamento quando houver compatibilidade de perfil e agenda.')
  )

  const libLink = el('a', 'tp-lib-link', 'Explorar biblioteca de atividades →')
  libLink.href = 'atividades.html'
  body.append(libLink)

  card.append(icon, body)
  return card
}

function renderCyclePlanned(cycle) {
  const child = cycle.children ?? {}
  const age = ageFrom(child.birth_date)

  const card = el('div', 'tp-status-card')
  const icon = el('div', 'tp-status-icon tp-status-icon--info')
  icon.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`

  const body = el('div', 'tp-status-body')
  const agePart = age != null ? `, ${age} anos` : ''
  body.append(
    el('p', 'tp-status-kicker', 'Pareamento criado'),
    el('h1', 'tp-status-title', `Ciclo planejado com ${child.name ?? 'criança'}${agePart}`),
    el('p', null, `Início em ${formatDate(cycle.start_date) ?? 'data a definir'}. Leia o perfil pedagógico antes da primeira sessão. A equipe vai ativar o ciclo em breve.`)
  )

  if (cycle.main_goal) {
    const goal = el('div')
    goal.style.cssText = 'margin-top:16px;padding:var(--s2);border-radius:var(--r-sm);background:rgba(20,17,98,.04);border-left:3px solid var(--brand);'
    goal.append(el('div', 'tp-plan-key', 'Meta do ciclo'), el('p', 'tp-plan-val', cycle.main_goal))
    body.append(goal)
  }

  const profileLink = el('a', 'tp-lib-link', 'Ver perfil pedagógico →')
  profileLink.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
  body.append(profileLink)

  card.append(icon, body)
  return card
}

function renderCyclePaused() {
  const banner = el('div', 'tp-paused-banner')
  banner.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  const div = el('div')
  div.append(
    el('strong', null, 'Ciclo pausado — registros bloqueados'),
    el('p', null, 'Não é possível registrar sessões enquanto o ciclo estiver pausado. Entre em contato com a equipe Cognita para saber os próximos passos.')
  )
  banner.append(div)
  return banner
}

function renderCycleCompleted() {
  const card = el('div', 'tp-status-card')
  const icon = el('div', 'tp-status-icon tp-status-icon--ok')
  icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`

  const body = el('div', 'tp-status-body')
  body.append(
    el('p', 'tp-status-kicker', 'Acompanhamento finalizado'),
    el('h1', 'tp-status-title', 'Ciclo concluído'),
    el('p', null, 'Obrigado pelo acompanhamento. O histórico de sessões está registrado e disponível para consulta a qualquer momento.')
  )
  card.append(icon, body)
  return card
}

function renderError(retry) {
  const card = el('div', 'tp-error-card')
  card.append(
    el('strong', null, 'Não foi possível carregar os dados'),
    el('p', null, 'Verifique sua conexão e tente de novo.')
  )
  const btn = el('button', 'tp-btn-retry', 'Tentar novamente')
  btn.type = 'button'
  btn.addEventListener('click', retry)
  card.append(btn)
  return card
}

// ── Sessões ───────────────────────────────────────────────────────────────────

function renderSessionCompact(record, index = 0) {
  const item = el('article', 'tp-session-item')
  item.append(el('span', 'tp-session-date', `Sessao ${String(index + 1).padStart(2, '0')} · ${formatDate(record.date) ?? '-'}`))
  item.append(el('p', 'tp-session-title', record.activity_title ?? record.topic ?? 'Sessao registrada'))

  const meta = el('div', 'tp-session-meta')
  if (record.focus_area) meta.append(el('span', null, `Foco: ${record.focus_area}`))
  if (record.duration_minutes) meta.append(el('span', null, `${record.duration_minutes} min`))
  if (meta.childElementCount) item.append(meta)

  if (record.notes) {
    const note = el('p', 'tp-session-note')
    note.textContent = `Resumo: ${truncateText(record.notes, 140)}`
    item.append(note)
  }

  if (record.next_step) {
    item.append(el('p', 'tp-session-note', `Proximo passo: ${truncateText(record.next_step, 120)}`))
  }

  // TODO(wiring:sessions): exibir record.visible_to_family quando o campo existir
  const tags = el('div', 'tp-session-tags')
  tags.append(
    el('span', 'tp-session-tag tp-session-tag--reg', 'Registrada'),
    el('span', 'tp-session-tag tp-session-tag--vis', 'Visivel para familia')
  )
  item.append(tags)
  return item
}

async function loadSessions(cycleId, container, compact = false, onLoaded = null) {
  container.replaceChildren(el('p', 'tp-empty', 'Carregando sessoes...'))
  const { data, error } = await getCycleSessions(cycleId)

  if (error) {
    container.replaceChildren(el('p', 'tp-empty', 'Nao foi possivel carregar as sessoes.'))
    onLoaded?.([])
    return []
  }

  const rows = data ?? []
  onLoaded?.(rows)

  if (!rows.length) {
    const empty = el('div', 'tp-empty')
    empty.append(
      el('strong', null, 'Nenhuma sessao registrada ainda.'),
      document.createTextNode(' Depois da primeira atividade, o historico aparecera aqui.')
    )
    container.replaceChildren(empty)
    return rows
  }

  const list = el('div', 'tp-session-list')
  const source = compact ? rows.slice(0, 4) : rows
  source.forEach((r, index) => list.append(renderSessionCompact(r, index)))
  container.replaceChildren(list)
  return rows
}

// ── Escalas de botões ─────────────────────────────────────────────────────────

function makeScaleGroup(options) {
  const group = el('div', 'tp-scale')
  group.setAttribute('role', 'radiogroup')
  let value = ''
  const buttons = []

  options.forEach(({ label, val, tone }) => {
    const cls = ['tp-scale-btn', tone ? `tp-scale-btn--${tone}` : ''].filter(Boolean).join(' ')
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
  const details = el('details', 'tp-session-form')
  const childName = firstName(cycle.children?.name)

  const summary = document.createElement('summary')
  summary.textContent = 'Registrar sessão desta semana'
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  chevron.setAttribute('viewBox', '0 0 24 24')
  chevron.setAttribute('aria-hidden', 'true')
  chevron.innerHTML = '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  summary.append(chevron)
  details.append(summary)

  const body = el('div', 'tp-form-body')

  // Nível 1: Dados estruturados
  body.append(el('div', 'tp-form-section-title', '1. Dados estruturados'))

  const row1 = el('div', 'tp-form-row')

  const dateField = el('div', 'tp-field')
  const dateLabel = document.createElement('label')
  dateLabel.textContent = 'Data da sessão'
  const dateInput = document.createElement('input')
  dateInput.type = 'date'; dateInput.value = todayISO(); dateInput.required = true
  dateLabel.append(dateInput); dateField.append(dateLabel)

  const durField = el('div', 'tp-field')
  const durLabel = document.createElement('label')
  durLabel.textContent = 'Duração (minutos)'
  const durInput = document.createElement('input')
  durInput.type = 'number'; durInput.min = '0'; durInput.placeholder = 'Ex.: 45'
  durLabel.append(durInput); durField.append(durLabel)

  row1.append(dateField, durField)
  body.append(row1)

  const actField = el('div', 'tp-field')
  const actLabel = document.createElement('label')
  actLabel.textContent = 'Atividade realizada *'
  const actInput = document.createElement('input')
  actInput.type = 'text'; actInput.required = true
  actInput.placeholder = 'Ex.: Soma com apoio visual — blocos de cores'
  actLabel.append(actInput); actField.append(actLabel)
  body.append(actField)

  const focusField = el('div', 'tp-field')
  const focusLabel = document.createElement('label')
  focusLabel.textContent = 'Foco trabalhado'
  const focusInput = document.createElement('input')
  focusInput.type = 'text'; focusInput.placeholder = 'Ex.: Contagem e correspondência 1-a-1'
  focusLabel.append(focusInput); focusField.append(focusLabel)
  body.append(focusField)

  const scaleRow = el('div', 'tp-form-row-3')

  const engField = el('div', 'tp-field')
  engField.append(el('label', null, 'Engajamento'))
  const eng = makeScaleGroup([
    { label: 'Baixo',   val: '1', tone: 'bad'  },
    { label: 'Médio',   val: '3', tone: 'warn' },
    { label: 'Alto',    val: '5', tone: 'ok'   },
    { label: 'Oscilou', val: '2', tone: ''      },
  ])
  engField.append(eng.group)

  const diffField = el('div', 'tp-field')
  diffField.append(el('label', null, 'Dificuldade percebida'))
  const diff = makeScaleGroup([
    { label: 'Baixa',            val: '1', tone: 'ok'   },
    { label: 'Média',            val: '3', tone: 'warn' },
    { label: 'Alta',             val: '5', tone: 'bad'  },
    { label: 'Não foi possível', val: '0', tone: ''     },
  ])
  diffField.append(diff.group)

  const resultField = el('div', 'tp-field')
  resultField.append(el('label', null, 'Resultado'))
  const result = makeScaleGroup([
    { label: 'Avançou',          val: 'improved',     tone: 'ok'  },
    { label: 'Manteve',          val: 'stable',        tone: ''    },
    { label: 'Teve dificuldade', val: 'struggled',     tone: 'bad' },
    { label: 'Não foi possível', val: 'not_completed', tone: ''    },
  ])
  resultField.append(result.group)

  scaleRow.append(engField, diffField, resultField)
  body.append(scaleRow)

  const nextField = el('div', 'tp-field')
  const nextLabel = document.createElement('label')
  nextLabel.textContent = 'Próximo passo'
  const nextInput = document.createElement('textarea')
  nextInput.placeholder = 'O que trabalhar na próxima sessão?'
  nextLabel.append(nextInput); nextField.append(nextLabel)
  body.append(nextField)

  // Nível 2: Resumo para a família
  body.append(el('div', 'tp-form-section-title', '2. Resumo para a família'))

  const guide = el('div', 'tp-family-guide')
  guide.innerHTML = `<strong>O que você escrever aqui aparece para o responsável.</strong>
    Descreva comportamentos observáveis — o que funcionou, o que foi difícil — em linguagem simples e respeitosa.
    <em>Exemplo: "Ana participou com entusiasmo dos blocos de cores. Teve dificuldade com sequências acima de 3 elementos, mas conseguiu com apoio visual. Focaremos nisso na próxima sessão."</em>`
  body.append(guide)

  const familyField = el('div', 'tp-field')
  const familyLabel = document.createElement('label')
  familyLabel.textContent = 'Resumo para a família *'
  const familyInput = document.createElement('textarea')
  familyInput.placeholder = 'Descreva o que aconteceu na sessão...'
  familyInput.required = true; familyInput.maxLength = 800
  familyLabel.append(familyInput); familyField.append(familyLabel)

  const charCount = el('div', 'tp-char-count', '0 / 800 caracteres')
  familyInput.addEventListener('input', () => { charCount.textContent = `${familyInput.value.length} / 800 caracteres` })
  familyField.append(charCount)
  body.append(familyField)

  const familyPreview = el('div', 'tp-family-preview')
  const previewLabel = el('div', 'tp-family-preview-label', 'Como a família verá')
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
      `${childName} participou da atividade${activity ? ` "${activity}"` : ''}${focus ? ` com foco em ${focus}` : ''}. Escreva aqui o que funcionou, o que ficou dificil e qual apoio ajudou.`
    previewNext.textContent = `Próximo passo: ${next || SUGGESTED_ACTIVITY.nextStep}`
  }

  ;[actInput, focusInput, familyInput, nextInput].forEach((input) => {
    input.addEventListener('input', updateFamilyPreview)
  })
  updateFamilyPreview()
  body.append(familyPreview)

  const checklistTitle = el('p')
  checklistTitle.style.cssText = 'font-size:.79rem;font-weight:700;color:var(--ink-soft);margin-bottom:8px;'
  checklistTitle.textContent = 'Antes de salvar, confirme:'

  const CHECKS = [
    { id: 'chk-obs',  label: 'Descrevi comportamentos observáveis (não interpretações ou rótulos)' },
    { id: 'chk-what', label: 'Expliquei o que funcionou ou não funcionou' },
    { id: 'chk-next', label: 'Indiquei um próximo passo claro' },
    { id: 'chk-lang', label: 'Usei linguagem simples, respeitosa e educacional' },
  ]
  const checklist = el('ul', 'tp-checklist')
  CHECKS.forEach(({ id, label }) => {
    const li = el('li')
    const cb = document.createElement('input')
    cb.type = 'checkbox'; cb.id = id
    const lbl = document.createElement('label')
    lbl.htmlFor = id; lbl.textContent = label
    li.append(cb, lbl); checklist.append(li)
  })
  body.append(checklistTitle, checklist)

  // Nível 3: Nota interna
  body.append(el('div', 'tp-form-section-title', '3. Nota interna (só você e a equipe veem)'))

  const internalWrap = el('div', 'tp-internal-wrap')
  const internalLabel = el('div', 'tp-internal-label')
  internalLabel.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
  internalLabel.append(document.createTextNode('A família nunca tem acesso a esta nota'))
  const internalInput = document.createElement('textarea')
  internalInput.placeholder = 'Dúvidas técnicas, pontos para revisar com a equipe, observações confidenciais…'
  internalWrap.append(internalLabel, internalInput)
  body.append(internalWrap)

  // Ações
  const errorBox = el('p', 'tp-form-error'); errorBox.hidden = true
  const okBox    = el('p', 'tp-form-ok');    okBox.hidden = true
  const saveBtn  = el('button', 'tp-btn-save', 'Salvar registro')
  saveBtn.type   = 'button'

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
      cycleId:         cycle.id,
      sessionDate:     dateInput.value || todayISO(),
      durationMinutes: durInput.value ? Number(durInput.value) : null,
      activityTitle:   actTitle,
      focusArea:       focusInput.value.trim(),
      notes:           familySummary,
      nextStep:        nextInput.value.trim(),
    })

    saveBtn.disabled = false; saveBtn.textContent = 'Salvar registro'

    if (error) {
      errorBox.textContent = 'Não foi possível salvar. Tente de novo.'; errorBox.hidden = false; return
    }

    ;[actInput, focusInput, familyInput, nextInput, internalInput].forEach((i) => { i.value = '' })
    durInput.value = ''; dateInput.value = todayISO()
    charCount.textContent = '0 / 800 caracteres'
    CHECKS.forEach(({ id }) => { const cb = document.getElementById(id); if (cb) cb.checked = false })
    eng.reset(); diff.reset(); result.reset()
    updateFamilyPreview()

    okBox.textContent = 'Sessão registrada com sucesso.'; okBox.hidden = false
    details.open = false
    await onSaved()
  })

  const actions = el('div', 'tp-form-actions')
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

// ── Blocos do workspace (ciclo ativo) ─────────────────────────────────────────

function renderActionBlock(cycle, onRegister) {
  const child = cycle.children ?? {}
  const lp    = child.learning_profiles ?? {}
  const name  = firstName(child.name)

  const block = el('div', 'tp-block tp-block--action')
  block.append(el('div', 'tp-block-label', 'Sessão desta semana'))
  block.append(el('h1', 'tp-block-title', `Com ${name}`))

  const hasInfo = cycle.main_goal || lp.math_difficulties?.length || child.main_difficulties?.length
  if (hasInfo) {
    const info = el('div', 'tp-next-info')
    if (cycle.main_goal) {
      const row = el('div', 'tp-next-row')
      row.append(el('strong', null, 'Meta:'), el('span', null, cycle.main_goal))
      info.append(row)
    }
    const difficulties = lp.math_difficulties ?? child.main_difficulties
    if (difficulties?.length) {
      const row = el('div', 'tp-next-row')
      const txt = Array.isArray(difficulties) ? difficulties.join(', ') : difficulties
      row.append(el('strong', null, 'Foco:'), el('span', null, txt))
      info.append(row)
    }
    // TODO(wiring:support_cycles): exibir atividade da semana quando current_activity_id existir
    block.append(info)
  } else {
    block.append(el('p', 'tp-next-empty', 'Consulte o perfil pedagógico e a biblioteca para escolher a atividade desta semana.'))
  }

  const btn = el('button', 'tp-btn-register')
  btn.type = 'button'
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  btn.append(document.createTextNode('Registrar sessão'))
  btn.addEventListener('click', onRegister)
  block.append(btn)

  return block
}

function renderPlanBlock(cycle) {
  const block = el('div', 'tp-block')
  block.append(el('div', 'tp-block-label', 'Plano da semana'))

  const entries = el('div')
  ;[
    ['Objetivo', cycle.main_goal || 'Fortalecer contagem ate 10 com apoio visual.'],
    ['Etapa atual', cycle.current_plan || 'Sessao inicial com blocos, imagens ou objetos concretos.'],
    ['Criterio de avanço', 'Avançar quando a criança contar ate 10 com menos apoio em 2 sessoes seguidas.'],
    ['Observação da equipe', 'Usar instruções curtas e evitar atividades longas sem pausa.'],
  ].forEach(([key, value]) => {
    const e = el('div', 'tp-plan-entry')
    e.append(el('div', 'tp-plan-key', key), el('div', 'tp-plan-val', value))
    entries.append(e)
  })
  block.append(entries)

  const suggestBtn = el('button', 'tp-btn-suggest', 'Sugerir ajuste à equipe')
  suggestBtn.type = 'button'
  // TODO: abrir modal de sugestão de ajuste ao plano
  block.append(suggestBtn)
  return block
}

function renderActivityBlock(onUseActivity) {
  const block = el('div', 'tp-block')
  block.append(el('div', 'tp-block-label', 'Atividade sugerida'))

  const title = el('h3', 'tp-activity-title', SUGGESTED_ACTIVITY.title)
  const facts = el('div', 'tp-activity-facts')
  ;[
    `Habilidade: ${SUGGESTED_ACTIVITY.skill}`,
    `Tempo estimado: ${SUGGESTED_ACTIVITY.time}`,
    `Materiais: ${SUGGESTED_ACTIVITY.materials}`,
  ].forEach((fact) => facts.append(el('span', null, fact)))

  const steps = el('ol', 'tp-activity-steps')
  SUGGESTED_ACTIVITY.steps.forEach((step) => steps.append(el('li', null, step)))

  const variants = el('div', 'tp-activity-variants')
  ;[
    ['Se ficar difícil', SUGGESTED_ACTIVITY.easier],
    ['Se ficar fácil', SUGGESTED_ACTIVITY.harder],
  ].forEach(([label, copy]) => {
    const item = el('div')
    item.append(el('strong', null, label), el('p', null, copy))
    variants.append(item)
  })

  block.append(title, facts, el('div', 'tp-plan-key', 'Como aplicar'), steps, variants)

  const actions = el('div', 'tp-inline-actions')
  const useBtn = el('button', 'tp-btn-suggest', 'Usar no registro')
  useBtn.type = 'button'
  useBtn.addEventListener('click', () => onUseActivity?.(SUGGESTED_ACTIVITY))

  const link = el('a', 'tp-activity-link', 'Abrir biblioteca de atividades →')
  link.href = 'atividades.html'
  actions.append(useBtn, link)
  block.append(actions)
  return block
}

// ── Ciclo ativo (workspace) ───────────────────────────────────────────────────

function renderStatusMetric(label, value, note = '') {
  const card = el('article', 'tp-metric-v2')
  card.append(el('span', null, label), el('b', null, value))
  if (note) card.append(el('small', null, note))
  return card
}

function renderMetric(label, value) {
  return renderStatusMetric(label, value)
}

function renderStatusSummary(cycle, rows) {
  const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
  const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  const last = rows?.[0]

  const grid = el('section', 'tp-status-grid-v2')
  grid.append(
    renderStatusMetric('Sessões registradas', String(rows?.length ?? 0), 'neste ciclo'),
    renderStatusMetric('Mês do ciclo', `${currentMonth}/${totalMonths}`, 'ciclo ativo'),
    renderStatusMetric('Última sessão', formatLastSession(last?.date), last?.activity_title ? truncateText(last.activity_title, 34) : 'sem registro ainda'),
    renderStatusMetric('Relatório mensal', 'pendente', `mês ${currentMonth}`)
  )
  return grid
}

function renderMonthlyReportBlock(cycle) {
  const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
  const block = el('section', 'tp-card-v2')
  block.id = 'monthly-report'

  const head = el('div', 'tp-card-head-v2')
  const titleWrap = el('div')
  titleWrap.append(
    el('div', 'tp-card-kicker-v2', 'Acompanhamento contínuo'),
    el('h2', 'tp-card-title-v2', 'Relatório mensal')
  )
  head.append(titleWrap, el('span', 'tp-status-pill tp-status-pill--warn', 'Pendente'))

  const copy = el('p', 'tp-card-copy', `Mês ${currentMonth} de ${totalMonths}. O relatório mensal resume evolução observada, dificuldades persistentes, próximos focos e sugestão para a família.`)
  const list = el('ul', 'tp-mini-list')
  ;['Evolução observada', 'Dificuldades persistentes', 'Próximos focos', 'Sugestão para a família'].forEach((item) => {
    list.append(el('li', null, item))
  })

  const details = el('details', 'tp-report-draft')
  const summary = document.createElement('summary')
  summary.textContent = 'Criar relatório mensal'
  const textarea = document.createElement('textarea')
  textarea.placeholder = 'Rascunhe os pontos principais do mês. Este MVP ainda não salva o relatório no banco.'
  details.append(summary, textarea)

  block.append(head, copy, list, details)
  return block
}

function renderTeamSupportBlock() {
  const block = el('section', 'tp-card-v2 tp-team-card')
  block.id = 'team-support'

  const head = el('div', 'tp-card-head-v2')
  const titleWrap = el('div')
  titleWrap.append(
    el('div', 'tp-card-kicker-v2', 'Suporte'),
    el('h2', 'tp-card-title-v2', 'Falar com equipe')
  )
  head.append(titleWrap)

  const list = el('ul', 'tp-mini-list')
  ;[
    'A criança demonstrar desconforto constante',
    'A atividade estiver difícil demais',
    'Você não souber adaptar o plano',
    'Precisar sugerir mudança no ciclo',
  ].forEach((item) => list.append(el('li', null, item)))

  const actions = el('div', 'tp-inline-actions')
  const mail = el('a', 'tp-activity-link', 'Enviar e-mail')
  mail.href = 'mailto:equipecognita@email.com?subject=Ajuda%20no%20ciclo%20Cognita'
  const whatsapp = el('a', 'tp-activity-link', 'Chamar no WhatsApp')
  whatsapp.href = 'https://wa.me/5500000000000'
  whatsapp.target = '_blank'
  whatsapp.rel = 'noopener'
  actions.append(mail, whatsapp)

  block.append(
    head,
    el('p', 'tp-card-copy', 'Procure a equipe quando:'),
    list,
    el('p', 'tp-card-copy', 'Tempo médio de resposta: até 48h.'),
    actions
  )
  return block
}

function renderCycleActive(cycle) {
  const frag = document.createDocumentFragment()
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const name = firstName(child.name)

  const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
  const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  const age = ageFrom(child.birth_date)

  const recentContainer = el('div')
  const form = renderSessionForm(cycle, () => loadSessions(cycle.id, recentContainer, true))

  const openForm = () => {
    form.open = true
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const dashboard = el('div', 'tp-dashboard')

  // ── Hero principal ──
  const hero = el('section', 'tp-hero-v2')

  const heroMain = el('div', 'tp-hero-main')
  heroMain.append(
    el('div', 'tp-hero-kicker', 'Sessão desta semana'),
    el('h1', 'tp-hero-title', `Acompanhar ${name} com calma e clareza.`)
  )

  const heroDesc = el('p', 'tp-hero-desc')
  heroDesc.textContent = cycle.main_goal
    ? cycle.main_goal
    : 'Consulte o perfil pedagógico, escolha uma atividade compatível e registre a sessão em linguagem simples para a família.'
  heroMain.append(heroDesc)

  const facts = el('div', 'tp-hero-facts')
  if (age != null)        facts.append(el('span', 'tp-hero-pill', `${age} anos`))
  if (child.school_year) facts.append(el('span', 'tp-hero-pill', child.school_year))

  const difficulties = lp.math_difficulties ?? child.main_difficulties
  if (difficulties?.length) {
    const txt = Array.isArray(difficulties) ? difficulties.slice(0, 2).join(', ') : difficulties
    facts.append(el('span', 'tp-hero-pill', txt))
  }
  facts.append(el('span', 'tp-hero-pill', `Mês ${currentMonth} de ${totalMonths}`))
  heroMain.append(facts)

  // Coluna lateral do hero: card de ação + micro-métricas
  const heroSide = el('aside', 'tp-hero-side')

  const action = el('div', 'tp-action-v2')
  action.append(
    el('small', null, 'Próxima ação'),
    el('strong', null, 'Registrar a sessão da semana'),
    el('p', null, 'Depois da atividade, escreva um resumo do que funcionou, do que ficou difícil e do próximo passo.')
  )
  const actionBtn = el('button', 'tp-btn-register')
  actionBtn.type = 'button'
  actionBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  actionBtn.append(document.createTextNode('Registrar sessão'))
  actionBtn.addEventListener('click', openForm)
  action.append(actionBtn)

  const metrics = el('div', 'tp-metrics-v2')
  metrics.append(
    renderMetric('mês atual', `${currentMonth}/${totalMonths}`),
    renderMetric('ciclo', 'ativo')
  )

  heroSide.append(action, metrics)
  hero.append(heroMain, heroSide)
  dashboard.append(hero)

  // ── Formulário de registro ──
  const formCard = el('section', 'tp-card-v2')
  const formHead = el('div', 'tp-card-head-v2')
  const formTitleWrap = el('div')
  formTitleWrap.append(
    el('div', 'tp-card-kicker-v2', 'Registro humano'),
    el('h2', 'tp-card-title-v2', 'Anotar o que aconteceu')
  )
  formHead.append(formTitleWrap)
  formCard.append(formHead, form)
  dashboard.append(formCard)

  // ── Grid inferior: plano+atividade / sessões recentes ──
  const grid = el('div', 'tp-grid-v2')
  const left = el('div', 'tp-stack-v2')

  const planCard = renderPlanBlock(cycle)
  planCard.className = 'tp-card-v2'

  const activityCard = renderActivityBlock()
  activityCard.className = 'tp-card-v2'

  left.append(planCard, activityCard)

  const recentCard = el('section', 'tp-card-v2')
  const recentHead = el('div', 'tp-card-head-v2')
  const recentTitleWrap = el('div')
  recentTitleWrap.append(
    el('div', 'tp-card-kicker-v2', 'Histórico'),
    el('h2', 'tp-card-title-v2', 'Sessões recentes')
  )
  recentHead.append(recentTitleWrap)
  recentCard.append(recentHead, recentContainer)

  grid.append(left, recentCard)
  dashboard.append(grid)

  // FAB mobile (visível só < 680px via CSS)
  const fab = el('button', 'tp-fab')
  fab.type = 'button'
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  fab.append(document.createTextNode('Registrar sessão'))
  fab.addEventListener('click', openForm)

  frag.append(dashboard, fab)

  loadSessions(cycle.id, recentContainer, true)
  return frag
}

function renderCycleActiveV2(cycle) {
  const frag = document.createDocumentFragment()
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const name = firstName(child.name)
  const fullName = child.name ?? name

  const totalMonths = monthsBetween(cycle.start_date, cycle.end_date)
  const currentMonth = currentCycleMonth(cycle.start_date, cycle.end_date)
  const age = ageFrom(child.birth_date)
  const difficulties = lp.math_difficulties ?? child.main_difficulties
  const focusText = difficulties?.length
    ? (Array.isArray(difficulties) ? difficulties.slice(0, 3).join(' · ') : difficulties)
    : SUGGESTED_ACTIVITY.focus

  const statusContainer = el('div')
  const recentContainer = el('div')
  const refreshSessions = () => loadSessions(cycle.id, recentContainer, true, (rows) => {
    statusContainer.replaceChildren(renderStatusSummary(cycle, rows))
  })
  const form = renderSessionForm(cycle, refreshSessions)

  const openForm = () => {
    form.open = true
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const useSuggestedActivity = (activity) => {
    form.fillSuggestedActivity?.(activity)
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const dashboard = el('div', 'tp-dashboard')

  const header = el('section', 'tp-child-header')
  const headerMain = el('div', 'tp-child-header-main')
  const metaParts = []
  if (age != null) metaParts.push(`${age} anos`)
  if (child.school_year) metaParts.push(child.school_year)

  headerMain.append(
    el('div', 'tp-card-kicker-v2', 'Criança acompanhada'),
    el('h1', 'tp-child-title', fullName),
    el('p', 'tp-child-meta', metaParts.join(' · ') || 'Perfil pedagógico vinculado'),
    el('div', 'tp-plan-key', 'Meta do ciclo'),
    el('p', 'tp-child-goal', cycle.main_goal || 'Fortalecer contagem, sequência numérica e adição simples com apoio visual.'),
    el('div', 'tp-plan-key', 'Foco atual')
  )

  const focusPills = el('div', 'tp-hero-facts')
  String(focusText).split(/[·,]/).map((part) => part.trim()).filter(Boolean).slice(0, 4).forEach((part) => {
    focusPills.append(el('span', 'tp-hero-pill', part))
  })

  const headerActions = el('div', 'tp-header-actions')
  const registerBtn = el('button', 'tp-btn-register')
  registerBtn.type = 'button'
  registerBtn.textContent = 'Registrar sessão'
  registerBtn.addEventListener('click', openForm)
  const profileLink = el('a', 'tp-activity-link', 'Ver perfil')
  profileLink.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
  const libraryLink = el('a', 'tp-activity-link', 'Abrir biblioteca')
  libraryLink.href = 'atividades.html'
  headerActions.append(registerBtn, profileLink, libraryLink)
  headerMain.append(focusPills, headerActions)

  const cycleCard = el('aside', 'tp-cycle-card-v2')
  cycleCard.append(
    el('span', 'tp-status-pill tp-status-pill--ok', 'Ciclo ativo'),
    el('strong', null, `Mês ${currentMonth} de ${totalMonths}`),
    el('p', null, 'Próxima ação: registrar sessão da semana')
  )
  header.append(headerMain, cycleCard)

  dashboard.append(header, statusContainer)
  statusContainer.replaceChildren(renderStatusSummary(cycle, []))

  const formCard = el('section', 'tp-card-v2')
  const formHead = el('div', 'tp-card-head-v2')
  const formTitleWrap = el('div')
  formTitleWrap.append(
    el('div', 'tp-card-kicker-v2', 'Registro guiado'),
    el('h2', 'tp-card-title-v2', 'Registrar sessão')
  )
  formHead.append(formTitleWrap)
  formCard.append(formHead, form)

  const grid = el('div', 'tp-grid-v2')
  const left = el('div', 'tp-stack-v2')
  const right = el('div', 'tp-stack-v2')

  const planCard = renderPlanBlock(cycle)
  planCard.className = 'tp-card-v2'

  const activityCard = renderActivityBlock(useSuggestedActivity)
  activityCard.className = 'tp-card-v2'

  left.append(planCard, activityCard, formCard)

  const recentCard = el('section', 'tp-card-v2')
  const recentHead = el('div', 'tp-card-head-v2')
  const recentTitleWrap = el('div')
  recentTitleWrap.append(
    el('div', 'tp-card-kicker-v2', 'Histórico'),
    el('h2', 'tp-card-title-v2', 'Sessões recentes')
  )
  recentHead.append(recentTitleWrap)
  recentCard.append(recentHead, recentContainer)

  right.append(recentCard, renderMonthlyReportBlock(cycle), renderTeamSupportBlock())
  grid.append(left, right)
  dashboard.append(grid)

  const fab = el('button', 'tp-fab')
  fab.type = 'button'
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  fab.append(document.createTextNode('Registrar sessão'))
  fab.addEventListener('click', openForm)

  frag.append(dashboard, fab)
  refreshSessions()
  return frag
}

// ── Orquestrador ──────────────────────────────────────────────────────────────

async function loadAndRender() {
  if (!stateBox) return

  stateBox.replaceChildren(
    el('div', 'tp-skeleton tp-skeleton--hero'),
    el('div', 'tp-skeleton tp-skeleton--panel')
  )
  updateTopbarBtn('loading')
  renderStatusStrip('loading')

  const { data: cycles, error } = await getTutorCycles(session.user.id)

  if (error) {
    stateBox.replaceChildren(renderError(loadAndRender))
    renderStatusStrip('error')
    renderSidebar('error', null)
    return
  }

  const derived    = deriveTutorState(session.profile.status, cycles)
  const cycleMaybe = derived.cycle ?? derived.cycles?.[0]

  updateTopbarBtn(derived.state)
  renderStatusStrip(derived.state, cycleMaybe)
  renderSidebar(derived.state, cycleMaybe)

  switch (derived.state) {
    case 'pending':
      stateBox.replaceChildren(renderPending())
      break
    case 'orientation_pending':
      stateBox.replaceChildren(renderOrientationPending())
      break
    case 'available':
      stateBox.replaceChildren(renderAvailable())
      break
    case 'cycle_planned':
      stateBox.replaceChildren(renderCyclePlanned(derived.cycle))
      break
    case 'cycle_active': {
      const frag = renderCycleActiveV2(derived.cycle)
      stateBox.replaceChildren()
      stateBox.append(frag)
      wireOpenSessionBtn()
      break
    }
    case 'cycle_paused':
      stateBox.replaceChildren(renderCyclePaused())
      break
    case 'cycle_completed':
      stateBox.replaceChildren(renderCycleCompleted())
      break
    default:
      stateBox.replaceChildren(renderAvailable())
  }
}

if (session && stateBox) {
  fillIdentity()
  await loadAndRender()
}
