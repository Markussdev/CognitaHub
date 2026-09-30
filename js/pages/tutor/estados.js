// Estados do tutor: o que a tela mostra quando NÃO há acompanhamento (candidatura
// em análise, orientação, disponível, erro) e a máquina que decide o estado.
import { el } from '../../lib/ui.js'

export const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

export const RECORD_STATES = ['cycle_planned', 'cycle_active', 'cycle_paused', 'cycle_completed']

// ── Estados sem record (sem criança vinculada ainda) ──────────────────────────

function buildStatusCard({ kicker, title, desc, icon, tone = 'info' }) {
  const card = el('div', 'card')
  const inner = el('div', 'status-card')
  const ico = el('div', `status-ico ${tone}`)
  ico.innerHTML = icon
  const body = el('div')
  body.append(
    el('p', 'status-kicker', kicker),
    el('h1', 'status-title', title),
    el('p', null, desc)
  )
  inner.append(ico, body)
  card.append(inner)
  return { card, body }
}

function renderPending() {
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'pending',
    title: 'Candidatura em análise',
    desc: 'A equipe Cognita vai revisar seu perfil e disponibilidade antes de liberar os pareamentos com crianças.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  })

  const steps = el('div', 'steps')
  steps.style.marginTop = '14px'
  ;[
    { n: '✓', label: 'Cadastro enviado', desc: 'Suas informações foram recebidas.', cls: 'done' },
    { n: '2', label: 'Revisão pela equipe', desc: 'A equipe analisa formação e disponibilidade.', cls: 'now' },
    { n: '3', label: 'Orientação inicial', desc: 'Encontro introdutório com a equipe Cognita.', cls: '' },
    { n: '4', label: 'Pareamento com criança', desc: 'Você recebe o perfil pedagógico e começa o acompanhamento.', cls: '' },
  ].forEach(({ n, label, desc, cls }) => {
    const step = el('div', `step${cls ? ` ${cls}` : ''}`)
    step.append(el('div', 'step-n', n))
    const copy = el('div')
    copy.append(el('b', null, label), el('p', null, desc))
    step.append(copy)
    steps.append(step)
  })
  body.append(steps)
  return card
}

function renderOrientationPending() {
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'pending',
    title: 'Orientação inicial pendente',
    desc: 'Antes do primeiro pareamento, a equipe Cognita faz uma orientação introdutória. Conclua as etapas abaixo.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  })

  const steps = el('div', 'steps')
  steps.style.marginTop = '14px'
  ;[
    { label: 'Ler os compromissos do tutor', desc: 'Leia e aceite o guia de atuação pedagógica inclusiva.' },
    { label: 'Treinar a escrita de resumo', desc: 'Pratique escrever resumos claros e respeitosos para os responsáveis.' },
    { label: 'Confirmar com a equipe', desc: 'Acuse recebimento da orientação com a equipe Cognita.' },
  ].forEach(({ label, desc }, i) => {
    const step = el('div', 'step')
    step.append(el('div', 'step-n', String(i + 1)))
    const copy = el('div')
    copy.append(el('b', null, label), el('p', null, desc))
    step.append(copy)
    steps.append(step)
  })
  body.append(steps)
  return card
}

function renderAvailable() {
  const { card, body } = buildStatusCard({
    kicker: 'Painel do tutor', tone: 'ok',
    title: 'Pronto para acompanhar',
    desc: 'Seu cadastro foi aprovado e a orientação inicial foi concluída. A equipe Cognita vai criar o pareamento quando houver compatibilidade de perfil e agenda.',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
  })
  const link = el('a', 'lib-link', 'Explorar biblioteca de atividades →')
  link.href = 'atividades.html'
  body.append(link)
  return card
}

function renderNoRecordError(retry) {
  const card = el('div', 'card')
  const inner = el('div', 'error-card')
  inner.append(
    el('strong', null, 'Não foi possível carregar os dados'),
    el('p', null, 'Verifique sua conexão e tente de novo.')
  )
  const btn = el('button', 'btn btn-ghost', 'Tentar novamente')
  btn.type = 'button'
  btn.addEventListener('click', retry)
  inner.append(btn)
  card.append(inner)
  return card
}

export function renderNoRecord(state, retry) {
  const wrap = el('div', 'panel')
  if (state === 'pending') wrap.append(renderPending())
  else if (state === 'orientation_pending') wrap.append(renderOrientationPending())
  else if (state === 'error') wrap.append(renderNoRecordError(retry))
  else wrap.append(renderAvailable())
  return wrap
}

// ── Máquina de estados ────────────────────────────────────────────────────────

export function deriveTutorState(profileStatus, cycles) {
  if (REVIEW_STATUSES.includes(profileStatus)) return { state: 'pending' }
  if (profileStatus === 'orientation_pending') return { state: 'orientation_pending' } // TODO(wiring:profiles)

  if (!cycles?.length) return { state: 'available' }

  const active = cycles.find((c) => c.status === 'active')
  const planned = cycles.find((c) => c.status === 'planned')
  const paused = cycles.filter((c) => c.status === 'paused')
  const done = cycles.filter((c) => c.status === 'completed')

  if (active) return { state: 'cycle_active', cycle: active }
  if (planned) return { state: 'cycle_planned', cycle: planned }
  if (paused.length) return { state: 'cycle_paused', cycle: paused[0] }
  if (done.length) return { state: 'cycle_completed', cycle: done[0] }
  return { state: 'available' }
}
