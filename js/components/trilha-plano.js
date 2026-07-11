import { el } from '../lib/ui.js'
import { MOLDES_REGISTRO, formatConfigResumo } from '../data/moldes-registro.js'
import { STATUS_ETAPA } from '../data/planos-registro.js'

// Componente puro: não importa supabase, não conhece ciclo, não navega.
// Recebe o plano + status já calculados e devolve um elemento (só mapa +
// painel de detalhes — título/progresso/voltar são do shell da página que
// usa isto, ver js/pages/trilha.js). Quem chama decide quando "Preparar
// atividade" bloqueia (podePreparar) e o que fazer com a etapa escolhida
// (onPrepararEtapa → prefillFromPlano/bridge de URL em tutor.js).

// Caminhos relativos a pages/trilha.html (único lugar que carrega este
// componente) — mesmo padrão de `img.src = '../assets/...'` já usado em
// tutor.js, não import de módulo Vite.
const EMBLEMA_BASE = '../assets/trilha/emblemas/'
const ESPACO_BASE = '../assets/trilha/espaco/'

const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Posições dos 5 nós — espelha os seletores :nth-child em css/trilha.css.
// Mapa alto (~1250px) de propósito: a trilha é uma página que se percorre,
// não um diagrama que precisa caber inteiro na viewport (ver feedback do
// Marcus, 2026-07-11 — "o Duolingo funciona porque é uma página, não um
// diagrama espremido").
const NODE_POSICOES = [
  { x: 50, y: 8 },
  { x: 68, y: 27 },
  { x: 32, y: 46 },
  { x: 68, y: 64 },
  { x: 50, y: 80 },
]

// 4 segmentos (não um path único) pra poder colorir cada trecho por estado
// — concluído / atual / futuro — em vez de um caminho de cor única.
const SEGMENTOS_D = [
  'M200,80 C100,170 320,220 272,290',
  'M272,290 C220,380 60,420 128,500',
  'M128,500 C200,580 340,640 272,710',
  'M272,710 C220,800 120,860 200,920',
]

// Decoração espacial (Fase C→revisão) — composição hierárquica, não 9
// stickers uniformes: 1 planeta grande cortado no topo, elementos médios/
// pequenos no meio, 1 planeta médio-grande cortado perto da etapa final.
const DECORACAO_ESPACIAL = [
  { src: 'planeta-roxo', x: '-10%', y: '-5%', size: 210, opacity: 0.3 },
  { src: 'estrelas-2', x: '80%', y: '10%', size: 34, opacity: 0.55 },
  { src: 'lua', x: '88%', y: '34%', size: 58, opacity: 0.4 },
  { src: 'cometa', x: '2%', y: '42%', size: 74, opacity: 0.4 },
  { src: 'estrelas-3', x: '8%', y: '62%', size: 30, opacity: 0.5 },
  { src: 'planeta-amarelo', x: '82%', y: '88%', size: 170, opacity: 0.35 },
]

export function renderTrilhaPlano({ plano, statuses, podePreparar, onPrepararEtapa }) {
  let currentStatuses = statuses
  let etapaSelecionadaId = null
  // Só trava a seleção do tutor depois de um clique real — enquanto isso,
  // cada render() (inclusive quando o status real chega do Supabase) pode
  // reapontar pra etapa certa, em vez de ficar preso na 1ª etapa (seleção-
  // padrão antes do status carregar).
  let selecaoManual = false
  const nodeButtons = new Map()

  const wrap = el('div', 'trail-body')

  const mapWrap = el('div', 'trail-map')

  const pathSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  pathSvg.setAttribute('class', 'trail-path')
  pathSvg.setAttribute('viewBox', '0 0 400 1000')
  pathSvg.setAttribute('preserveAspectRatio', 'none')
  pathSvg.setAttribute('aria-hidden', 'true')
  const segmentPaths = SEGMENTOS_D.map((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('class', 'trail-path-seg')
    pathSvg.append(path)
    return path
  })
  mapWrap.append(pathSvg)

  const decoLayer = el('div', 'trail-deco-layer')
  decoLayer.innerHTML = DECORACAO_ESPACIAL.map(({ src, x, y, size, opacity }) => (
    `<img class="trail-deco" src="${ESPACO_BASE}${src}.webp" alt="" aria-hidden="true" style="left:${x};top:${y};width:${size}px;height:${size}px;opacity:${opacity};" />`
  )).join('')
  mapWrap.append(decoLayer)

  const nodesLayer = el('div', 'trail-nodes')
  mapWrap.append(nodesLayer)

  const details = el('div', 'trail-details')
  // Backdrop só é visível/clicável no mobile (ver css/trilha.css) — no
  // desktop o painel de detalhes já fica estático ao lado do mapa, "abrir"/
  // "fechar" não faz sentido lá.
  const detailsBackdrop = el('div', 'trail-details-backdrop')
  detailsBackdrop.addEventListener('click', () => closeSheet())

  wrap.append(mapWrap, details, detailsBackdrop)

  function openSheet() {
    details.classList.add('is-open')
    detailsBackdrop.classList.add('is-open')
  }
  function closeSheet() {
    details.classList.remove('is-open')
    detailsBackdrop.classList.remove('is-open')
  }

  function statusFor(i) {
    return currentStatuses?.[i] || (i === 0 ? 'em_andamento' : 'a_fazer')
  }

  // "Atual" = a primeira etapa ainda não concluída — decide o nó maior
  // (trail-step--current) mesmo quando duas etapas estão tecnicamente
  // "em_andamento" ao mesmo tempo (o tutor preparou mais de uma adiantado).
  function currentIndex() {
    const idx = plano.etapas.findIndex((_, i) => statusFor(i) !== 'concluida')
    return idx
  }

  function renderPath(currentIdx) {
    segmentPaths.forEach((path, i) => {
      // segmento i liga o nó i ao nó i+1 — o estado do segmento segue o nó
      // de destino (i+1): concluído se o destino já foi concluído, atual se
      // o destino é a etapa em foco, futuro nos demais casos.
      const destStatus = statusFor(i + 1)
      const state = destStatus === 'concluida' ? 'concluida' : (i + 1 === currentIdx ? 'atual' : 'futuro')
      path.setAttribute('class', `trail-path-seg trail-path-seg--${state}`)
    })
  }

  function renderNodes(currentIdx) {
    nodesLayer.replaceChildren()
    nodeButtons.clear()
    plano.etapas.forEach((etapa, i) => {
      const status = statusFor(i)
      const isCurrent = i === currentIdx
      const pos = NODE_POSICOES[i] || NODE_POSICOES[NODE_POSICOES.length - 1]
      const cls = `trail-step trail-step--${status}${isCurrent ? ' trail-step--current' : ''}`
      const btn = el('button', cls)
      btn.type = 'button'
      btn.style.setProperty('--trail-x', `${pos.x}%`)
      btn.style.setProperty('--trail-y', `${pos.y}%`)
      btn.dataset.etapaId = etapa.id
      btn.setAttribute('aria-label', `Etapa ${i + 1}: ${etapa.titulo} — ${STATUS_ETAPA[status].label}`)

      const badge = el('span', 'trail-step-badge')
      const emblemImg = el('img', 'trail-emblem-img')
      emblemImg.src = `${EMBLEMA_BASE}${etapa.emblema}.webp`
      emblemImg.alt = ''
      badge.append(emblemImg)
      btn.append(badge)

      if (status === 'concluida') {
        const check = el('span', 'trail-step-check')
        check.innerHTML = CHECK_SVG
        btn.append(check)
      }

      btn.addEventListener('click', () => selectEtapa(etapa.id, { porUsuario: true }))
      nodesLayer.append(btn)
      nodeButtons.set(etapa.id, btn)
    })
  }

  function renderDetails(etapa) {
    details.replaceChildren()
    if (!etapa) return
    const i = plano.etapas.findIndex((e) => e.id === etapa.id)
    const status = statusFor(i)
    const info = STATUS_ETAPA[status]

    const closeBtn = el('button', 'trail-details-close', '✕')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Fechar detalhes da etapa')
    closeBtn.addEventListener('click', () => closeSheet())
    details.append(closeBtn)

    const head = el('div', 'trail-details-head')
    head.append(el('h4', null, etapa.titulo))
    head.append(el('span', `trail-status-pill trail-status-pill--${status}`, info.label))
    details.append(head)
    details.append(el('p', 'trail-details-objetivo', etapa.objetivo))

    const moldeInfo = MOLDES_REGISTRO[etapa.molde]
    const temaInfo = moldeInfo?.temas?.find((t) => t.id === etapa.tema)
    const resumoConfig = formatConfigResumo(etapa.molde, etapa.config)
    const resumoLine = [moldeInfo?.label, temaInfo?.label].filter(Boolean).join(' · ')
    const configBox = el('div', 'trail-details-config')
    if (resumoLine) configBox.append(el('b', null, resumoLine))
    if (resumoConfig) configBox.append(el('span', null, resumoConfig))
    details.append(configBox)

    if (podePreparar) {
      const btn = el('button', `btn btn-sm ${status !== 'concluida' ? 'btn-accent' : 'btn-ghost'}`, 'Preparar atividade')
      btn.type = 'button'
      btn.addEventListener('click', () => onPrepararEtapa?.(etapa))
      details.append(btn)
    }
  }

  function selectEtapa(id, { porUsuario = false } = {}) {
    etapaSelecionadaId = id
    if (porUsuario) selecaoManual = true
    nodeButtons.forEach((btn, btnId) => btn.classList.toggle('is-selected', btnId === id))
    renderDetails(plano.etapas.find((e) => e.id === id))
    // Só abre o bottom sheet (mobile) numa escolha de verdade do tutor — a
    // seleção automática inicial não deve empurrar um sheet na cara de quem
    // acabou de abrir a página.
    if (porUsuario) openSheet()
  }

  function render() {
    const currentIdx = currentIndex()
    renderPath(currentIdx)
    renderNodes(currentIdx)
    const fallbackId = plano.etapas[currentIdx >= 0 ? currentIdx : plano.etapas.length - 1]?.id
    const preferida = selecaoManual && etapaSelecionadaId && nodeButtons.has(etapaSelecionadaId)
      ? etapaSelecionadaId
      : fallbackId
    if (preferida) selectEtapa(preferida)
  }

  render()

  wrap.updateStatuses = (novo) => {
    currentStatuses = novo
    render()
  }

  return wrap
}
