import { requireRole, signOut } from '../lib/auth.js'
import { el, initials } from '../lib/ui.js'
import { getAvatarUrl, setAvatarImage } from '../lib/avatar.js'
import { wireRailToggle } from '../lib/rail.js'
import { getActivities } from '../data/activities.js'
import { hasDigitalPreset } from '../data/digital-presets.js'
import { canOpenActivityGuide, openActivityGuide } from '../components/activity-guide.js'

// ── Papel de cada área (não duplicar responsabilidade) ───────────────────────
// Biblioteca = conteúdo-base e inspiração da Cognita. NÃO guarda o que o
// tutor criou (isso é Atividades/child_activities) — oferece matéria-prima:
// "No Modo Criança" personaliza pra virar uma child_activity real (ponte
// ?preset=<slug> pro assistente de Atividades em tutor.js); "Com o tutor"
// conduz uma atividade guiada e devolve o observado pra Sessões.

// ── Humaniza o catálogo — slug nunca aparece na UI ────────────────────────
// Client-side de propósito: garante rótulo limpo mesmo se o embed
// activities→skills falhar por RLS (skills.label viraria null e o mapeamento
// anterior caía pro slug cru — era isso que aparecia nos cards).
const SKILL_LABELS = {
  'reconhecer-numeros': 'Reconhecimento de números',
  'contar-1-1': 'Contagem um a um',
  'comparar-quantidades': 'Comparação de quantidades',
  'correspondencia': 'Correspondência número-quantidade',
}
const SKILL_ORDER = ['reconhecer-numeros', 'contar-1-1', 'comparar-quantidades', 'correspondencia']
const SKILL_EMOJI = {
  'reconhecer-numeros': '🔢',
  'contar-1-1': '🦕',
  'comparar-quantidades': '⚖️',
  'correspondencia': '🐠',
}
const FORMAT_REASON = {
  visual: 'usa apoio visual',
  digital: 'é digital',
  jogo: 'tem formato de jogo',
  manipulavel: 'usa objetos manipuláveis',
}

const FORMATS = [
  { id: 'visual', label: 'Visual' },
  { id: 'digital', label: 'Digital' },
  { id: 'jogo', label: 'Jogo' },
  { id: 'manipulavel', label: 'Manipulável' },
]

// ── Dados carregados do Supabase ─────────────────────────────────────────────

let ACTIVITIES = []

function buildAgeLabel(min, max) {
  if (!min && !max) return ''
  if (min === max) return `${min} anos`
  return `${min}–${max} anos`
}

function mapActivity(a) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    skill: a.skill_id,
    skillLabel: SKILL_LABELS[a.skill_id] || a.skill_id,
    ageMin: a.age_min,
    ageMax: a.age_max,
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
    path: hasDigitalPreset(a.slug) ? 'digital' : 'guiada',
  }
}

async function loadActivities() {
  const { data, error } = await getActivities()
  if (error || !data?.length) {
    console.warn('Biblioteca: falha ao carregar atividades.', error)
    return
  }
  ACTIVITIES = data.map(mapActivity)
}

// ── URL params — contexto de criança vindo do tutor ─────────────────────────

const _params = new URLSearchParams(location.search)
const CTX_CHILD    = _params.get('child') || ''
const CTX_CHILD_ID = _params.get('child_id') || ''
const CTX_CYCLE    = _params.get('cycle_id') || ''
const CTX_AGE      = _params.get('age') ? Number(_params.get('age')) : null
const CTX_FOCUS    = (_params.get('focus') || '').split(',').filter(Boolean)
const CTX_PREF     = (_params.get('pref') || '').split(',').filter(Boolean)
const CTX_SKILL    = _params.get('skill') || '' // legado, ainda honrado se vier

// ── Estado de filtro ─────────────────────────────────────────────────────────

const state = { path: 'todas', skill: null, age: null, format: null, time: null, carga: null, query: '' }
let session = null

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel)

function timeClass(mins) {
  if (mins <= 5) return 'curta'
  if (mins <= 10) return 'media'
  return 'longa'
}

function levelBadge(level) {
  if (level === 'facil') return ['acb-ok', 'fácil']
  if (level === 'medio') return ['acb-warn', 'médio']
  return ['acb-bad', 'difícil']
}

function cargaBadge(carga) {
  return carga === 'baixa' ? ['acb-soft', 'carga baixa'] : ['acb-warn', 'carga média']
}

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

function buildTutorPresetUrl(slug) {
  return `tutor.html?${new URLSearchParams({ view: 'record', tab: 'activities', preset: slug })}`
}

function primaryActionLabel(a) {
  if (a.path === 'digital') return CTX_CHILD ? `Personalizar para ${CTX_CHILD}` : 'Personalizar'
  return CTX_CHILD ? `Conduzir com ${CTX_CHILD}` : 'Conduzir atividade'
}

function primaryActionDisabled(a) {
  return a.path === 'digital' && !CTX_CHILD_ID
}

function startActivity(a) {
  if (a.path === 'digital') {
    if (!CTX_CHILD_ID) return
    window.location.href = buildTutorPresetUrl(a.slug)
    return
  }
  openConducao(a)
}

function openGuide(a) {
  closeDrawer()
  openActivityGuide(a, {
    icon: SKILL_EMOJI[a.skill] || '✨',
    startLabel: primaryActionLabel(a),
    startDisabled: primaryActionDisabled(a),
    startDisabledReason: primaryActionDisabled(a)
      ? 'Abra a Biblioteca a partir do painel de um acompanhamento para personalizar.'
      : '',
    onStart: startActivity,
  })
}

// ── Identidade do rail ───────────────────────────────────────────────────────

const ROLE_LABELS = { tutor: 'Tutor', guardian: 'Responsável', admin: 'Equipe Cognita' }
const ROLE_HOME   = { tutor: 'tutor.html', guardian: 'responsavel.html', admin: 'admin.html' }

async function loadIdentity() {
  try {
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

    if (profile.avatar_path) {
      const url = await getAvatarUrl(profile.avatar_path)
      if (url) {
        setAvatarImage('[data-account-avatar]', url)
        setAvatarImage('[data-topbar-avatar]', url)
      }
    }

    const homeLink = $('[data-rail-home]')
    if (homeLink) homeLink.href = homeHref

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

    const sessLink = $('[data-rail-sessions]')
    if (sessLink) {
      sessLink.addEventListener('click', (e) => {
        e.preventDefault()
        window.location.href = CTX_CYCLE
          ? `${homeHref}?tab=sessions&cycle_id=${CTX_CYCLE}`
          : `${homeHref}?tab=sessions`
      })
    }

    $('[data-rail-profile]')?.addEventListener('click', (e) => {
      e.preventDefault()
      const back = encodeURIComponent(location.pathname + location.search)
      window.location.href = `tutor.html?view=profile&return=${back}`
    })

    $('[data-rail-team]')?.addEventListener('click', (e) => {
      e.preventDefault()
      openSupportDrawer()
    })

    document.querySelectorAll('[data-logout]').forEach((btn) => {
      btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
    })
  } catch (error) {
    console.warn('Biblioteca: erro ao carregar identidade.', error)
  }
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
  mail.href = `mailto:cognitahub1@gmail.com?subject=${encodeURIComponent(CTX_CHILD ? `Ajuda no ciclo de ${CTX_CHILD}` : 'Ajuda no Cognita Hub')}`
  const whats = el('a', 'btn-outline', 'WhatsApp')
  whats.href = 'https://wa.me/559182050907'
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

// ── Recomendadas — regra explícita, sem IA ───────────────────────────────────
// Pontua com sinais que o tutor já vê no painel (foco do ciclo, preferência
// de formato, idade, duração, carga sensorial) e explica o motivo por
// extenso. Nunca força recomendação sem pelo menos um motivo real — sem
// contexto de criança (ou sem nenhum sinal batendo), a seção some.

function scoreActivity(a) {
  const reasons = []
  let score = 0
  if (CTX_FOCUS.includes(a.skill)) { score += 3; reasons.push(`trabalha ${a.skillLabel.toLowerCase()}`) }
  if (CTX_AGE != null && a.ageMin != null && a.ageMax != null && CTX_AGE >= a.ageMin && CTX_AGE <= a.ageMax) score += 1
  const prefHit = CTX_PREF.find((f) => a.formats.includes(f))
  if (prefHit && FORMAT_REASON[prefHit]) { score += 1; reasons.push(FORMAT_REASON[prefHit]) }
  if (a.estimatedMinutes <= 10) { score += 1; reasons.push(`dura só ${a.estimatedMinutes} min`) }
  if (a.carga === 'baixa') { score += 1; reasons.push('tem carga sensorial baixa') }
  return { score, reasons: reasons.slice(0, 3) }
}

// Só UMA recomendação principal — com 4 atividades no catálogo, mostrar 3
// vira "quase tudo é recomendado" e a palavra perde sentido. A destacada some
// da grade abaixo enquanto a navegação estiver no estado padrão (ver
// isDefaultLibraryView) — filtrar ou buscar já muda a intenção do tutor, aí
// ela pode reaparecer normalmente entre os resultados.
let featuredActivityId = null

// .lib-featured (o <section> em si, ver #lib-recommended no HTML) é quem
// tem display:grid com 3 colunas — por isso devolve um fragment com 3
// filhos diretos, não um <div> envolvendo os três (isso viraria 1 item de
// grid só, colapsando as colunas).
function buildFeaturedActivity(a, reasons) {
  const frag = document.createDocumentFragment()
  frag.append(el('div', 'lib-featured-icon', SKILL_EMOJI[a.skill] || '✨'))

  const mid = el('div')
  mid.append(el('div', 'lib-featured-eyebrow', 'Recomendada'))
  mid.append(el('h2', null, a.title))
  mid.append(el('p', 'lib-featured-summary', a.resumo_curto || ''))
  const meta = el('div', 'lib-featured-meta')
  meta.append(el('span', null, a.ageLabel), el('span', null, `${a.estimatedMinutes} min`))
  mid.append(meta)
  frag.append(mid)

  const reason = el('div', 'lib-featured-reason')
  reason.append(el('span', null, 'Por que'))
  reason.append(el('p', null, `Recomendada porque ${reasons.join(', ')}.`))
  const actions = el('div', 'lib-featured-actions')
  actions.append(buildPrimaryCta(a))
  const hasGuide = canOpenActivityGuide(a)
  const roteiro = el('button', 'btn-ghost-sm', hasGuide ? 'Conhecer atividade' : 'Ver roteiro')
  roteiro.type = 'button'
  roteiro.addEventListener('click', () => hasGuide ? openGuide(a) : openDrawer(a))
  actions.append(roteiro)
  reason.append(actions)
  frag.append(reason)

  return frag
}

function renderRecommended() {
  const host = $('#lib-recommended')
  if (!host) return

  if (!CTX_CHILD_ID || !ACTIVITIES.length) { host.hidden = true; featuredActivityId = null; return }

  const scored = ACTIVITIES
    .map((a) => ({ a, ...scoreActivity(a) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)

  const top = scored[0]
  if (!top) { host.hidden = true; featuredActivityId = null; return }

  host.hidden = false
  featuredActivityId = top.a.id
  host.replaceChildren(buildFeaturedActivity(top.a, top.reasons))
}

// ── Caminhos (Todas / No Modo Criança / Com o tutor) ─────────────────────────

const PATHS = [
  { id: 'todas', label: 'Todas' },
  { id: 'digital', label: 'No Modo Criança' },
  { id: 'guiada', label: 'Com o tutor' },
]

function renderPaths() {
  const container = $('#lib-modes')
  if (!container) return
  container.replaceChildren()
  PATHS.forEach(({ id, label }) => {
    const n = id === 'todas' ? ACTIVITIES.length : ACTIVITIES.filter((a) => a.path === id).length
    const btn = el('button', `lib-mode${state.path === id ? ' is-active' : ''}`)
    btn.type = 'button'
    btn.append(document.createTextNode(label + ' '), el('span', 'n', `(${n})`))
    btn.addEventListener('click', () => { state.path = id; update() })
    container.append(btn)
  })
}

// Botão "Filtros" é markup estático em atividades.html (#lib-filters-toggle)
// agora — antes era recriado a cada render() só pra carregar o estado
// on/off, sem necessidade (o painel inteiro de filtros já esconde/mostra
// via classe; o botão só precisa refletir o mesmo booleano).
let _filtersOpen = false
function renderFiltersToggleState() {
  $('#lib-filters')?.classList.toggle('open', _filtersOpen)
  $('#lib-filters-toggle')?.classList.toggle('on', _filtersOpen)
}

// ── Filtros secundários (recolhidos por padrão) ──────────────────────────────

function renderFilters() {
  const container = $('#lib-filters')
  if (!container) return
  container.replaceChildren()

  const chip = (label, isOn, onClick) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'fchip-sm' + (isOn ? ' on' : '')
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
  }

  const row = el('div', 'filter-secondary-row')

  const grpSkill = el('div', 'filter-sec-group')
  SKILL_ORDER.forEach((skillId) => {
    if (!ACTIVITIES.some((a) => a.skill === skillId)) return
    grpSkill.append(chip(SKILL_LABELS[skillId], state.skill === skillId, () => {
      state.skill = state.skill === skillId ? null : skillId; update()
    }))
  })
  row.append(grpSkill, el('div', 'filter-sec-divider'))

  const grpIdade = el('div', 'filter-sec-group')
  ;['5-6', '7-8', '9'].forEach((age) => {
    const label = age === '9' ? '9 anos' : `${age.replace('-', '–')} anos`
    grpIdade.append(chip(label, state.age === age, () => { state.age = state.age === age ? null : age; update() }))
  })
  row.append(grpIdade, el('div', 'filter-sec-divider'))

  const grpFmt = el('div', 'filter-sec-group')
  FORMATS.forEach((f) => {
    grpFmt.append(chip(f.label, state.format === f.id, () => { state.format = state.format === f.id ? null : f.id; update() }))
  })
  row.append(grpFmt, el('div', 'filter-sec-divider'))

  const grpTempo = el('div', 'filter-sec-group')
  ;[['curta', '≤ 5 min'], ['media', '5–10 min'], ['longa', '> 10 min']].forEach(([id, label]) => {
    grpTempo.append(chip(label, state.time === id, () => { state.time = state.time === id ? null : id; update() }))
  })
  row.append(grpTempo, el('div', 'filter-sec-divider'))

  const grpCarga = el('div', 'filter-sec-group')
  ;[['baixa', 'Carga baixa'], ['media', 'Carga média']].forEach(([id, label]) => {
    grpCarga.append(chip(label, state.carga === id, () => { state.carga = state.carga === id ? null : id; update() }))
  })
  row.append(grpCarga)

  container.append(row)
}

function matchesAgeBucket(a, bucket) {
  if (bucket === '5-6') return a.ageMin <= 6 && a.ageMax >= 5
  if (bucket === '7-8') return a.ageMin <= 8 && a.ageMax >= 7
  if (bucket === '9') return a.ageMax >= 9
  return true
}

// ── Grade ────────────────────────────────────────────────────────────────────

function filterActivities() {
  const q = state.query.toLowerCase().trim()
  return ACTIVITIES.filter((a) => {
    if (state.path !== 'todas' && a.path !== state.path) return false
    if (state.skill && a.skill !== state.skill) return false
    if (state.age && !matchesAgeBucket(a, state.age)) return false
    if (state.format && !a.formats.includes(state.format)) return false
    if (state.time && timeClass(a.estimatedMinutes) !== state.time) return false
    if (state.carga && a.carga !== state.carga) return false
    if (q && !a.title.toLowerCase().includes(q) && !a.skillLabel.toLowerCase().includes(q)) return false
    return true
  })
}

// CTA primário — o destino muda pelo caminho da atividade, nunca "Abrir no
// Modo Criança — em breve": o Modo Criança já existe, então a ponte é real.
function buildPrimaryCta(a) {
  if (a.path === 'digital') {
    const btn = el('a', 'activity-primary-action', primaryActionLabel(a))
    if (primaryActionDisabled(a)) {
      btn.setAttribute('aria-disabled', 'true')
      btn.title = 'Abra a Biblioteca a partir do painel de um acompanhamento pra personalizar.'
      btn.addEventListener('click', (e) => e.preventDefault())
    } else {
      btn.href = buildTutorPresetUrl(a.slug)
    }
    return btn
  }
  const btn = el('button', 'activity-primary-action', primaryActionLabel(a))
  btn.type = 'button'
  btn.addEventListener('click', () => startActivity(a))
  return btn
}

// <article>, não <button> com botões dentro — o card é um item de conteúdo
// com ações internas focáveis, não um controle único.
function buildCard(a) {
  const card = document.createElement('article')
  card.className = 'activity-card'

  card.append(el('div', 'activity-card-icon', SKILL_EMOJI[a.skill] || '✨'))

  const body = el('div', 'activity-card-body')
  body.append(el('span', `activity-mode ${a.path}`, a.path === 'digital' ? 'No Modo Criança' : 'Com o tutor'))
  body.append(el('h3', null, a.title))
  body.append(el('p', 'activity-card-description', a.resumo_curto || ''))

  const meta = el('div', 'activity-card-meta')
  ;[a.ageLabel, `${a.estimatedMinutes} min`, a.carga === 'baixa' ? 'Carga baixa' : 'Carga média']
    .filter(Boolean)
    .forEach((text) => meta.append(el('span', null, text)))
  body.append(meta)

  const actions = el('div', 'activity-card-actions')
  const hasGuide = canOpenActivityGuide(a)
  const details = el('button', 'activity-details-link', hasGuide ? 'Conhecer atividade' : 'Ver roteiro')
  details.type = 'button'
  details.addEventListener('click', () => hasGuide ? openGuide(a) : openDrawer(a))
  actions.append(details, buildPrimaryCta(a))
  body.append(actions)

  card.append(body)
  return card
}

// Estado padrão = nenhum filtro/busca ativo. Só nesse estado a destacada
// some da grade (senão o tutor filtrando por "Com o tutor" veria uma
// atividade digital sumir sem explicação — ela deve voltar a aparecer
// normalmente assim que a navegação deixa de ser a aterrissagem inicial).
function isDefaultLibraryView() {
  return state.path === 'todas' && !state.skill && !state.age && !state.format
    && !state.time && !state.carga && !state.query.trim()
}

function renderGrid() {
  const grid = $('#lib-grid')
  if (!grid) return
  grid.replaceChildren()

  let visible = filterActivities()
  if (isDefaultLibraryView() && featuredActivityId) {
    visible = visible.filter((a) => a.id !== featuredActivityId)
  }

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
  state.skill = null; state.age = null; state.format = null; state.time = null; state.carga = null; state.query = ''
  const searchInput = $('#lib-search')
  if (searchInput) searchInput.value = ''
  update()
}

function update() {
  renderPaths()
  renderFiltersToggleState()
  renderFilters()
  renderGrid()
}

// ── Gaveta de roteiro ────────────────────────────────────────────────────────

function section(labelText, ...children) {
  const wrap = el('div', 'ds')
  wrap.append(el('span', 'ds-label', labelText))
  children.forEach((c) => {
    if (typeof c === 'string') { const p = el('p'); p.textContent = c; wrap.append(p) }
    else wrap.append(c)
  })
  return wrap
}

function buildDrawerHead(a) {
  const wrap = document.createElement('div')
  const h2 = el('h2', null, a.title)
  const chips = el('div', 'ac-chips')
  chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;'
  const [lvcls, lvlabel] = levelBadge(a.level)
  chips.append(el('span', `acb ${lvcls}`, lvlabel))
  const [ccls, clabel] = cargaBadge(a.carga)
  chips.append(el('span', `acb ${ccls}`, clabel))
  chips.append(el('span', 'acb acb-soft', a.ageLabel))
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
  frag.append(buildPrimaryCta(a))
  const closeBtn = el('button', 'btn-ghost-sm', 'Fechar')
  closeBtn.type = 'button'
  closeBtn.addEventListener('click', closeDrawer)
  frag.append(closeBtn)
  return frag
}

function openDrawer(a) {
  const drawer = $('#act-drawer')
  const backdrop = $('#drawer-backdrop')
  const headContent = $('#ad-head-content')
  const body = $('#ad-body')
  const footer = $('#ad-footer')
  if (!drawer || !backdrop || !headContent || !body || !footer) return

  headContent.replaceChildren(buildDrawerHead(a))
  body.replaceChildren(buildDrawerBody(a))
  footer.replaceChildren(buildDrawerFooter(a))

  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
  $('#drawer-close')?.focus()
}

function closeDrawer() {
  $('#act-drawer')?.classList.remove('open')
  $('#drawer-backdrop')?.classList.remove('open')
  $('#act-drawer')?.setAttribute('aria-hidden', 'true')
}

// ── Modo Condução — atividade "Com o tutor" ──────────────────────────────────
// Prepare → Conduza (passo a passo + frases, Adapte embutido como atalho não
// sequencial) → Finalize → "Registrar como foi" leva pra Sessões com o que
// foi observado. Handoff por sessionStorage (js/pages/tutor.js lê e some).

const CND_STAGES = ['preparar', 'conduzir', 'finalizar']
const CND_LABELS = { preparar: 'Preparar', conduzir: 'Conduzir', finalizar: 'Finalizar' }

let cnd = null

function openConducao(a) {
  cnd = {
    activity: a, stage: 'preparar', currentStep: 0,
    startedAt: null, showHard: false, showEasy: false,
    sinalMarcado: false, observacao: '',
  }
  $('#cnd-overlay').hidden = false
  document.body.classList.add('rail-drawer-open') // reusa o travamento de scroll do body
  renderConducao()
}

function closeConducao() {
  cnd = null
  $('#cnd-overlay').hidden = true
  document.body.classList.remove('rail-drawer-open')
}

function cndGoStage(stage) {
  cnd.stage = stage
  if (stage === 'conduzir' && !cnd.startedAt) cnd.startedAt = Date.now()
  renderConducao()
}

function renderConducao() {
  const a = cnd.activity
  $('#cnd-title').textContent = a.title
  const stageIdx = CND_STAGES.indexOf(cnd.stage)
  $('#cnd-sub').textContent = `Passo ${stageIdx + 1} de ${CND_STAGES.length} — ${CND_LABELS[cnd.stage]}`

  const steps = $('#cnd-steps')
  steps.replaceChildren()
  CND_STAGES.forEach((st, i) => {
    const item = el('span', `cnd-step${st === cnd.stage ? ' is-current' : i < stageIdx ? ' is-done' : ''}`)
    item.append(el('span', 'cnd-step-dot', i < stageIdx ? '✓' : String(i + 1)))
    item.append(document.createTextNode(CND_LABELS[st]))
    steps.append(item)
  })

  const inner = $('#cnd-inner')
  inner.replaceChildren()
  if (cnd.stage === 'preparar') inner.append(cndRenderPreparar(a))
  else if (cnd.stage === 'conduzir') inner.append(cndRenderConduzir(a))
  else inner.append(cndRenderFinalizar(a))

  $('#cnd-nav').replaceChildren(cndRenderNav())
}

function cndRenderPreparar(a) {
  const box = el('div', 'cnd-block')
  box.append(el('div', 'cnd-q', 'Antes de começar'))
  box.append(el('p', 'cnd-hint', 'Materiais e organização — leia antes de chamar a criança.'))
  const card = el('div', 'cnd-card')
  card.append(el('p', null, a.antesDeComecar || 'Sem preparação específica.'))
  box.append(card)
  return box
}

function cndRenderConduzir(a) {
  const box = el('div', 'cnd-block')

  const stepsCard = el('div', 'cnd-card')
  stepsCard.append(el('div', 'cnd-q', 'Um passo por vez'))
  const list = el('div', 'cnd-steplist')
  ;(a.passosAtividade || []).forEach((step, i) => {
    const item = el('div', `cnd-steplist-item${i === cnd.currentStep ? ' is-current' : ''}`)
    item.append(el('span', 'cnd-steplist-num', i < cnd.currentStep ? '✓' : String(i + 1)))
    item.append(document.createTextNode(step))
    list.append(item)
  })
  stepsCard.append(list)
  if (cnd.currentStep < (a.passosAtividade || []).length - 1) {
    const nextBtn = el('button', 'btn-ghost-sm', 'Próximo passo →')
    nextBtn.type = 'button'
    nextBtn.style.marginTop = '12px'
    nextBtn.addEventListener('click', () => { cnd.currentStep += 1; renderConducao() })
    stepsCard.append(nextBtn)
  }
  box.append(stepsCard)

  if (a.dizer?.length) {
    const sayCard = el('div', 'cnd-card')
    sayCard.append(el('div', 'cnd-q', 'Frases para usar'))
    const sayWrap = el('div', 'ds-say')
    a.dizer.forEach((d) => sayWrap.append(el('div', 'cnd-say-item', `"${d}"`)))
    sayCard.append(sayWrap)
    box.append(sayCard)
  }

  const adaptCard = el('div', 'cnd-card')
  adaptCard.append(el('div', 'cnd-q', 'Adapte na hora'))
  const row = el('div', 'cnd-adapt-row')
  const hardBtn = el('button', 'btn-ghost-sm', 'Está difícil')
  hardBtn.type = 'button'
  hardBtn.addEventListener('click', () => { cnd.showHard = !cnd.showHard; renderConducao() })
  const easyBtn = el('button', 'btn-ghost-sm', 'Está fácil')
  easyBtn.type = 'button'
  easyBtn.addEventListener('click', () => { cnd.showEasy = !cnd.showEasy; renderConducao() })
  row.append(hardBtn, easyBtn)
  adaptCard.append(row)
  if (cnd.showHard) adaptCard.append(el('div', 'cnd-adapt-reveal', a.seDificil))
  if (cnd.showEasy) adaptCard.append(el('div', 'cnd-adapt-reveal', a.seFacil))
  box.append(adaptCard)

  return box
}

function cndRenderFinalizar(a) {
  const box = el('div', 'cnd-block')

  const signalLabel = el('label', 'cnd-signal-toggle')
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = cnd.sinalMarcado
  cb.addEventListener('change', () => { cnd.sinalMarcado = cb.checked })
  const tx = el('span')
  tx.append(el('strong', null, 'Sinal de sucesso: '), document.createTextNode(a.sinalSucesso || ''))
  signalLabel.append(cb, tx)
  box.append(signalLabel)

  const field = el('div', 'cnd-field')
  field.append(el('label', null, 'Alguma observação? (opcional)'))
  const ta = document.createElement('textarea')
  ta.value = cnd.observacao
  ta.placeholder = 'Como foi na prática — vira nota interna no registro da sessão.'
  ta.addEventListener('input', () => { cnd.observacao = ta.value })
  field.append(ta)
  box.append(field)

  const elapsed = cnd.startedAt ? Math.max(1, Math.round((Date.now() - cnd.startedAt) / 60000)) : null
  if (elapsed != null) box.append(el('p', 'cnd-hint', `Duração observada: ${elapsed} min — você pode ajustar no registro.`))

  return box
}

function cndRenderNav() {
  const nav = document.createDocumentFragment()
  const stageIdx = CND_STAGES.indexOf(cnd.stage)

  const left = el('div')
  if (stageIdx > 0) {
    const back = el('button', 'btn-ghost-sm', 'Voltar')
    back.type = 'button'
    back.addEventListener('click', () => cndGoStage(CND_STAGES[stageIdx - 1]))
    left.append(back)
  }
  nav.append(left)

  if (stageIdx < CND_STAGES.length - 1) {
    const next = el('button', 'btn-brand-sm', stageIdx === 0 ? 'Começar' : 'Concluir e finalizar')
    next.type = 'button'
    next.addEventListener('click', () => cndGoStage(CND_STAGES[stageIdx + 1]))
    nav.append(next)
  } else {
    const save = el('button', 'btn-brand-sm', 'Registrar como foi')
    save.type = 'button'
    save.addEventListener('click', cndSaveAndBridge)
    nav.append(save)
  }
  return nav
}

function cndSaveAndBridge() {
  const a = cnd.activity
  const elapsed = cnd.startedAt ? Math.max(1, Math.round((Date.now() - cnd.startedAt) / 60000)) : null
  const observacaoInterna = [
    cnd.sinalMarcado && a.sinalSucesso ? `Demonstrou: ${a.sinalSucesso}.` : '',
    cnd.observacao.trim(),
  ].filter(Boolean).join(' ')

  sessionStorage.setItem('cognita:conducao-result', JSON.stringify({
    activityId: a.id,
    title: a.title,
    focus: a.skillLabel,
    durationMinutes: elapsed,
    observacaoInterna,
    nextStep: '',
  }))

  closeConducao()
  window.location.href = 'tutor.html?view=record&tab=sessions'
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  const grid = $('#lib-grid')
  if (grid) {
    const skel = el('div', 'lib-empty')
    skel.append(el('span', null, 'Carregando atividades…'))
    grid.replaceChildren(skel)
  }

  const results = await Promise.allSettled([loadIdentity(), loadActivities()])
  if (results[0].status === 'rejected') console.warn('Biblioteca: falha ao carregar identidade.', results[0].reason)
  if (results[1].status === 'rejected') console.warn('Biblioteca: falha ao carregar atividades.', results[1].reason)

  if (CTX_SKILL && SKILL_LABELS[CTX_SKILL]) { state.skill = CTX_SKILL; _filtersOpen = true }

  const ctxBadge = $('#lib-context')
  const ctxLabel = $('#lib-context-label')
  if (CTX_CHILD && ctxBadge && ctxLabel) {
    ctxLabel.textContent = CTX_AGE != null ? `${CTX_CHILD} · ${CTX_AGE} anos` : CTX_CHILD
    ctxBadge.hidden = false
    const subtitle = $('#lib-subtitle')
    if (subtitle) subtitle.textContent = `Encontre uma experiência pronta, adapte para ${CTX_CHILD} e escolha como ela será aplicada.`
  }

  renderRecommended()
  update()
  wireRailToggle()

  $('#lib-search')?.addEventListener('input', (e) => { state.query = e.target.value; renderGrid() })
  $('#lib-filters-toggle')?.addEventListener('click', () => { _filtersOpen = !_filtersOpen; renderFiltersToggleState() })

  $('#drawer-close')?.addEventListener('click', closeDrawer)
  $('#drawer-backdrop')?.addEventListener('click', closeDrawer)

  $('#cnd-cancel')?.addEventListener('click', closeConducao)

  $('[data-support-close]')?.addEventListener('click', closeSupportDrawer)
  $('[data-support-backdrop]')?.addEventListener('click', closeSupportDrawer)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); closeSupportDrawer(); if (cnd) closeConducao() }
  })
}

init()
