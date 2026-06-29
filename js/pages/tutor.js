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

function renderSessionCompact(record) {
  const item = el('article', 'tp-session-item')
  item.append(el('span', 'tp-session-date', formatDate(record.date) ?? '-'))
  item.append(el('p', 'tp-session-title', record.activity_title ?? 'Sessão'))

  if (record.notes) {
    const note = el('p', 'tp-session-note')
    note.textContent = record.notes.length > 90 ? record.notes.slice(0, 90) + '…' : record.notes
    item.append(note)
  }

  // TODO(wiring:sessions): exibir record.visible_to_family quando o campo existir
  item.append(el('span', 'tp-session-tag tp-session-tag--reg', 'Registrada'))
  return item
}

async function loadSessions(cycleId, container, compact = false) {
  container.replaceChildren(el('p', 'tp-empty', 'Carregando sessões…'))
  const { data, error } = await getCycleSessions(cycleId)

  if (error) {
    container.replaceChildren(el('p', 'tp-empty', 'Não foi possível carregar as sessões.'))
    return
  }

  const rows = data ?? []
  if (!rows.length) {
    const empty = el('div', 'tp-empty')
    empty.append(
      el('strong', null, 'Nenhuma sessão registrada'),
      document.createTextNode(' — registre a sessão desta semana usando o formulário acima.')
    )
    container.replaceChildren(empty)
    return
  }

  const list = el('div', 'tp-session-list')
  const source = compact ? rows.slice(0, 4) : rows
  source.forEach((r) => list.append(renderSessionCompact(r)))
  container.replaceChildren(list)
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

    okBox.textContent = 'Sessão registrada com sucesso.'; okBox.hidden = false
    details.open = false
    await onSaved()
  })

  const actions = el('div', 'tp-form-actions')
  actions.append(errorBox, okBox, saveBtn)
  body.append(actions)
  details.append(body)
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
  block.append(el('div', 'tp-block-label', 'Plano atual'))

  if (!cycle.main_goal && !cycle.current_plan) {
    block.append(el('p', 'tp-empty', 'A equipe ainda não definiu o plano deste ciclo.'))
  } else {
    const entries = el('div')
    if (cycle.main_goal) {
      const e = el('div', 'tp-plan-entry')
      e.append(el('div', 'tp-plan-key', 'Meta do ciclo'), el('div', 'tp-plan-val', cycle.main_goal))
      entries.append(e)
    }
    // TODO(wiring:support_cycles): etapa_atual e criterio_avanco quando adicionados ao schema
    if (cycle.current_plan) {
      const e = el('div', 'tp-plan-entry')
      e.append(el('div', 'tp-plan-key', 'Plano atual'), el('div', 'tp-plan-val', cycle.current_plan))
      entries.append(e)
    }
    block.append(entries)
  }

  const suggestBtn = el('button', 'tp-btn-suggest', 'Sugerir ajuste à equipe')
  suggestBtn.type = 'button'
  // TODO: abrir modal de sugestão de ajuste ao plano
  block.append(suggestBtn)
  return block
}

function renderActivityBlock() {
  const block = el('div', 'tp-block')
  block.append(el('div', 'tp-block-label', 'Atividade sugerida'))

  // TODO(wiring:support_cycles): exibir atividade definida pela equipe quando current_activity_id existir
  block.append(el('p', 'tp-activity-note', 'A equipe ainda não definiu a atividade desta semana. Consulte a biblioteca para escolher uma de acordo com o foco do ciclo.'))

  const link = el('a', 'tp-activity-link', 'Abrir biblioteca de atividades →')
  link.href = 'atividades.html'
  block.append(link)
  return block
}

// ── Ciclo ativo (workspace) ───────────────────────────────────────────────────

function renderCycleActive(cycle) {
  const frag = document.createDocumentFragment()

  // Container para sessões recentes (referenciado antes de ser passado ao onSaved)
  const recentContainer = el('div')

  const form = renderSessionForm(cycle, () => loadSessions(cycle.id, recentContainer, true))

  const openForm = () => {
    form.open = true
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  // Bloco 1: O que fazer agora
  frag.append(renderActionBlock(cycle, openForm))

  // Bloco 2: Formulário de registro (expansível)
  const formBlock = el('div', 'tp-block')
  formBlock.append(form)
  frag.append(formBlock)

  // Bloco 3: Plano atual
  frag.append(renderPlanBlock(cycle))

  // Bloco 4: Atividade sugerida
  frag.append(renderActivityBlock())

  // Bloco 5: Sessões recentes
  const recentBlock = el('div', 'tp-block')
  recentBlock.append(el('div', 'tp-block-label', 'Sessões recentes'))
  recentBlock.append(recentContainer)
  frag.append(recentBlock)

  // FAB mobile (visível só < 680px via CSS)
  const fab = el('button', 'tp-fab')
  fab.type = 'button'
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
  fab.append(document.createTextNode('Registrar sessão'))
  fab.addEventListener('click', openForm)
  frag.append(fab)

  loadSessions(cycle.id, recentContainer, true)
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
      const frag = renderCycleActive(derived.cycle)
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
