import { requireRole, signOut } from '../lib/auth.js'
import { wireRailToggle } from '../lib/rail.js'
import {
  getChildrenWaitingReview,
  approveTutor,
  rejectTutor,
  approveChild,
  requestChildRevision,
  getAllChildrenAdmin,
  getAllTutorsAdmin,
  getAllCyclesAdmin,
  updateCycleStatus,
  swapCycleTutor,
  listTrailTemplatesAdmin,
  setTrailTemplateStatus,
  getTrailTemplateUsage,
} from '../data/admin.js'
import {
  getChildrenWaitingMatch,
  getAvailableTutors,
  createSupportCycle,
} from '../data/matching.js'
import { getTrailTemplateWithModules } from '../data/trilha-formal.js'
import { formatTutorFormation } from '../lib/tutor-application-format.mjs'
import { formatSchoolYear } from '../lib/school-year.js'

const logoIconSrc = '/assets/logo-icon-transparent.png'

// ── Central de operação da equipe Cognita ────────────────────────────────────
// Admin operacional mínimo, não ERP: quatro áreas que respondem só ao que a
// equipe decide de verdade — Resumo (o que precisa de atenção agora),
// Pessoas (analisar/aprovar cadastros), Ciclos (parear e gerir ciclos) e
// Conteúdo (o que está publicado no catálogo oficial). Todo contador é uma
// query; todo botão executa uma ação real (o motor de aprovação/pareamento
// com rollback já existia em js/data/admin.js e foi mantido).
// Poda da versão anterior: coluna "Relatórios — próxima versão" (fachada),
// coluna "Ciclos" que era só um aviso estático, e o shell cognita-os.css
// (a 4ª cópia de shell do projeto — agora é o tutor-shell compartilhado).
// Sem "suspender" por enquanto, de propósito: profiles.status 'suspended'
// não é honrado por nenhum fluxo do produto (requireRole/deriveTutorState
// não o conhecem) — seria um botão de segurança de mentira.

const session = await requireRole('admin')

const $ = (sel) => document.querySelector(sel)

// ── Helpers ──────────────────────────────────────────────────────────────────

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function initialsOf(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function ageFrom(birthDate) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const before = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (before) age -= 1
  return age
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

function monthsBetween(startDate, endDate) {
  if (!startDate || !endDate) return 6
  const a = new Date(`${startDate}T00:00:00`)
  const b = new Date(`${endDate}T00:00:00`)
  if (isNaN(a) || isNaN(b)) return 6
  return Math.max(1, Math.round((b - a) / (30.44 * 86400000)))
}

function currentCycleMonth(startDate, endDate) {
  if (!startDate) return 1
  const a = new Date(`${startDate}T00:00:00`)
  if (isNaN(a)) return 1
  const m = Math.floor((Date.now() - a) / (30.44 * 86400000)) + 1
  return Math.min(Math.max(1, m), monthsBetween(startDate, endDate))
}

function asText(value) {
  if (value == null || value === '') return null
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  if (typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(' · ')
  }
  return String(value)
}

function fact(label, value) {
  const text = asText(value)
  if (!text) return null
  const row = el('div')
  const detail = el('dd', null, text)
  if (text.includes('\n')) detail.classList.add('preserve-lines')
  row.append(el('dt', null, label), detail)
  return row
}

function factList(facts) {
  const list = el('dl', 'card-facts')
  facts.forEach((row) => row && list.append(row))
  return list
}

function admDetails(summaryLabel, content) {
  const details = el('details', 'adm-details')
  details.append(el('summary', null, summaryLabel), content)
  return details
}

function admEmpty(strongText, spanText) {
  const box = el('div', 'adm-empty')
  box.append(el('strong', null, strongText), el('span', null, spanText))
  return box
}

// action() pode retornar { error, userMessage } (mostra a mensagem) ou
// { cancelled: true } (não recarrega nem mostra erro). Sucesso → loadAll().
function bindAction(button, buttons, errorBox, action, confirmText) {
  button.addEventListener('click', async () => {
    if (confirmText && !window.confirm(confirmText)) return

    errorBox.hidden = true
    const originalLabel = button.textContent
    buttons.forEach((b) => { b.disabled = true })
    button.textContent = 'Salvando…'

    const result = (await action()) ?? {}

    if (result.cancelled) {
      buttons.forEach((b) => { b.disabled = false })
      button.textContent = originalLabel
      return
    }

    if (result.error) {
      buttons.forEach((b) => { b.disabled = false })
      button.textContent = originalLabel
      errorBox.textContent = result.userMessage || 'Não foi possível concluir. Tente de novo.'
      errorBox.hidden = false
      return
    }

    await loadAll()
  })
}

// ── Vocabulário de status (badge + rótulo humano) ────────────────────────────

const CHILD_BADGE = {
  waiting_review: ['badge-warn', 'Em análise'],
  revision_requested: ['badge-warn', 'Revisão pedida'],
  waiting_match: ['badge-info', 'Aguardando tutor'],
  matched: ['badge-info', 'Pareada'],
  active: ['badge-ok', 'Em ciclo'],
  paused: ['badge-warn', 'Pausado'],
  completed: ['badge-ok', 'Concluído'],
  rejected: ['badge-bad', 'Recusado'],
}
const TUTOR_REGISTRATION_BADGE = {
  missing: ['badge-mid', 'Cadastro incompleto'],
  incomplete: ['badge-mid', 'Cadastro incompleto'],
  pending: ['badge-warn', 'Em análise'],
  approved: ['badge-ok', 'Aprovada'],
  rejected: ['badge-bad', 'Recusada'],
}
const CYCLE_BADGE = {
  planned: ['badge-info', 'Planejado'],
  active: ['badge-ok', 'Ativo'],
  paused: ['badge-warn', 'Pausado'],
  completed: ['badge-mid', 'Concluído'],
}
const TEMPLATE_BADGE = {
  draft: ['badge-mid', 'Rascunho'],
  published: ['badge-ok', 'Publicada'],
  archived: ['badge-warn', 'Arquivada'],
}

function badgeOf(map, status) {
  const [cls, label] = map[status] ?? ['badge-mid', status ?? '—']
  return el('span', `badge ${cls}`, label)
}

// ── Estado carregado ─────────────────────────────────────────────────────────

let D = {
  pendingTutors: [], waitingChildren: [], matchChildren: [], availableTutors: [],
  allChildren: [], allTutors: [], allCycles: [], templates: [], templateUsage: new Map(),
  errors: [],
}
let activeView = 'resumo'
let pessoasFiltro = 'pendencia' // aterrissa no que precisa de ação

// ── Views ────────────────────────────────────────────────────────────────────

function viewHead(title, sub) {
  const head = el('header', 'adm-head')
  head.append(el('p', 'kicker', 'Central de operação'))
  head.append(el('h1', null, title))
  if (sub) head.append(el('p', 'sub', sub))
  return head
}

function cardPad(...children) {
  const card = el('div', 'card card-pad')
  children.forEach((c) => c && card.append(c))
  return card
}

// ── Resumo ───────────────────────────────────────────────────────────────────

function statTile(label, value, hint, view, hot) {
  const tile = el('button', `adm-stat${hot && value > 0 ? ' is-hot' : ''}`)
  tile.type = 'button'
  tile.append(el('div', 'lbl', label))
  tile.append(el('div', 'val num', value == null ? '—' : String(value)))
  tile.append(el('div', 'hint', hint))
  tile.addEventListener('click', () => switchView(view))
  return tile
}

function attentionRow(text, small, btnLabel, view) {
  const row = el('div', 'adm-attention-row')
  row.append(el('span', 'dot'))
  const tx = el('div', 'tx')
  tx.append(document.createTextNode(text))
  if (small) tx.append(el('small', null, small))
  row.append(tx)
  const btn = el('button', 'btn btn-ghost', btnLabel)
  btn.type = 'button'
  btn.addEventListener('click', () => switchView(view))
  row.append(btn)
  return row
}

function viewResumo() {
  const page = el('div', 'adm-page')
  page.append(viewHead('Resumo da operação', 'O que está esperando decisão da equipe agora.'))

  const stack = el('div', 'adm-stack')

  const activeCycles = D.allCycles.filter((c) => c.status === 'active').length
  const stats = el('div', 'adm-stats')
  stats.append(
    statTile('Crianças em análise', D.waitingChildren.length, 'cadastros aguardando a equipe', 'pessoas', true),
    statTile('Tutores a validar', D.pendingTutors.length, 'candidaturas recebidas', 'pessoas', true),
    statTile('Aguardando pareamento', D.matchChildren.length, 'aprovadas sem tutor', 'ciclos', true),
    statTile('Ciclos ativos', activeCycles, 'acompanhamentos em andamento', 'ciclos', false),
  )
  stack.append(stats)

  const attention = cardPad(el('p', 'kicker', 'Precisa da sua atenção'))
  const rows = []
  if (D.waitingChildren.length) {
    rows.push(attentionRow(
      `${D.waitingChildren.length} ${D.waitingChildren.length === 1 ? 'cadastro de criança aguardando análise' : 'cadastros de criança aguardando análise'}`,
      'A família fica em espera até a equipe aprovar.', 'Analisar', 'pessoas'))
  }
  if (D.pendingTutors.length) {
    rows.push(attentionRow(
      `${D.pendingTutors.length} ${D.pendingTutors.length === 1 ? 'candidatura de tutor a validar' : 'candidaturas de tutor a validar'}`,
      'Tutor só entra na operação depois da validação.', 'Validar', 'pessoas'))
  }
  if (D.matchChildren.length) {
    rows.push(attentionRow(
      `${D.matchChildren.length} ${D.matchChildren.length === 1 ? 'criança aprovada sem tutor' : 'crianças aprovadas sem tutor'}`,
      'O pareamento é a chave do produto — quanto antes, melhor.', 'Parear', 'ciclos'))
  }
  const paused = D.allCycles.filter((c) => c.status === 'paused').length
  if (paused) {
    rows.push(attentionRow(
      `${paused} ${paused === 1 ? 'ciclo pausado' : 'ciclos pausados'}`,
      'Vale revisar se já dá para retomar ou encerrar.', 'Ver ciclos', 'ciclos'))
  }
  D.errors.forEach((msg) => {
    rows.push(attentionRow(msg, 'Recarregue a página; se persistir, confira as policies.', 'Recarregar', activeView))
  })

  if (rows.length) rows.forEach((r) => attention.append(r))
  else attention.append(admEmpty('Nada pendente.', 'A operação está em dia — nenhuma decisão esperando a equipe.'))
  stack.append(attention)

  page.append(stack)
  return page
}

// ── Pessoas ──────────────────────────────────────────────────────────────────

function childPendingActions(child, errorBox) {
  const actions = el('div', 'row-actions')
  const approve = el('button', 'btn btn-primary', 'Aprovar para pareamento')
  approve.type = 'button'
  const revise = el('button', 'btn btn-ghost', 'Pedir revisão')
  revise.type = 'button'
  actions.append(approve, revise)
  bindAction(approve, [approve, revise], errorBox, () => approveChild(child.id))
  bindAction(revise, [approve, revise], errorBox, () => requestChildRevision(child.id),
    `Pedir revisão do cadastro de ${child.name ?? 'esta criança'}? O responsável deverá ajustar as informações.`)
  return actions
}

function renderChildRow(child) {
  const guardian = child.profiles ?? {}
  const row = el('div', 'adm-row')
  const main = el('div', 'adm-row-main')
  main.append(el('span', 'adm-avatar soft', initialsOf(child.name)))

  const tx = el('div', 'adm-row-tx')
  tx.append(el('b', null, child.name ?? 'Sem nome'))
  const age = ageFrom(child.birth_date)
  tx.append(el('span', null, [
    age != null ? `${age} anos` : null,
    guardian.name ? `resp.: ${guardian.name}` : null,
    child.created_at ? `desde ${formatDate(child.created_at)}` : null,
  ].filter(Boolean).join(' · ')))
  main.append(tx)

  const side = el('div', 'adm-row-side')
  side.append(badgeOf(CHILD_BADGE, child.status))
  main.append(side)
  row.append(main)

  // Perfil resumido (o pedagógico completo vive na triagem — aqui é consulta)
  row.append(admDetails('Perfil resumido', factList([
    fact('Ano escolar', child.school_year ? formatSchoolYear(child.school_year) : null),
    fact('Principais dificuldades', child.main_difficulties),
    fact('Responsável', guardian.name),
    fact('Contato', [guardian.email, guardian.phone].filter(Boolean).join(' · ')),
  ])))

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true
  row.append(errorBox)

  // Ação real só quando há decisão a tomar — o resto é leitura.
  if (child.status === 'waiting_review') {
    // A triagem completa (perfil pedagógico inteiro) fica no expand abaixo.
    const full = D.waitingChildren.find((c) => c.id === child.id)
    if (full) {
      const learning = Array.isArray(full.learning_profiles) ? full.learning_profiles[0] : full.learning_profiles
      row.append(admDetails('Triagem — perfil pedagógico completo', factList([
        fact('Diagnóstico formal', full.has_formal_diagnosis),
        fact('Dificuldades em matemática', learning?.math_difficulties),
        fact('Formatos preferidos', learning?.preferred_formats),
        fact('Tempo de atenção', learning?.attention_span),
        fact('Pontos fortes', learning?.strengths),
        fact('Motivadores', learning?.motivators),
        fact('Evitar', learning?.avoidances),
        fact('Notas sensoriais', full.sensory_notes),
        fact('Rotina', full.routine_notes),
      ])))
    }
    row.append(childPendingActions(child, errorBox))
  }
  return row
}

function renderTutorRow(tutor) {
  const app = tutor.application
  const registration = tutor.registration ?? { state: 'incomplete', canReview: false }
  const row = el('div', 'adm-row')
  const main = el('div', 'adm-row-main')
  main.append(el('span', 'adm-avatar', initialsOf(tutor.name)))

  const tx = el('div', 'adm-row-tx')
  tx.append(el('b', null, tutor.name ?? 'Sem nome'))
  tx.append(el('span', null, [
    formatTutorFormation(app?.formation) ?? 'formação não informada',
    tutor.created_at ? `desde ${formatDate(tutor.created_at)}` : null,
  ].filter(Boolean).join(' · ')))
  main.append(tx)

  const side = el('div', 'adm-row-side')
  side.append(badgeOf(TUTOR_REGISTRATION_BADGE, registration.state))
  main.append(side)
  row.append(main)

  row.append(admDetails('Candidatura e contato', factList([
    fact('Nascimento', formatDate(app?.birth_date)),
    fact('Formação', formatTutorFormation(app?.formation)),
    fact('Experiência', app?.experience),
    fact('Motivação', app?.motivation),
    fact('Disponibilidade semanal', app?.weekly_availability),
    fact('E-mail', tutor.email),
    fact('Telefone', tutor.phone),
  ])))

  if (registration.state === 'missing' || registration.state === 'incomplete') {
    const missing = [
      ...(registration.missingFields ?? []),
      ...(registration.missingLegalDocumentKeys?.length ? ['aceites obrigatórios'] : []),
    ]
    row.append(el('p', 'card-copy', `Cadastro incompleto${missing.length ? `: falta ${missing.join(', ')}.` : '.'}`))
  }

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true
  row.append(errorBox)

  if (registration.canReview) {
    const actions = el('div', 'row-actions')
    const approve = el('button', 'btn btn-primary', 'Aprovar tutor')
    approve.type = 'button'
    const reject = el('button', 'btn btn-bad', 'Recusar')
    reject.type = 'button'
    actions.append(approve, reject)
    bindAction(approve, [approve, reject], errorBox, () => approveTutor(tutor.id, session.user.id))
    bindAction(reject, [approve, reject], errorBox, () => rejectTutor(tutor.id, session.user.id),
      `Recusar a candidatura de ${tutor.name ?? 'este tutor'}? A pessoa não terá acesso ao painel.`)
    row.append(actions)
  }
  return row
}

const CHILD_PENDING_STATES = ['waiting_review', 'revision_requested']

function viewPessoas() {
  const page = el('div', 'adm-page')
  page.append(viewHead('Pessoas', 'Cada cadastro com seu status real — ação só onde há decisão a tomar.'))

  const stack = el('div', 'adm-stack')

  // ── Crianças ──
  const childCard = cardPad(el('p', 'kicker', 'Crianças e responsáveis'))
  const filters = el('div', 'adm-filters')
  const pendCount = D.allChildren.filter((c) => CHILD_PENDING_STATES.includes(c.status)).length
  ;[
    { id: 'pendencia', label: 'Com pendência', n: pendCount },
    { id: 'todas', label: 'Todas', n: D.allChildren.length },
  ].forEach(({ id, label, n }) => {
    const chip = el('button', `adm-chip${pessoasFiltro === id ? ' on' : ''}`)
    chip.type = 'button'
    chip.append(document.createTextNode(label), el('span', 'num', `(${n})`))
    chip.addEventListener('click', () => { pessoasFiltro = id; render() })
    filters.append(chip)
  })
  childCard.append(filters)

  const children = pessoasFiltro === 'pendencia'
    ? D.allChildren.filter((c) => CHILD_PENDING_STATES.includes(c.status))
    : D.allChildren

  if (!children.length) {
    childCard.append(admEmpty(
      pessoasFiltro === 'pendencia' ? 'Nenhuma criança com pendência.' : 'Nenhuma criança cadastrada ainda.',
      pessoasFiltro === 'pendencia' ? 'Novos cadastros aparecem aqui para análise.' : 'Os cadastros feitos pelo site aparecem aqui.'))
  } else {
    children.forEach((c) => childCard.append(renderChildRow(c)))
  }
  stack.append(childCard)

  // ── Tutores ──
  const tutorCard = cardPad(el('p', 'kicker', 'Tutores'))
  if (!D.allTutors.length) {
    tutorCard.append(admEmpty('Nenhum tutor cadastrado ainda.', 'As candidaturas feitas pelo site aparecem aqui.'))
  } else {
    D.allTutors.forEach((t) => tutorCard.append(renderTutorRow(t)))
  }
  stack.append(tutorCard)

  page.append(stack)
  return page
}

// ── Ciclos (pareamento + gestão) ─────────────────────────────────────────────

function renderMatchCard(child) {
  const learning = Array.isArray(child.learning_profiles) ? child.learning_profiles[0] : child.learning_profiles
  const row = el('div', 'adm-row')
  const main = el('div', 'adm-row-main')
  main.append(el('span', 'adm-avatar soft', initialsOf(child.name)))

  const tx = el('div', 'adm-row-tx')
  tx.append(el('b', null, child.name ?? 'Criança'))
  const age = ageFrom(child.birth_date)
  tx.append(el('span', null, [age != null ? `${age} anos` : null, asText(child.main_difficulties)].filter(Boolean).join(' · ') || 'Perfil aprovado'))
  main.append(tx)

  const side = el('div', 'adm-row-side')
  side.append(badgeOf(CHILD_BADGE, 'waiting_match'))
  main.append(side)
  row.append(main)

  row.append(admDetails('Perfil pedagógico', factList([
    fact('Ano escolar', child.school_year ? formatSchoolYear(child.school_year) : null),
    fact('Dificuldades em matemática', learning?.math_difficulties),
    fact('Formatos preferidos', learning?.preferred_formats),
    fact('Tempo de atenção', learning?.attention_span),
    fact('Motivadores', learning?.motivators),
    fact('Evitar', learning?.avoidances),
  ])))

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true

  const form = el('div', 'match-form')
  const tutorLabel = el('label', null, 'Tutor')
  const select = document.createElement('select')
  select.append(new Option('Selecione um tutor…', ''))
  D.availableTutors.forEach((tutor) => {
    const app = Array.isArray(tutor.tutor_applications) ? tutor.tutor_applications[0] : tutor.tutor_applications
    const formation = formatTutorFormation(app?.formation)
    const formationSuffix = formation ? ` · ${formation}` : ''
    select.append(new Option(`${tutor.name ?? 'Tutor'}${formationSuffix}`, tutor.id))
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
  const createBtn = el('button', 'btn btn-primary', 'Criar ciclo de 6 meses')
  createBtn.type = 'button'
  actions.append(createBtn)

  if (!D.availableTutors.length) {
    select.disabled = true
    createBtn.disabled = true
    errorBox.textContent = 'Nenhum tutor aprovado disponível. Valide um tutor em Pessoas primeiro.'
    errorBox.hidden = false
  }

  bindAction(createBtn, [createBtn], errorBox, async () => {
    const tutorId = select.value
    if (!tutorId) {
      return { error: new Error('no-tutor'), userMessage: 'Selecione um tutor para criar o ciclo.' }
    }
    const tutorName = select.options[select.selectedIndex]?.text ?? 'o tutor'
    const ok = window.confirm(
      `Criar um ciclo de 6 meses para ${child.name ?? 'esta criança'} com ${tutorName}? `
      + 'A criança passa a ser acompanhada por esse tutor.')
    if (!ok) return { cancelled: true }
    return createSupportCycle({
      childId: child.id,
      tutorId,
      mainGoal: goalInput.value.trim(),
      currentPlan: planInput.value.trim(),
    })
  })

  row.append(errorBox, form, actions)
  return row
}

function renderCycleRow(cycle) {
  const row = el('div', 'adm-row')
  const main = el('div', 'adm-row-main')
  main.append(el('span', 'adm-avatar', initialsOf(cycle.child?.name)))

  const total = monthsBetween(cycle.start_date, cycle.end_date)
  const atual = currentCycleMonth(cycle.start_date, cycle.end_date)

  const tx = el('div', 'adm-row-tx')
  tx.append(el('b', null, cycle.child?.name ?? 'Criança'))
  tx.append(el('span', null, [
    cycle.tutor?.name ? `tutor: ${cycle.tutor.name}` : 'sem tutor',
    cycle.status === 'active' ? `mês ${atual} de ${total}` : null,
    cycle.start_date ? `início ${formatDate(cycle.start_date)}` : null,
  ].filter(Boolean).join(' · ')))
  main.append(tx)

  const side = el('div', 'adm-row-side')
  side.append(badgeOf(CYCLE_BADGE, cycle.status))
  main.append(side)
  row.append(main)

  if (cycle.main_goal) {
    row.append(admDetails('Objetivo do ciclo', factList([fact('Objetivo', cycle.main_goal)])))
  }

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true
  row.append(errorBox)

  const actions = el('div', 'row-actions')
  const childName = cycle.child?.name ?? 'a criança'

  if (cycle.status === 'active') {
    const pause = el('button', 'btn btn-ghost', 'Pausar')
    pause.type = 'button'
    const end = el('button', 'btn btn-bad', 'Encerrar ciclo')
    end.type = 'button'
    actions.append(pause, end)
    bindAction(pause, [pause, end], errorBox,
      () => updateCycleStatus(cycle.id, cycle.child_id, 'paused', 'paused'),
      `Pausar o ciclo de ${childName}? Tutor e família veem o acompanhamento como pausado até a equipe retomar.`)
    bindAction(end, [pause, end], errorBox,
      () => updateCycleStatus(cycle.id, cycle.child_id, 'completed', 'completed'),
      `Encerrar o ciclo de ${childName}? Isso conclui o acompanhamento — o histórico de sessões permanece visível.`)
  } else if (cycle.status === 'paused') {
    const resume = el('button', 'btn btn-primary', 'Retomar')
    resume.type = 'button'
    const end = el('button', 'btn btn-bad', 'Encerrar ciclo')
    end.type = 'button'
    actions.append(resume, end)
    bindAction(resume, [resume, end], errorBox,
      () => updateCycleStatus(cycle.id, cycle.child_id, 'active', 'active'),
      `Retomar o ciclo de ${childName}?`)
    bindAction(end, [resume, end], errorBox,
      () => updateCycleStatus(cycle.id, cycle.child_id, 'completed', 'completed'),
      `Encerrar o ciclo de ${childName}? Isso conclui o acompanhamento — o histórico de sessões permanece visível.`)
  }

  // Trocar tutor: só em ciclo não-concluído, escondido atrás de um expand —
  // é ação rara, não pode competir com pausar/encerrar.
  if (cycle.status === 'active' || cycle.status === 'paused') {
    const swapWrap = el('div', 'adm-swap')
    const swapSelect = document.createElement('select')
    swapSelect.append(new Option('Novo tutor…', ''))
    D.availableTutors
      .filter((t) => t.id !== cycle.tutor_id)
      .forEach((t) => swapSelect.append(new Option(t.name ?? 'Tutor', t.id)))
    const swapBtn = el('button', 'btn btn-ghost', 'Trocar')
    swapBtn.type = 'button'
    swapWrap.append(swapSelect, swapBtn)
    bindAction(swapBtn, [swapBtn], errorBox, async () => {
      const tutorId = swapSelect.value
      if (!tutorId) {
        return { error: new Error('no-tutor'), userMessage: 'Selecione o novo tutor.' }
      }
      const name = swapSelect.options[swapSelect.selectedIndex]?.text ?? 'o novo tutor'
      const ok = window.confirm(
        `Trocar o tutor de ${childName} para ${name}? O histórico de sessões e a jornada continuam — muda quem acompanha daqui pra frente.`)
      if (!ok) return { cancelled: true }
      return swapCycleTutor(cycle.id, tutorId)
    })
    row.append(admDetails('Trocar tutor', swapWrap))
  }

  if (actions.children.length) row.append(actions)
  return row
}

function viewCiclos() {
  const page = el('div', 'adm-page')
  page.append(viewHead('Pareamentos e ciclos', 'O coração da operação: quem acompanha quem, e em que estado.'))

  const stack = el('div', 'adm-stack')

  const matchCard = cardPad(el('p', 'kicker', 'Criar pareamento'))
  if (!D.matchChildren.length) {
    matchCard.append(admEmpty('Nenhuma criança aguardando pareamento.',
      'Quando a equipe aprovar um cadastro em Pessoas, a criança aparece aqui para receber um tutor.'))
  } else {
    D.matchChildren.forEach((c) => matchCard.append(renderMatchCard(c)))
  }
  stack.append(matchCard)

  const cycleCard = cardPad(el('p', 'kicker', 'Ciclos'))
  if (!D.allCycles.length) {
    cycleCard.append(admEmpty('Nenhum ciclo criado ainda.', 'O primeiro pareamento cria o primeiro ciclo.'))
  } else {
    D.allCycles.forEach((c) => cycleCard.append(renderCycleRow(c)))
  }
  stack.append(cycleCard)

  page.append(stack)
  return page
}

// ── Conteúdo (jornadas oficiais) ─────────────────────────────────────────────

function renderTemplateStructure(templateId) {
  const box = el('div')
  box.append(el('p', 'card-error', ''))
  const status = el('p', null, 'Carregando estrutura…')
  status.style.cssText = 'font-size:.84rem;color:var(--muted);'
  box.append(status)

  getTrailTemplateWithModules(templateId).then(({ data: modules, error }) => {
    box.replaceChildren()
    if (error || !modules?.length) {
      box.append(el('p', 'card-error', 'Não foi possível carregar os módulos.'))
      return
    }
    const facts = []
    modules.forEach((m) => {
      const missions = (m.mission_templates ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((mt) => `${mt.position}. ${mt.title} (${mt.molde})`)
        .join(' · ')
      facts.push(fact(`Módulo ${m.position} — ${m.title}`, missions || 'sem missões'))
    })
    box.append(factList(facts))
  })
  return box
}

function renderTemplateRow(template) {
  const row = el('div', 'adm-row')
  const main = el('div', 'adm-row-main')

  const tx = el('div', 'adm-row-tx')
  tx.append(el('b', null, template.title ?? template.slug))
  const usage = D.templateUsage.get(template.id) ?? 0
  tx.append(el('span', null, [
    `v${template.version ?? 1}`,
    usage ? `${usage} ${usage === 1 ? 'jornada atribuída' : 'jornadas atribuídas'}` : 'nenhuma jornada atribuída',
  ].join(' · ')))
  main.append(tx)

  const side = el('div', 'adm-row-side')
  side.append(badgeOf(TEMPLATE_BADGE, template.status))
  main.append(side)
  row.append(main)

  if (template.description) {
    const desc = el('p', null, template.description)
    desc.style.cssText = 'margin-top:6px;font-size:.84rem;color:var(--ink-soft);'
    row.append(desc)
  }

  row.append(admDetails('Ver estrutura', renderTemplateStructure(template.id)))

  const errorBox = el('p', 'card-error')
  errorBox.hidden = true
  row.append(errorBox)

  const actions = el('div', 'row-actions')
  if (template.status === 'draft' || template.status === 'archived') {
    const publish = el('button', 'btn btn-primary', template.status === 'draft' ? 'Publicar' : 'Publicar novamente')
    publish.type = 'button'
    actions.append(publish)
    bindAction(publish, [publish], errorBox,
      () => setTrailTemplateStatus(template.id, 'published'),
      `Publicar "${template.title}"? Ela passa a aparecer como opção de jornada para os tutores.`)
  } else if (template.status === 'published') {
    const archive = el('button', 'btn btn-bad', 'Arquivar')
    archive.type = 'button'
    actions.append(archive)
    if (usage > 0) {
      // Arquivar um template com jornadas atribuídas apagaria módulos e
      // missões da tela de tutor/família/dispositivo NO MEIO do caminho —
      // o RLS do catálogo só libera 'published' pra esses papéis
      // por meio de can_read_trail_template. Bloqueio honesto.
      archive.disabled = true
      errorBox.textContent = `Não dá para arquivar: ${usage} ${usage === 1 ? 'jornada atribuída usa' : 'jornadas atribuídas usam'} esta trilha — arquivar a esconderia das famílias no meio do caminho.`
      errorBox.hidden = false
    } else {
      bindAction(archive, [archive], errorBox,
        () => setTrailTemplateStatus(template.id, 'archived'),
        `Arquivar "${template.title}"? Ela some das opções de jornada dos tutores (nenhuma jornada em andamento usa esta trilha).`)
    }
  }
  if (actions.children.length) row.append(actions)
  return row
}

function viewConteudo() {
  const page = el('div', 'adm-page')
  page.append(viewHead('Conteúdo oficial',
    'O catálogo de jornadas da Cognita. A autoria ainda é feita pela equipe via SQL — aqui se decide o que está publicado.'))

  const stack = el('div', 'adm-stack')
  const card = cardPad(el('p', 'kicker', 'Jornadas oficiais'))
  if (!D.templates.length) {
    card.append(admEmpty('Nenhuma jornada oficial cadastrada.',
      'As trilhas publicadas do catálogo aparecem aqui.'))
  } else {
    D.templates.forEach((t) => card.append(renderTemplateRow(t)))
  }
  stack.append(card)
  page.append(stack)
  return page
}

// ── Navegação e carga ────────────────────────────────────────────────────────

const VIEWS = { resumo: viewResumo, pessoas: viewPessoas, ciclos: viewCiclos, conteudo: viewConteudo }
const CRUMB = { resumo: 'Resumo', pessoas: 'Pessoas', ciclos: 'Ciclos', conteudo: 'Conteúdo' }

function render() {
  const box = $('[data-admin-state]')
  if (box) box.replaceChildren(VIEWS[activeView]())
  document.querySelectorAll('[data-view-link]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.viewLink === activeView)
  })
  const crumb = $('[data-crumb]')
  if (crumb) crumb.textContent = `Operação / ${CRUMB[activeView]}`
}

function switchView(view) {
  if (!VIEWS[view]) return
  activeView = view
  render()
  $('#main-content')?.scrollTo({ top: 0 })
}

async function loadAll() {
  const [
    waitingChildren, matchChildren, availableTutors,
    allChildren, allTutors, allCycles, templates, templateUsage,
  ] = await Promise.all([
    getChildrenWaitingReview(),
    getChildrenWaitingMatch(),
    getAvailableTutors(),
    getAllChildrenAdmin(),
    getAllTutorsAdmin(),
    getAllCyclesAdmin(),
    listTrailTemplatesAdmin(),
    getTrailTemplateUsage(),
  ])

  // Erros não derrubam o painel: cada área degrada pro seu vazio e o Resumo
  // lista o que falhou em "Precisa da sua atenção" (recarregar resolve o
  // transitório; persistindo, é policy).
  D = {
    pendingTutors: allTutors.error
      ? []
      : (allTutors.data ?? []).filter((tutor) => tutor.registration?.canReview),
    waitingChildren: waitingChildren.error ? [] : (waitingChildren.data ?? []),
    matchChildren: matchChildren.error ? [] : (matchChildren.data ?? []),
    availableTutors: availableTutors.error ? [] : (availableTutors.data ?? []),
    allChildren: allChildren.error ? [] : (allChildren.data ?? []),
    allTutors: allTutors.error ? [] : (allTutors.data ?? []),
    allCycles: allCycles.error ? [] : (allCycles.data ?? []),
    templates: templates.error ? [] : (templates.data ?? []),
    templateUsage: templateUsage.error ? new Map() : (templateUsage.data ?? new Map()),
    errors: [
      waitingChildren.error && 'Falha ao carregar cadastros em análise.',
      matchChildren.error && 'Falha ao carregar a fila de pareamento.',
      availableTutors.error && 'Falha ao carregar tutores aprovados.',
      allChildren.error && 'Falha ao carregar a lista de crianças.',
      allTutors.error && 'Falha ao carregar a lista de tutores.',
      allCycles.error && 'Falha ao carregar os ciclos.',
      templates.error && 'Falha ao carregar as jornadas oficiais.',
    ].filter(Boolean),
  }

  render()
}

function fillIdentity() {
  const rawName = session.profile?.name?.trim()
  const invalidNames = ['sem nome', 'admin', 'administrador']

  const name = rawName && !invalidNames.includes(rawName.toLowerCase())
    ? rawName
    : 'Central Cognita'

  const nameNode = $('[data-account-name]')
  if (nameNode) nameNode.textContent = name

  const setMascotAvatar = (node) => {
    if (!node) return

    const img = document.createElement('img')
    img.src = logoIconSrc
    img.alt = ''
    node.replaceChildren(img)
  }

  setMascotAvatar($('[data-account-avatar]'))
  setMascotAvatar($('[data-topbar-avatar]'))
}

async function boot() {
  if (!session) return
  fillIdentity()
  wireRailToggle()
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
  })
  document.querySelectorAll('[data-view-link]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.viewLink))
  })
  await loadAll()
}

boot()
