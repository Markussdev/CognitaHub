import { requireRole, signOut } from '../lib/auth.js'
import { el, initials } from '../lib/ui.js'
import { getActivities } from '../data/activities.js'

// ── Dados carregados do Supabase ─────────────────────────────────────────────
// Populados por loadActivities(); a grade não renderiza até que estejam prontos.

let ACTIVITIES = []
let SKILLS = []

const FORMATS = [
  { id: 'visual',      label: 'Visual' },
  { id: 'digital',     label: 'Digital' },
  { id: 'jogo',        label: 'Jogo' },
  { id: 'manipulavel', label: 'Manipulável' },
]

// ── Mapeamento DB → forma interna ────────────────────────────────────────────

function buildAgeArray(min, max) {
  const ages = []
  if (min <= 6 && max >= 5) ages.push('5-6')
  if (min <= 8 && max >= 7) ages.push('7-8')
  if (max >= 9) ages.push('9')
  return ages
}

function buildAgeLabel(min, max) {
  if (!min && !max) return ''
  if (min === max) return `${min} anos`
  return `${min}–${max} anos`
}

function mapActivity(a) {
  const skill = a.skills
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    skill: a.skill_id,
    skillLabel: skill?.label || a.skill_id,
    skillSortOrder: skill?.sort_order ?? 0,
    ages: buildAgeArray(a.age_min, a.age_max),
    ageLabel: buildAgeLabel(a.age_min, a.age_max),
    formats: a.formats || [],
    estimatedMinutes: a.estimated_minutes,
    level: a.level,
    carga: a.sensory_load,
    resumo_curto: a.summary_short,
    objetivo: a.objective,
    antesDeComecar: a.before_start,
    passosAtividade: a.steps || [],
    dizer: a.say || [],
    evitar: a.avoid || [],
    seDificil: a.if_difficult,
    seFacil: a.if_easy,
    sinalSucesso: a.success_signal,
    obsTEA: a.tea_note,
  }
}

function deriveSkills(activities) {
  const seen = new Map()
  activities.forEach((a) => {
    if (a.skill && !seen.has(a.skill)) {
      seen.set(a.skill, { id: a.skill, label: a.skillLabel, sort_order: a.skillSortOrder })
    }
  })
  return [...seen.values()].sort((a, b) => a.sort_order - b.sort_order)
}

async function loadActivities() {
  const { data, error } = await getActivities()
  if (error || !data?.length) {
    console.warn('Biblioteca: falha ao carregar atividades.', error)
    return
  }
  ACTIVITIES = data.map(mapActivity)
  SKILLS = deriveSkills(ACTIVITIES)
}

// ── Estado de filtro ─────────────────────────────────────────────────────────

const state = {
  skill: null,
  age: null,
  format: null,
  time: null,
  carga: null,
  query: '',
}

let session = null

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel)

function timeClass(mins) {
  if (mins <= 5) return 'curta'
  if (mins <= 10) return 'media'
  return 'longa'
}

function timeLabel(mins) {
  if (mins <= 5) return `${mins} min (curta)`
  if (mins <= 10) return `${mins} min (média)`
  return `${mins} min (longa)`
}

function levelBadge(level) {
  if (level === 'facil') return ['acb-ok', 'fácil']
  if (level === 'medio') return ['acb-warn', 'médio']
  return ['acb-bad', 'difícil']
}

function cargaBadge(carga) {
  return carga === 'baixa' ? ['acb-soft', 'carga baixa'] : ['acb-warn', 'carga média']
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

function svgClock() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  s.setAttribute('viewBox', '0 0 24 24')
  s.innerHTML = '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>'
  return s
}

function svgFormats(formats) {
  const icons = {
    visual: '<circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>',
    digital: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    jogo: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 8h.01m-8 8h.01m0-8h.01m8 8h.01"/>',
    manipulavel: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8l-1.8-1.8a2 2 0 0 0-2.83 2.83L5 17.66A8 8 0 0 0 12 22h2a8 8 0 0 0 8-8V8a2 2 0 0 0-4 0v3"/>',
  }
  return formats.map((f) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    s.setAttribute('viewBox', '0 0 24 24')
    s.innerHTML = icons[f] || ''
    s.setAttribute('title', f)
    return s
  })
}

// ── URL params — contexto de criança vindo do tutor ─────────────────────────

const _params = new URLSearchParams(location.search)
const CTX_CHILD    = _params.get('child') || ''      // nome da criança
const CTX_CHILD_ID = _params.get('child_id') || ''   // id da criança
const CTX_CYCLE    = _params.get('cycle_id') || ''   // id do ciclo
const CTX_SKILL    = _params.get('skill') || ''      // habilidade a pré-filtrar

// ── Identidade do rail ───────────────────────────────────────────────────────

const ROLE_LABELS = { tutor: 'Tutor', guardian: 'Responsável', admin: 'Equipe Cognita' }
const ROLE_HOME   = { tutor: 'tutor.html', guardian: 'responsavel.html', admin: 'admin.html' }

async function loadIdentity() {
  session = await requireRole('tutor', 'guardian', 'admin')
  if (!session) return

  const { profile, user } = session
  const name = profile.name || user.email || 'Usuário'
  const role = profile.role
  const homeHref = ROLE_HOME[role] || 'login.html'

  const set = (sel, val) => { const n = $(sel); if (n) n.textContent = val }
  set('[data-account-name]', name)
  set('[data-account-role]', ROLE_LABELS[role] || role)
  set('[data-rail-role]', ROLE_LABELS[role] || role)
  $('[data-account-avatar]') && ($('[data-account-avatar]').textContent = initials(name))
  $('[data-topbar-avatar]') && ($('[data-topbar-avatar]').textContent = initials(name))

  // Início → home da role
  const homeLink = $('[data-rail-home]')
  if (homeLink) homeLink.href = homeHref

  // Acompanhamento — mostra se há contexto de criança
  const acmpGroup = $('[data-rail-acomp-group]')
  const childSlot = $('[data-rail-child-slot]')
  if (CTX_CHILD && acmpGroup && childSlot) {
    acmpGroup.hidden = false
    const link = el('a', 'rail-link')
    link.href = CTX_CYCLE ? `${homeHref}?cycle_id=${CTX_CYCLE}` : homeHref
    link.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>`
    link.append(document.createTextNode(CTX_CHILD))
    childSlot.replaceChildren(link)
  }

  // Sessões → volta para tutor com tab sessions
  const sessLink = $('[data-rail-sessions]')
  if (sessLink) {
    sessLink.addEventListener('click', (e) => {
      e.preventDefault()
      window.location.href = CTX_CYCLE
        ? `${homeHref}?tab=sessions&cycle_id=${CTX_CYCLE}`
        : `${homeHref}?tab=sessions`
    })
  }

  // Meu perfil → abre a view de perfil no painel
  $('[data-rail-profile]')?.addEventListener('click', (e) => {
    e.preventDefault()
    window.location.href = 'tutor.html?view=profile'
  })

  // Suporte
  $('[data-rail-team]')?.addEventListener('click', (e) => {
    e.preventDefault()
    openSupportDrawer()
  })

  // Logout
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
  })
}

// ── Suporte drawer ───────────────────────────────────────────────────────────

function buildSupportBody() {
  const frag = document.createDocumentFragment()

  if (CTX_CHILD) {
    const ctx = el('div', 'support-context')
    ctx.append(document.createTextNode('Sobre: '), el('b', null, CTX_CHILD))
    frag.append(ctx)
  }

  frag.append(el('p', null, 'Quando algo sair do esperado, a equipe está aqui. Fale direto ou deixe uma mensagem.'))

  const msgField = el('div', 'field')
  const lbl = document.createElement('label')
  lbl.textContent = 'Mensagem para a equipe'
  const ta = document.createElement('textarea')
  ta.placeholder = 'Descreva a situação com o máximo de detalhes possível…'
  msgField.append(lbl, ta)
  frag.append(msgField)

  frag.append(el('div', 'support-divider'))

  frag.append(el('p', null, 'Para algo urgente, fale direto. Tempo médio de resposta: até 48h.'))
  const actions = el('div', 'support-actions')
  const mail = el('a', 'btn-outline', 'Enviar e-mail')
  mail.href = `mailto:equipecognita@email.com?subject=${encodeURIComponent(CTX_CHILD ? `Ajuda no ciclo de ${CTX_CHILD}` : 'Ajuda no Cognita Hub')}`
  const whats = el('a', 'btn-outline', 'WhatsApp')
  whats.href = 'https://wa.me/5500000000000'
  whats.target = '_blank'; whats.rel = 'noopener'
  actions.append(mail, whats)
  frag.append(actions)

  return frag
}

function openSupportDrawer() {
  const body = $('[data-support-body]')
  const drawer = $('[data-support-drawer]')
  const backdrop = $('[data-support-backdrop]')
  if (!body || !drawer || !backdrop) return
  body.replaceChildren(buildSupportBody())
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

function closeSupportDrawer() {
  $('[data-support-drawer]')?.classList.remove('open')
  $('[data-support-backdrop]')?.classList.remove('open')
  $('[data-support-drawer]')?.setAttribute('aria-hidden', 'true')
}

// ── Filtros ──────────────────────────────────────────────────────────────────

function renderFilters() {
  const container = $('#lib-filters')
  if (!container) return
  container.innerHTML = ''

  if (!SKILLS.length) return

  const chip = (label, isOn, onClick, small = false) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = (small ? 'fchip-sm' : 'fchip') + (isOn ? ' on' : '')
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
  }

  // ── Eixo principal: Habilidade ──
  const secLbl1 = el('span', 'filter-section-label', 'Habilidade')
  const row1 = el('div', 'filter-row')
  row1.append(chip('Todas', state.skill === null, () => { state.skill = null; update() }))
  SKILLS.forEach((s) => {
    row1.append(chip(s.label, state.skill === s.id, () => {
      state.skill = state.skill === s.id ? null : s.id
      update()
    }))
  })

  const sep = el('div', 'filter-sep')

  // ── Filtros secundários ──
  const secLbl2 = el('span', 'filter-section-label', 'Filtros')
  const row2 = el('div', 'filter-secondary-row')

  const grpIdade = el('div', 'filter-sec-group')
  ;['5-6', '7-8', '9'].forEach((age) => {
    const label = age === '9' ? '9 anos' : `${age.replace('-', '–')} anos`
    grpIdade.append(chip(label, state.age === age, () => {
      state.age = state.age === age ? null : age; update()
    }, true))
  })

  const div1 = el('div', 'filter-sec-divider')

  const grpFmt = el('div', 'filter-sec-group')
  FORMATS.forEach((f) => {
    grpFmt.append(chip(f.label, state.format === f.id, () => {
      state.format = state.format === f.id ? null : f.id; update()
    }, true))
  })

  const div2 = el('div', 'filter-sec-divider')

  const grpTempo = el('div', 'filter-sec-group')
  ;[['curta', '≤ 5 min'], ['media', '5–10 min'], ['longa', '> 10 min']].forEach(([id, label]) => {
    grpTempo.append(chip(label, state.time === id, () => {
      state.time = state.time === id ? null : id; update()
    }, true))
  })

  const div3 = el('div', 'filter-sec-divider')

  const grpCarga = el('div', 'filter-sec-group')
  ;[['baixa', 'Carga baixa'], ['media', 'Carga média']].forEach(([id, label]) => {
    grpCarga.append(chip(label, state.carga === id, () => {
      state.carga = state.carga === id ? null : id; update()
    }, true))
  })

  row2.append(grpIdade, div1, grpFmt, div2, grpTempo, div3, grpCarga)

  container.append(secLbl1, row1, sep, secLbl2, row2)
}

// ── Grade ────────────────────────────────────────────────────────────────────

function filterActivities() {
  const q = state.query.toLowerCase().trim()
  return ACTIVITIES.filter((a) => {
    if (state.skill && a.skill !== state.skill) return false
    if (state.age && !a.ages.includes(state.age)) return false
    if (state.format && !a.formats.includes(state.format)) return false
    if (state.time && timeClass(a.estimatedMinutes) !== state.time) return false
    if (state.carga && a.carga !== state.carga) return false
    if (q && !a.title.toLowerCase().includes(q) && !a.skillLabel.toLowerCase().includes(q)) return false
    return true
  })
}

function buildCard(a) {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'activity-card'
  card.setAttribute('aria-label', `Abrir roteiro: ${a.title}`)

  const skill = el('span', 'ac-skill', a.skillLabel)
  const title = el('div', 'ac-title', a.title)
  const summary = el('p', 'ac-summary', a.resumo_curto || '')

  const meta = el('div', 'ac-meta')
  const clockItem = el('div', 'ac-meta-item')
  clockItem.append(svgClock())
  clockItem.append(document.createTextNode(` ${a.estimatedMinutes} min`))
  const fmtItem = el('div', 'ac-meta-item')
  svgFormats(a.formats).forEach((s) => fmtItem.append(s))
  meta.append(clockItem, fmtItem)

  const chips = el('div', 'ac-chips')
  const [lvcls, lvlabel] = levelBadge(a.level)
  chips.append(el('span', `acb ${lvcls}`, lvlabel))
  const [ccls, clabel] = cargaBadge(a.carga)
  chips.append(el('span', `acb ${ccls}`, clabel))
  chips.append(el('span', 'acb acb-soft', a.ageLabel))

  const footer = el('div', 'ac-footer')
  const openBtn = el('button', 'btn-ghost-sm', 'Ver roteiro')
  openBtn.type = 'button'
  openBtn.setAttribute('aria-hidden', 'true')
  openBtn.tabIndex = -1
  footer.append(openBtn)

  card.append(skill, title, summary, meta, chips, footer)
  card.addEventListener('click', () => openDrawer(a))
  return card
}

function renderGrid() {
  const grid = $('#lib-grid')
  if (!grid) return
  grid.innerHTML = ''

  const visible = filterActivities()

  if (!ACTIVITIES.length) {
    const empty = el('div', 'lib-empty')
    empty.append(
      el('strong', null, 'Nenhuma atividade disponível'),
      el('span', null, 'As atividades serão carregadas assim que o banco de dados estiver conectado.'),
    )
    grid.append(empty)
    return
  }

  if (!visible.length) {
    const empty = el('div', 'lib-empty')
    empty.append(
      el('strong', null, 'Nenhuma atividade com esses filtros'),
      el('span', null, 'Tente afrouxar um filtro ou limpar a busca.'),
    )
    const resetBtn = el('button', 'btn-ghost-sm', 'Limpar filtros')
    resetBtn.type = 'button'
    resetBtn.addEventListener('click', resetFilters)
    empty.append(resetBtn)
    grid.append(empty)
    return
  }

  visible.forEach((a) => grid.append(buildCard(a)))
}

function resetFilters() {
  state.skill = null
  state.age = null
  state.format = null
  state.time = null
  state.carga = null
  state.query = ''
  const searchInput = $('#lib-search')
  if (searchInput) searchInput.value = ''
  update()
}

function update() {
  renderFilters()
  renderGrid()
}

// ── Gaveta ───────────────────────────────────────────────────────────────────

function section(labelText, ...children) {
  const wrap = el('div', 'ds')
  wrap.append(el('span', 'ds-label', labelText))
  children.forEach((c) => {
    if (typeof c === 'string') {
      const p = el('p'); p.textContent = c; wrap.append(p)
    } else {
      wrap.append(c)
    }
  })
  return wrap
}

function buildDrawerHead(a) {
  const wrap = document.createElement('div')
  const h2 = el('h2', null, a.title)
  const chips = el('div', 'ac-chips')
  chips.style.marginTop = '6px'
  const [lvcls, lvlabel] = levelBadge(a.level)
  chips.append(el('span', `acb ${lvcls}`, lvlabel))
  const [ccls, clabel] = cargaBadge(a.carga)
  chips.append(el('span', `acb ${ccls}`, clabel))
  chips.append(el('span', 'acb acb-soft', a.ageLabel))
  chips.append(el('span', 'acb acb-soft', timeLabel(a.estimatedMinutes)))
  wrap.append(h2, chips)
  return wrap
}

function buildDrawerBody(a) {
  const body = document.createElement('div')

  const objWrap = el('div', 'ds')
  objWrap.append(el('span', 'ds-label', 'Objetivo'))
  objWrap.append(el('div', 'ds-obj', a.objetivo))
  body.append(objWrap)

  body.append(section('Antes de começar', a.antesDeComecar))

  const stepWrap = el('div', 'ds')
  stepWrap.append(el('span', 'ds-label', 'Passo a passo'))
  const ol = document.createElement('ol')
  ;(a.passosAtividade || []).forEach((step) => { const li = el('li'); li.textContent = step; ol.append(li) })
  stepWrap.append(ol)
  body.append(stepWrap)

  const sayWrap = el('div', 'ds')
  sayWrap.append(el('span', 'ds-label', 'O que dizer'))
  const sayList = el('div', 'ds-say')
  ;(a.dizer || []).forEach((d) => sayList.append(el('div', 'ds-say-item', `"${d}"`)))
  sayWrap.append(sayList)
  body.append(sayWrap)

  const avoidWrap = el('div', 'ds')
  avoidWrap.append(el('span', 'ds-label', 'O que evitar'))
  const avoidList = el('div', 'ds-avoid')
  ;(a.evitar || []).forEach((v) => avoidList.append(el('div', 'ds-avoid-item', v)))
  avoidWrap.append(avoidList)
  body.append(avoidWrap)

  body.append(el('div', 'ad-sep'))

  const adapt = el('div', 'ds-adapt')
  const hard = el('div', 'ds-adapt-box hard')
  hard.append(el('span', 'lbl', 'Se difícil'))
  hard.append(el('p', null, a.seDificil))
  const easy = el('div', 'ds-adapt-box easy')
  easy.append(el('span', 'lbl', 'Se fácil'))
  easy.append(el('p', null, a.seFacil))
  adapt.append(hard, easy)
  body.append(adapt)

  const sigWrap = el('div', 'ds')
  sigWrap.style.marginTop = '16px'
  sigWrap.append(el('span', 'ds-label', 'Sinal de sucesso'))
  sigWrap.append(el('div', 'ds-signal', a.sinalSucesso))
  body.append(sigWrap)

  if (a.obsTEA) {
    const obsWrap = el('div', 'ds')
    obsWrap.append(el('span', 'ds-label', 'Nota TEA / acessibilidade'))
    obsWrap.append(el('div', 'ds-obs', a.obsTEA))
    body.append(obsWrap)
  }

  return body
}

function buildDrawerFooter(a) {
  const frag = document.createDocumentFragment()

  const useBtn = el('button', 'btn-brand-sm', 'Usar no registro')
  useBtn.type = 'button'
  useBtn.addEventListener('click', () => {
    // Passa o UUID real da atividade via URL param — tutor.js busca no banco
    window.location.href = 'tutor.html?activity=' + encodeURIComponent(a.id)
  })

  const childBtn = el('button', 'btn-disabled', '')
  childBtn.type = 'button'
  const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lockSvg.setAttribute('viewBox', '0 0 24 24')
  lockSvg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  childBtn.append(lockSvg, document.createTextNode('Abrir no Modo Criança — em breve'))
  childBtn.title = 'Disponível em versão futura'

  frag.append(useBtn, childBtn)
  return frag
}

function openDrawer(a) {
  const drawer = $('#act-drawer')
  const backdrop = $('#drawer-backdrop')
  const headContent = $('#ad-head-content')
  const body = $('#ad-body')
  const footer = $('#ad-footer')
  if (!drawer || !backdrop || !headContent || !body || !footer) return

  headContent.innerHTML = ''
  body.innerHTML = ''
  footer.innerHTML = ''

  headContent.append(buildDrawerHead(a))
  body.append(buildDrawerBody(a))
  footer.append(buildDrawerFooter(a))

  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')

  $('#drawer-close')?.focus()
}

function closeDrawer() {
  const drawer = $('#act-drawer')
  const backdrop = $('#drawer-backdrop')
  if (!drawer || !backdrop) return
  drawer.classList.remove('open')
  backdrop.classList.remove('open')
  drawer.setAttribute('aria-hidden', 'true')
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // Esqueleto
  const grid = $('#lib-grid')
  if (grid) {
    const skel = el('div', 'lib-empty')
    skel.append(el('span', null, 'Carregando atividades…'))
    grid.replaceChildren(skel)
  }

  await loadIdentity()
  await loadActivities()

  // Pré-filtro de habilidade vindo do tutor
  if (CTX_SKILL && SKILLS.some((s) => s.id === CTX_SKILL)) {
    state.skill = CTX_SKILL
  }

  // Banner de contexto de criança
  const ctxBanner = $('#lib-context')
  const ctxLabel = $('#lib-context-label')
  const ctxClear = $('#lib-context-clear')
  if (CTX_CHILD && ctxBanner && ctxLabel) {
    ctxLabel.textContent = `Atividades para ${CTX_CHILD}`
    ctxBanner.classList.add('visible')
    ctxClear?.addEventListener('click', () => {
      ctxBanner.classList.remove('visible')
      // Remove params da URL sem recarregar
      const clean = location.pathname + location.hash
      history.replaceState({}, '', clean)
    })
  }

  update()

  $('#lib-search')?.addEventListener('input', (e) => {
    state.query = e.target.value
    renderGrid()
  })

  // Gaveta de atividade
  $('#drawer-close')?.addEventListener('click', closeDrawer)
  $('#drawer-backdrop')?.addEventListener('click', closeDrawer)

  // Suporte
  $('[data-support-close]')?.addEventListener('click', closeSupportDrawer)
  $('[data-support-backdrop]')?.addEventListener('click', closeSupportDrawer)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); closeSupportDrawer() }
  })
}

init()
