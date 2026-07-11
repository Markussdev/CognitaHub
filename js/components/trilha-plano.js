import { el } from '../lib/ui.js'
import { MOLDES_REGISTRO, formatConfigResumo } from '../data/moldes-registro.js'
import { STATUS_ETAPA } from '../data/planos-registro.js'

// Componente puro: não importa supabase, não conhece ciclo, não navega.
// Recebe o plano + status já calculados e devolve um elemento; quem chama
// decide quando "Preparar atividade" bloqueia (podePreparar) e o que fazer
// com a etapa escolhida (onPrepararEtapa → prefillFromPlano em tutor.js).

// Caminhos relativos a pages/tutor.html (único lugar que carrega este
// componente) — mesmo padrão de `img.src = '../assets/...'` já usado em
// tutor.js, não import de módulo Vite.
const MASCOTE_BASE = '../assets/trilha/mascote/'
const EMBLEMA_BASE = '../assets/trilha/emblemas/'
const ESPACO_BASE = '../assets/trilha/espaco/'

const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Caminho fixo pra 5 etapas — desenhado à mão pro viewBox 400x800.
// Algoritmo dinâmico só quando existir plano de tamanho variável (ver §9 do plano).
const TRAIL_PATH_D = 'M200 60 C90 150 310 230 200 320 C90 410 310 490 200 580 C110 650 200 720 200 770'

// Decoração espacial estática (Fase C) — posições fixas nas margens do mapa,
// longe da faixa 32%–68% onde os nós ficam. Puramente decorativo: aria-hidden
// + pointer-events:none, sem nenhuma animação (isso é Fase D, sob
// prefers-reduced-motion).
const DECORACAO_ESPACIAL = [
  { src: 'planeta-roxo', x: '9%', y: '5%', size: 60 },
  { src: 'estrelas-3', x: '46%', y: '3%', size: 30 },
  { src: 'estrelas-1', x: '89%', y: '15%', size: 38 },
  { src: 'cometa', x: '7%', y: '36%', size: 66 },
  { src: 'planeta-azul', x: '91%', y: '43%', size: 52 },
  { src: 'orbita', x: '10%', y: '60%', size: 58 },
  { src: 'estrelas-2', x: '86%', y: '64%', size: 34 },
  { src: 'lua', x: '89%', y: '84%', size: 46 },
  { src: 'planeta-amarelo', x: '12%', y: '95%', size: 72 },
]

export function renderTrilhaPlano({ plano, statuses, podePreparar, onPrepararEtapa }) {
  let currentStatuses = statuses
  let etapaSelecionadaId = null
  // Só trava a seleção do tutor depois de um clique real — enquanto isso,
  // cada render() (inclusive quando o status real chega do Supabase) pode
  // reapontar pra etapa "em_andamento" de verdade, em vez de ficar preso
  // na 1ª etapa (seleção-padrão antes do status carregar).
  let selecaoManual = false
  const nodeButtons = new Map()

  const wrap = el('div', 'trail')

  const header = el('div', 'trail-header')
  const headMain = el('div', 'trail-header-main')
  const headerMascot = el('img', 'trail-mascot-planejar')
  headerMascot.src = `${MASCOTE_BASE}planejar.webp`
  headerMascot.alt = ''
  headerMascot.setAttribute('aria-hidden', 'true')
  const headCopy = el('div', 'trail-header-copy')
  headCopy.append(el('h3', 'trail-title', plano.titulo), el('p', 'trail-desc', plano.descricao))
  headMain.append(headerMascot, headCopy)
  header.append(headMain)

  const progressWrap = el('div', 'trail-progress')
  const progressLabel = el('span', 'trail-progress-label')
  const progressBar = el('div', 'trail-progress-bar')
  const progressFill = el('div', 'trail-progress-fill')
  progressBar.append(progressFill)
  progressWrap.append(progressLabel, progressBar)
  header.append(progressWrap)
  wrap.append(header)

  const body = el('div', 'trail-body')

  const mapWrap = el('div', 'trail-map')
  mapWrap.innerHTML = `<svg class="trail-path" viewBox="0 0 400 800" preserveAspectRatio="none" aria-hidden="true">
    <path d="${TRAIL_PATH_D}" fill="none" stroke="var(--trail-path)" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 16"/>
  </svg>`
  const decoLayer = el('div', 'trail-deco-layer')
  decoLayer.innerHTML = DECORACAO_ESPACIAL.map(({ src, x, y, size }) => (
    `<img class="trail-deco" src="${ESPACO_BASE}${src}.webp" alt="" aria-hidden="true" style="left:${x};top:${y};width:${size}px;height:${size}px;" />`
  )).join('')
  mapWrap.append(decoLayer)
  const nodesLayer = el('div', 'trail-nodes')
  mapWrap.append(nodesLayer)

  const details = el('div', 'trail-details')

  body.append(mapWrap, details)
  wrap.append(body)

  function statusFor(i) {
    return currentStatuses?.[i] || (i === 0 ? 'em_andamento' : 'a_fazer')
  }

  function updateProgress() {
    const total = plano.etapas.length
    const done = plano.etapas.reduce((n, _, i) => n + (statusFor(i) === 'concluida' ? 1 : 0), 0)
    progressLabel.textContent = `${done} de ${total} etapas concluídas`
    progressFill.style.width = `${total ? Math.round((done / total) * 100) : 0}%`
  }

  function renderNodes() {
    nodesLayer.replaceChildren()
    nodeButtons.clear()
    plano.etapas.forEach((etapa, i) => {
      const status = statusFor(i)
      const btn = el('button', `trail-step trail-step--${status}`)
      btn.type = 'button'
      btn.style.setProperty('--trail-i', String(i))
      btn.dataset.etapaId = etapa.id
      btn.setAttribute('aria-label', `Etapa ${i + 1}: ${etapa.titulo} — ${STATUS_ETAPA[status].label}`)

      const badge = el('span', 'trail-step-badge')
      if (status === 'concluida') {
        badge.innerHTML = CHECK_SVG
      } else {
        const emblemImg = el('img', 'trail-emblem-img')
        emblemImg.src = `${EMBLEMA_BASE}${etapa.emblema}.webp`
        emblemImg.alt = ''
        badge.append(emblemImg)
      }
      btn.append(badge)

      if (status === 'em_andamento') {
        const guia = el('img', 'trail-guia')
        guia.src = `${MASCOTE_BASE}guia.webp`
        guia.alt = ''
        guia.setAttribute('aria-hidden', 'true')
        btn.append(guia)
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

    if (status === 'concluida') {
      const comemora = el('img', 'trail-mascot-comemorar')
      comemora.src = `${MASCOTE_BASE}comemorar.webp`
      comemora.alt = ''
      comemora.setAttribute('aria-hidden', 'true')
      details.append(comemora)
    }

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
      const btn = el('button', `btn btn-sm ${status === 'em_andamento' ? 'btn-accent' : 'btn-ghost'}`, 'Preparar atividade')
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
  }

  function render() {
    updateProgress()
    renderNodes()
    const emAndamentoIdx = plano.etapas.findIndex((_, i) => statusFor(i) === 'em_andamento')
    const fallbackId = plano.etapas[emAndamentoIdx >= 0 ? emAndamentoIdx : 0]?.id
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
