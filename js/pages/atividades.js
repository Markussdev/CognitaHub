import { requireRole } from '../lib/auth.js'
import { el, initials } from '../lib/ui.js'

// ── Dados de atividades (mock — espelha tabela `activities` do §9) ──────────

const SKILLS = [
  { id: 'reconhecer-numeros',   label: 'Reconhecer números' },
  { id: 'contar-1-1',           label: 'Contar 1:1' },
  { id: 'comparar-quantidades', label: 'Comparar quantidades' },
  { id: 'correspondencia',      label: 'Número ↔ quantidade' },
]

const FORMATS = [
  { id: 'visual',      label: 'Visual' },
  { id: 'digital',     label: 'Digital' },
  { id: 'jogo',        label: 'Jogo' },
  { id: 'manipulavel', label: 'Manipulável' },
]

const ACTIVITIES = [
  {
    id: 'a1',
    title: 'Toque no número',
    skill: 'reconhecer-numeros',
    skillLabel: 'Reconhecer números',
    ages: ['5-6', '7-8'],
    ageLabel: '5–8 anos',
    formats: ['visual', 'digital'],
    estimatedMinutes: 5,
    level: 'facil',
    carga: 'baixa',
    objetivo: 'A criança identifica e nomeia os algarismos de 1 a 10 de forma independente.',
    antesDeComecar: 'Prepare uma tela (tablet ou computador) com números grandes visíveis. Certifique-se de que o ambiente está tranquilo. Se possível, use fones de ouvido para bloquear ruído externo.',
    passosAtividade: [
      'Mostre o número na tela e diga o nome em voz alta ("Este é o quatro!").',
      'Peça à criança para repetir o nome e tocar o número na tela.',
      'Mude para o próximo número somente quando ela tocar com confiança.',
      'Após 5 números, faça uma rodada de revisão: "Qual é este?".',
      'Celebre cada acerto com um sinal combinado (joinha, bater palmas).',
    ],
    dizer: ['"Muito bem! Esse é o número…"', '"Mostre-me onde está o três."', '"Você conseguiu! Próximo!"'],
    evitar: ['Corrigi-la em voz alta na frente de outras pessoas.', 'Avançar rápido demais sem consolidar o número anterior.', 'Usar números menores que 60px na tela — ela pode não enxergar bem.'],
    seDificil: 'Reduza para 3 números por sessão. Coloque um adesivo físico com o número ao lado do ecrã como referência.',
    seFacil: 'Inclua números de 11 a 20. Peça para ela escrever o número no ar enquanto o toca.',
    sinalSucesso: 'A criança nomeia o número antes de tocar, sem esperar a sua dica.',
    obsTEA: 'Evite temporizador sonoro — o sinal auditivo pode criar ansiedade. Prefira feedback visual (borda verde na tela).',
  },
  {
    id: 'a2',
    title: 'Conte os dinossauros',
    skill: 'contar-1-1',
    skillLabel: 'Contar 1:1',
    ages: ['5-6', '7-8'],
    ageLabel: '5–8 anos',
    formats: ['visual', 'jogo', 'digital'],
    estimatedMinutes: 8,
    level: 'medio',
    carga: 'media',
    objetivo: 'A criança conta objetos de 1 em 1, tocando cada item apenas uma vez, e informa o total corretamente.',
    antesDeComecar: 'Use 10 figurinhas de dinossauros (ou qualquer objeto favorito da criança) alinhadas em fileira. Garanta que a superfície está limpa e não tem outros objetos por perto.',
    passosAtividade: [
      'Coloque 3 dinossauros na fileira. Conte junto com a criança, tocando um por um.',
      'Peça à criança para contar sozinha: "Quantos dinossauros tem?".',
      'Anote o resultado. Se correto, adicione 2 mais e repita.',
      'Se errar, reorganize e conte junto devagar antes de pedir que ela tente.',
      'Siga até 10 objetos ou até a criança demonstrar cansaço.',
    ],
    dizer: ['"Um… dois… três! Muito bem!"', '"Agora é a sua vez — conta para mim."', '"Que número você chegou?"'],
    evitar: ['Mexer nos objetos enquanto ela conta.', 'Passar para um número maior antes de ela acertar o atual 2 vezes seguidas.', 'Elogiar só o resultado final — elogie também o processo de tocar um por um.'],
    seDificil: 'Reduza para 5 objetos e use cores diferentes para facilitar o rastreio visual. Conte batendo levemente na mesa enquanto toca.',
    seFacil: 'Use dois grupos separados e peça para ela dizer qual tem mais. Integre com "Comparar quantidades".',
    sinalSucesso: 'A criança conta sem pular nem repetir itens e responde o total sem re-contar.',
    obsTEA: 'A mudança de objeto (um brinquedo favorito vs. blocos genéricos) pode interromper a concentração. Mantenha o mesmo objeto por toda a sessão.',
  },
  {
    id: 'a3',
    title: 'Onde tem mais?',
    skill: 'comparar-quantidades',
    skillLabel: 'Comparar quantidades',
    ages: ['7-8', '9'],
    ageLabel: '7–9 anos',
    formats: ['visual', 'digital'],
    estimatedMinutes: 7,
    level: 'medio',
    carga: 'baixa',
    objetivo: 'A criança distingue "mais" e "menos" comparando dois grupos de até 10 elementos.',
    antesDeComecar: 'Prepare pares de imagens ou cartões com grupos de pontos (ex.: 4 pontos vs. 7 pontos). Apresente um par por vez para não sobrecarregar.',
    passosAtividade: [
      'Mostre dois grupos de pontos lado a lado e pergunte: "Qual tem mais?".',
      'Aguarde a resposta sem ajudar. Se errar, conte juntos e compare.',
      'Mude para um par com diferença menor (ex.: 5 vs. 6) após 3 acertos consecutivos.',
      'Introduza a palavra "menos": "Qual tem menos dinossauros?".',
      'Finalize com um par onde os grupos são iguais — pergunte se é igual.',
    ],
    dizer: ['"Conta este grupo… agora conta este. Qual é maior?"', '"E se eu perguntar qual tem menos?"', '"São iguais ou diferentes?"'],
    evitar: ['Usar pontos muito pequenos (abaixo de 20px cada).', 'Apresentar mais de dois grupos ao mesmo tempo.', 'Perguntar "quanto a mais tem?" sem que ela já domine "qual tem mais".'],
    seDificil: 'Use diferenças de pelo menos 3 entre os grupos. Coloque os objetos fisicamente em duas fileiras para contar com o dedo.',
    seFacil: 'Peça para ela ordenar 3 grupos do menor ao maior. Introduza o sinal > e <.',
    sinalSucesso: 'A criança responde "mais" ou "menos" corretamente sem precisar re-contar, para diferenças de 2 ou mais.',
    obsTEA: 'Evite fundo com padrões ou texturas nas imagens — use fundo branco sólido para reduzir distração visual.',
  },
  {
    id: 'a4',
    title: 'Leve os peixes para o aquário',
    skill: 'correspondencia',
    skillLabel: 'Número ↔ quantidade',
    ages: ['5-6', '7-8'],
    ageLabel: '5–8 anos',
    formats: ['manipulavel', 'jogo', 'digital'],
    estimatedMinutes: 12,
    level: 'medio',
    carga: 'media',
    objetivo: 'A criança associa um numeral escrito à quantidade correta de objetos físicos (1:1 com rótulo numérico).',
    antesDeComecar: 'Prepare cartões com os números 1 a 5 e fichas ou figurinhas de peixe (pode ser papel). Separe "aquários" (caixinhas ou círculos no papel) identificados com um número cada.',
    passosAtividade: [
      'Coloque os aquários numerados na mesa (1, 2 e 3 primeiro).',
      'Mostre uma quantidade de peixes (ex.: 2) e diga: "Esses peixes querem ir para a casa número dois.".',
      'A criança coloca os peixes no aquário com o número correto.',
      'Confirme contando juntos: "Um, dois — certo! O aquário dois tem dois peixes.".',
      'Adicione os números 4 e 5 conforme avança.',
    ],
    dizer: ['"Quantos peixes você tem na mão?"', '"Onde fica o aquário com esse número?"', '"Conta os peixes dentro para ver se está certo."'],
    evitar: ['Deixar os cartões misturados na mesa — organize em sequência crescente.', 'Avançar para 4 e 5 antes de consolidar 1, 2, 3.', 'Usar objetos muito pequenos que caem e distraem.'],
    seDificil: 'Trabalhe só com 1 e 2. Use dois aquários bem separados no espaço (um perto, um longe) para reforçar a diferença.',
    seFacil: 'Estenda até o número 10. Peça para ela montar o aquário da memória (sem ver o número enquanto pega os peixes).',
    sinalSucesso: 'A criança distribui os peixes corretamente sem contar em voz alta, demonstrando reconhecimento direto.',
    obsTEA: 'Se peixes de papel não fizerem sentido, substitua pelo objeto de interesse dela (carrinhos, estrelas). O tema é irrelevante — o vínculo numeral↔quantidade é o objetivo.',
  },
]

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

function initials2(name) { return initials(name) }

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

// ── Identidade do rail ───────────────────────────────────────────────────────

async function loadIdentity() {
  session = await requireRole('tutor', 'guardian', 'admin')
  if (!session) return

  const { profile, user } = session
  const name = profile.name || user.email || 'Usuário'
  const role = profile.role

  const roleLabels = { tutor: 'Tutor', guardian: 'Responsável', admin: 'Equipe Cognita' }
  const roleHome = { tutor: 'tutor.html', guardian: 'responsavel.html', admin: 'admin.html' }

  const acctName = $('[data-account-name]')
  const acctRole = $('[data-account-role]')
  const acctAv = $('[data-account-avatar]')
  const topAv = $('[data-topbar-avatar]')
  const railRole = $('[data-rail-role]')
  const backLink = $('[data-rail-back]')

  if (acctName) acctName.textContent = name
  if (acctRole) acctRole.textContent = roleLabels[role] || role
  if (acctAv) acctAv.textContent = initials2(name)
  if (topAv) topAv.textContent = initials2(name)
  if (railRole) railRole.textContent = roleLabels[role] || role
  if (backLink) backLink.setAttribute('href', roleHome[role] || 'login.html')
}

// ── Filtros ──────────────────────────────────────────────────────────────────

function renderFilters() {
  const container = $('#lib-filters')
  if (!container) return
  container.innerHTML = ''

  const makeFchip = (label, isOn, onClick) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'fchip' + (isOn ? ' on' : '')
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
  }

  // Habilidade (primário)
  const row1 = el('div', 'filter-row')
  const lbl1 = el('span', 'filter-row-label', 'Habilidade')
  row1.append(lbl1)
  row1.append(makeFchip('Todas', state.skill === null, () => { state.skill = null; update() }))
  SKILLS.forEach((s) => {
    row1.append(makeFchip(s.label, state.skill === s.id, () => {
      state.skill = state.skill === s.id ? null : s.id
      update()
    }))
  })

  const sep = el('div', 'filter-sep')

  // Faixa etária
  const row2 = el('div', 'filter-row')
  const lbl2 = el('span', 'filter-row-label', 'Idade')
  row2.append(lbl2)
  ;['5-6', '7-8', '9'].forEach((age) => {
    const label = age === '9' ? '9 anos' : `${age.replace('-', '–')} anos`
    row2.append(makeFchip(label, state.age === age, () => {
      state.age = state.age === age ? null : age
      update()
    }))
  })

  // Formato
  const lbl3 = el('span', 'filter-row-label', 'Formato')
  row2.append(lbl3)
  FORMATS.forEach((f) => {
    row2.append(makeFchip(f.label, state.format === f.id, () => {
      state.format = state.format === f.id ? null : f.id
      update()
    }))
  })

  // Tempo + carga
  const row3 = el('div', 'filter-row')
  const lbl4 = el('span', 'filter-row-label', 'Tempo')
  row3.append(lbl4)
  ;[['curta', '≤ 5 min'], ['media', '5–10 min'], ['longa', '> 10 min']].forEach(([id, label]) => {
    row3.append(makeFchip(label, state.time === id, () => {
      state.time = state.time === id ? null : id
      update()
    }))
  })

  const lbl5 = el('span', 'filter-row-label', 'Carga')
  row3.append(lbl5)
  ;[['baixa', 'Baixa'], ['media', 'Média']].forEach(([id, label]) => {
    row3.append(makeFchip(label, state.carga === id, () => {
      state.carga = state.carga === id ? null : id
      update()
    }))
  })

  container.append(row1, sep, row2, row3)
}

// ── Grade ────────────────────────────────────────────────────────────────────

function filterActivities() {
  const q = state.query.toLowerCase().trim()
  return ACTIVITIES.filter((a) => {
    if (state.skill && a.skill !== state.skill) return false
    if (state.age && !a.ages.includes(state.age)) return false
    if (state.format && !a.formats.includes(state.format)) return false
    if (state.time) {
      const tc = timeClass(a.estimatedMinutes)
      if (tc !== state.time) return false
    }
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

  card.append(skill, title, meta, chips, footer)
  card.addEventListener('click', () => openDrawer(a))
  return card
}

function renderGrid() {
  const grid = $('#lib-grid')
  if (!grid) return
  grid.innerHTML = ''

  const visible = filterActivities()

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

function textNode(str) { return document.createTextNode(str) }

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

  // Objetivo
  const objWrap = el('div', 'ds')
  objWrap.append(el('span', 'ds-label', 'Objetivo'))
  const obj = el('div', 'ds-obj', a.objetivo)
  objWrap.append(obj)
  body.append(objWrap)

  // Antes de começar
  body.append(section('Antes de começar', a.antesDeComecar))

  // Passo a passo
  const stepWrap = el('div', 'ds')
  stepWrap.append(el('span', 'ds-label', 'Passo a passo'))
  const ol = document.createElement('ol')
  a.passosAtividade.forEach((step) => { const li = el('li'); li.textContent = step; ol.append(li) })
  stepWrap.append(ol)
  body.append(stepWrap)

  // O que dizer
  const sayWrap = el('div', 'ds')
  sayWrap.append(el('span', 'ds-label', 'O que dizer'))
  const sayList = el('div', 'ds-say')
  a.dizer.forEach((d) => sayList.append(el('div', 'ds-say-item', `"${d}"`)))
  sayWrap.append(sayList)
  body.append(sayWrap)

  // O que evitar
  const avoidWrap = el('div', 'ds')
  avoidWrap.append(el('span', 'ds-label', 'O que evitar'))
  const avoidList = el('div', 'ds-avoid')
  a.evitar.forEach((v) => avoidList.append(el('div', 'ds-avoid-item', v)))
  avoidWrap.append(avoidList)
  body.append(avoidWrap)

  // Adaptações (side-by-side)
  const sep = el('div', 'ad-sep')
  body.append(sep)

  const adapt = el('div', 'ds-adapt')
  const hard = el('div', 'ds-adapt-box hard')
  hard.append(el('span', 'lbl', 'Se difícil'))
  hard.append(el('p', null, a.seDificil))
  const easy = el('div', 'ds-adapt-box easy')
  easy.append(el('span', 'lbl', 'Se fácil'))
  easy.append(el('p', null, a.seFacil))
  adapt.append(hard, easy)
  body.append(adapt)

  // Sinal de sucesso
  const sigWrap = el('div', 'ds')
  sigWrap.style.marginTop = '16px'
  sigWrap.append(el('span', 'ds-label', 'Sinal de sucesso'))
  const sig = el('div', 'ds-signal', a.sinalSucesso)
  sigWrap.append(sig)
  body.append(sigWrap)

  // Nota TEA
  if (a.obsTEA) {
    const obsWrap = el('div', 'ds')
    obsWrap.append(el('span', 'ds-label', 'Nota TEA / acessibilidade'))
    const obs = el('div', 'ds-obs', a.obsTEA)
    obsWrap.append(obs)
    body.append(obsWrap)
  }

  return body
}

function buildDrawerFooter(a) {
  const frag = document.createDocumentFragment()
  const addBtn = el('button', 'btn-brand-sm', 'Adicionar ao plano')
  addBtn.type = 'button'
  addBtn.style.cssText = 'height:34px;padding:0 16px;font-size:.84rem;border-radius:var(--r-sm);'
  addBtn.addEventListener('click', () => {
    addBtn.textContent = 'Adicionado!'
    addBtn.disabled = true
    setTimeout(() => { addBtn.textContent = 'Adicionar ao plano'; addBtn.disabled = false }, 2200)
  })

  const childBtn = el('button', 'btn-disabled', '')
  childBtn.type = 'button'
  const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lockSvg.setAttribute('viewBox', '0 0 24 24')
  lockSvg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  childBtn.append(lockSvg, document.createTextNode('Modo Criança'))
  childBtn.title = 'Disponível em versão futura'

  frag.append(addBtn, childBtn)
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

  const closeBtn = $('#drawer-close')
  if (closeBtn) closeBtn.focus()
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
  await loadIdentity()

  update()

  const searchInput = $('#lib-search')
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.query = e.target.value
      renderGrid()
    })
  }

  $('#drawer-close')?.addEventListener('click', closeDrawer)
  $('#drawer-backdrop')?.addEventListener('click', closeDrawer)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer()
  })
}

init()
