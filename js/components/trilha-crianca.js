import { el } from '../lib/ui.js'
import { NODE_POSICOES, SEGMENTOS_D, DECORACAO_ESPACIAL } from './trilha-plano.js'

// Componente puro (mesmo espírito do trilha-plano.js): não fala com Supabase,
// não navega sozinho. Recebe o plano + status "da criança" (bloqueada /
// disponivel / concluida — ver computeStatusCrianca em planos-registro.js,
// é diferente do status do tutor) e devolve o mapa.
//
// Diferenças de propósito em relação ao mapa do tutor:
// - só a missão "disponivel" é clicável — nunca mais de uma ao mesmo tempo,
//   nunca fora de ordem;
// - sem painel técnico (molde/tema/config) — a criança só vê o essencial;
// - mascote aqui tem função narrativa (o tutor pediu de volta pro app,
//   mesmo tendo sido removido do mapa do tutor — contextos diferentes).

const EMBLEMA_BASE = '../assets/trilha/emblemas/'
const ESPACO_BASE = '../assets/trilha/espaco/'
const MASCOTE_BASE = '../assets/trilha/mascote/'

const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const LOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`

export function renderTrilhaCrianca({ plano, statusesCrianca, onIniciarMissao }) {
  const wrap = el('div', 'crianca-map')

  const pathSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  pathSvg.setAttribute('class', 'crianca-path')
  pathSvg.setAttribute('viewBox', '0 0 400 1000')
  pathSvg.setAttribute('preserveAspectRatio', 'none')
  pathSvg.setAttribute('aria-hidden', 'true')
  const segmentPaths = SEGMENTOS_D.map((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('class', 'crianca-path-seg')
    pathSvg.append(path)
    return path
  })
  wrap.append(pathSvg)

  const decoLayer = el('div', 'crianca-deco-layer')
  decoLayer.innerHTML = DECORACAO_ESPACIAL.map(({ src, x, y, size, opacity }) => (
    `<img class="crianca-deco" src="${ESPACO_BASE}${src}.webp" alt="" aria-hidden="true" style="left:${x};top:${y};width:${size}px;height:${size}px;opacity:${opacity};" />`
  )).join('')
  wrap.append(decoLayer)

  const nodesLayer = el('div', 'crianca-nodes')
  wrap.append(nodesLayer)

  const statusFor = (i) => statusesCrianca?.[i]?.status || 'bloqueada'

  // Mesma ideia do mapa do tutor: a "atual" é a 1ª etapa não concluída,
  // esteja ela disponível (já preparada) ou ainda bloqueada (esperando o
  // tutor preparar) — é sempre onde o olhar/o gato-guia deve ir.
  const atualIdx = plano.etapas.findIndex((_, i) => statusFor(i) !== 'concluida')
  const tudoConcluido = atualIdx === -1

  segmentPaths.forEach((path, i) => {
    const destStatus = statusFor(i + 1)
    const state = destStatus === 'concluida' ? 'concluida' : (i + 1 === atualIdx ? 'atual' : 'futuro')
    path.setAttribute('class', `crianca-path-seg crianca-path-seg--${state}`)
  })

  let missaoAtualEl = null

  plano.etapas.forEach((etapa, i) => {
    const status = statusFor(i)
    const pos = NODE_POSICOES[i] || NODE_POSICOES[NODE_POSICOES.length - 1]
    const isAtual = i === atualIdx

    const btn = el('button', `crianca-step crianca-step--${status}`)
    btn.type = 'button'
    btn.style.setProperty('--trail-x', `${pos.x}%`)
    btn.style.setProperty('--trail-y', `${pos.y}%`)
    if (status !== 'disponivel') btn.disabled = true
    btn.setAttribute('aria-label', `Missão ${i + 1}: ${etapa.titulo} — ${
      status === 'concluida' ? 'concluída' : status === 'disponivel' ? 'disponível agora' : 'bloqueada'
    }`)

    const badge = el('span', 'crianca-step-badge')
    if (status === 'bloqueada') {
      badge.innerHTML = LOCK_SVG
    } else {
      const emblemImg = el('img', 'crianca-emblem-img')
      emblemImg.src = `${EMBLEMA_BASE}${etapa.emblema}.webp`
      emblemImg.alt = ''
      badge.append(emblemImg)
    }
    btn.append(badge)

    if (status === 'concluida') {
      const check = el('span', 'crianca-step-check')
      check.innerHTML = CHECK_SVG
      btn.append(check)
    }

    if (status === 'disponivel') {
      btn.addEventListener('click', () => onIniciarMissao?.(etapa, statusesCrianca[i].childActivityId))
    }

    if (isAtual) missaoAtualEl = btn

    nodesLayer.append(btn)
  })

  // Só um mascote no mapa inteiro: guia acompanha a missão atual (disponível
  // ou ainda bloqueada); quando tudo termina, comemorar substitui na última.
  if (!tudoConcluido && missaoAtualEl) {
    const guia = el('img', 'crianca-guia')
    guia.src = `${MASCOTE_BASE}guia.webp`
    guia.alt = ''
    guia.setAttribute('aria-hidden', 'true')
    missaoAtualEl.append(guia)
  } else if (tudoConcluido) {
    const ultimoBtn = nodesLayer.lastElementChild
    if (ultimoBtn) {
      const comemora = el('img', 'crianca-guia')
      comemora.src = `${MASCOTE_BASE}comemorar.webp`
      comemora.alt = ''
      comemora.setAttribute('aria-hidden', 'true')
      ultimoBtn.append(comemora)
    }
  }

  wrap.scrollToMissaoAtual = () => {
    const alvo = tudoConcluido ? nodesLayer.lastElementChild : missaoAtualEl
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return wrap
}
