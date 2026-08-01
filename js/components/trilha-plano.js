import { el } from '../lib/ui.js'
import { MOLDES_REGISTRO, formatConfigResumo } from '../data/moldes-registro.js'
import { STATUS_ETAPA } from '../data/planos-registro.js'
import { NODE_POSICOES, SEGMENTOS_D, DECORACAO_ESPACIAL } from './trilha-visual-config.js'
import { emblemaUrl, espacoUrl } from '../lib/trilha-assets.js'

// Componente puro: não importa supabase, não conhece ciclo, não navega.
// Recebe o plano + status já calculados e devolve um elemento (só mapa +
// painel de detalhes — título/progresso/voltar são do shell da página que
// usa isto, ver js/pages/trilha.js). Quem chama decide quando "Preparar
// atividade" bloqueia (podePreparar) e o que fazer com a etapa escolhida
// (onPrepararEtapa → prefillFromPlano/bridge de URL em tutor.js).

const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Posições dos 5 nós, segmentos do caminho e decoração espacial agora
// vivem em trilha-visual-config.js (compartilhado com trilha-crianca.js,
// sem depender de planos-registro.js — ver comentário lá).

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
    `<img class="trail-deco" src="${espacoUrl(src)}" alt="" aria-hidden="true" style="left:${x};top:${y};width:${size}px;height:${size}px;opacity:${opacity};" />`
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
      emblemImg.src = emblemaUrl(etapa.emblema)
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
