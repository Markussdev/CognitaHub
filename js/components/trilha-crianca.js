import { el } from '../lib/ui.js'
import { DECORACAO_ESPACIAL } from './trilha-visual-config.js'
import { emblemaUrl, mascoteUrl, espacoUrl } from '../lib/trilha-assets.js'

// Componente puro (mesmo espírito do trilha-plano.js): não fala com
// Supabase, não navega sozinho, não conhece PLANOS_REGISTRO. Recebe as
// missões formais de UM módulo já prontas (id, status, título, emblema,
// childActivityId) e devolve o mapa.
//
// Diferente do trilha-crianca.js antigo (que desenhava as 5 etapas fixas
// de PLANOS_REGISTRO.primeiros_numeros): aqui o número de missões vem do
// currículo real (hoje 3 por módulo) e pode mudar entre módulos/trilhas
// futuras — por isso as posições dos nós e os segmentos do caminho são
// GERADOS pra N missões, não uma tabela de 5 posições hand-tuned como no
// mapa do tutor. É uma troca deliberada: menos refinado visualmente por
// enquanto, mas correto pra qualquer N. Lapidar isso é trabalho futuro.
//
// Continua igual ao antigo em tudo que não depende da contagem: só a
// missão 'disponivel' é clicável, sem painel técnico, mascote com função
// narrativa (guia na atual, comemora quando o módulo termina).

const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const LOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`

// Zigue-zague simples pra N nós, viewBox 0 0 400 1000 (mesmo tamanho do
// mapa do tutor). Alterna 50/68/32% de x, espalha y de 8% a 90%.
function gerarPosicoes(n) {
  if (n <= 0) return []
  if (n === 1) return [{ x: 50, y: 50 }]
  const xs = [50, 68, 32]
  return Array.from({ length: n }, (_, i) => ({ x: xs[i % xs.length], y: 8 + i * (82 / (n - 1)) }))
}

// Curva suave entre dois nós consecutivos (% -> px do viewBox 400x1000).
function gerarSegmento(a, b) {
  const x1 = a.x * 4, y1 = a.y * 10
  const x2 = b.x * 4, y2 = b.y * 10
  const midY = (y1 + y2) / 2
  return `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`
}

export function renderTrilhaCrianca({ missoes, onOpenMission }) {
  const wrap = el('div', 'crianca-map')
  const posicoes = gerarPosicoes(missoes.length)

  const pathSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  pathSvg.setAttribute('class', 'crianca-path')
  pathSvg.setAttribute('viewBox', '0 0 400 1000')
  pathSvg.setAttribute('preserveAspectRatio', 'none')
  pathSvg.setAttribute('aria-hidden', 'true')
  const segmentPaths = posicoes.slice(0, -1).map((pos, i) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', gerarSegmento(pos, posicoes[i + 1]))
    path.setAttribute('fill', 'none')
    path.setAttribute('class', 'crianca-path-seg')
    pathSvg.append(path)
    return path
  })
  wrap.append(pathSvg)

  const decoLayer = el('div', 'crianca-deco-layer')
  decoLayer.innerHTML = DECORACAO_ESPACIAL.map(({ src, x, y, size, opacity }) => (
    `<img class="crianca-deco" src="${espacoUrl(src)}" alt="" aria-hidden="true" style="left:${x};top:${y};width:${size}px;height:${size}px;opacity:${opacity};" />`
  )).join('')
  wrap.append(decoLayer)

  const nodesLayer = el('div', 'crianca-nodes')
  wrap.append(nodesLayer)

  const atualIdx = missoes.findIndex((m) => m.status !== 'concluida')
  const tudoConcluido = atualIdx === -1

  segmentPaths.forEach((path, i) => {
    const destStatus = missoes[i + 1]?.status
    const state = destStatus === 'concluida' ? 'concluida' : (i + 1 === atualIdx ? 'atual' : 'futuro')
    path.setAttribute('class', `crianca-path-seg crianca-path-seg--${state}`)
  })

  let missaoAtualEl = null

  missoes.forEach((missao, i) => {
    const pos = posicoes[i]
    const isAtual = i === atualIdx

    const btn = el('button', `crianca-step crianca-step--${missao.status}`)
    btn.type = 'button'
    btn.style.setProperty('--trail-x', `${pos.x}%`)
    btn.style.setProperty('--trail-y', `${pos.y}%`)
    if (missao.status !== 'disponivel') btn.disabled = true
    btn.setAttribute('aria-label', `Missão ${i + 1}: ${missao.titulo} — ${
      missao.status === 'concluida' ? 'concluída' : missao.status === 'disponivel' ? 'disponível agora' : 'bloqueada'
    }`)

    const badge = el('span', 'crianca-step-badge')
    if (missao.status === 'bloqueada') {
      badge.innerHTML = LOCK_SVG
    } else {
      const emblemImg = el('img', 'crianca-emblem-img')
      emblemImg.src = emblemaUrl(missao.emblema)
      emblemImg.alt = ''
      badge.append(emblemImg)
    }
    btn.append(badge)

    if (missao.status === 'concluida') {
      const check = el('span', 'crianca-step-check')
      check.innerHTML = CHECK_SVG
      btn.append(check)
    }

    if (missao.status === 'disponivel') {
      btn.addEventListener('click', () => onOpenMission?.(missao))
    }

    if (isAtual) missaoAtualEl = btn
    nodesLayer.append(btn)
  })

  // Só um mascote no mapa inteiro: guia acompanha a missão atual (a
  // primeira não concluída, disponível ou não); quando o módulo termina,
  // comemorar substitui na última.
  if (!tudoConcluido && missaoAtualEl) {
    const guia = el('img', 'crianca-guia')
    guia.src = mascoteUrl('guia')
    guia.alt = ''
    guia.setAttribute('aria-hidden', 'true')
    missaoAtualEl.append(guia)
  } else if (tudoConcluido) {
    const ultimoBtn = nodesLayer.lastElementChild
    if (ultimoBtn) {
      const comemora = el('img', 'crianca-guia')
      comemora.src = mascoteUrl('comemorar')
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
