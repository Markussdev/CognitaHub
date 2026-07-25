import logoImg from '../assets/logo-icon-transparent.webp'
import mascotMap from '../assets/cap1/mascot-map.webp'
import { escapeHtml } from '../utils/html.js'
import { segmentPath } from './journey-layout.js'
import { getModuleVisual, SPACE_CHAPTER_TITLE } from '../config/module-visuals.js'

// Seleção de módulos (lógica do Duolingo ABC, não a aparência): o capítulo
// é um céu contínuo, cada estação é um módulo, e a criança só entra no que
// o tutor liberou. Cresce de baixo pra cima, igual à trilha interna.
//
// Estados do banco → estados visuais:
//   concluido            → completed (colorido + check; conquista, não cinza)
//   liberado             → current   (destaque, gato, único clicável)
//   aguardando_revisao   → current   (clicável; a jornada mostra a tela de espera)
//   bloqueado            → locked    (apagado + cadeado, sem clique)

const MODULE_X = [50, 34, 66, 38, 62]
const MODULE_GAP = 230
const TOP_PAD = 200
const BOTTOM_PAD = 170

const STATUS_TEXT = {
  concluido: 'Concluído',
  liberado: 'Em andamento',
  aguardando_revisao: 'Esperando o tutor',
  bloqueado: 'O tutor ainda não liberou',
}

const LOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="3" fill="currentColor"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`
const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`

function stationState(status) {
  if (status === 'concluido') return 'completed'
  if (status === 'bloqueado') return 'locked'
  return 'current'
}

// Geometria pura, mesma convenção do journey-layout: índice = ordem
// cronológica, y menor = mais alto na tela.
export function computeModulesLayout(moduleCount) {
  const n = Math.max(moduleCount, 0)
  const height = TOP_PAD + Math.max(0, n - 1) * MODULE_GAP + BOTTOM_PAD

  const stations = Array.from({ length: n }, (_, i) => ({
    x: MODULE_X[i % MODULE_X.length],
    y: height - BOTTOM_PAD - i * MODULE_GAP,
  }))

  return { height, stations }
}

export function renderModules(root, { childName, modules, onOpenModule }) {
  const { height, stations } = computeModulesLayout(modules.length)

  const segments = stations
    .slice(0, -1)
    .map((pos, i) => {
      const next = stations[i + 1]
      const nextStatus = modules[i + 1].status
      const state =
        nextStatus === 'concluido' ? 'done' : stationState(nextStatus) === 'current' ? 'current' : 'future'
      return `<path d="${segmentPath(pos, next)}" class="modules-path__seg modules-path__seg--${state}" fill="none" />`
    })
    .join('')

  const stationsHtml = modules
    .map((module, i) => {
      const visual = getModuleVisual(i)
      const state = stationState(module.status)
      const clickable = state === 'current'
      const tag = clickable ? 'button' : 'div'
      const attrs = clickable ? `type="button" data-module-id="${module.id}"` : ''
      const statusText = STATUS_TEXT[module.status] ?? ''

      const badge =
        state === 'completed'
          ? `<span class="module-station__badge module-station__badge--check" aria-hidden="true">${CHECK_SVG}</span>`
          : state === 'locked'
            ? `<span class="module-station__badge module-station__badge--lock" aria-hidden="true">${LOCK_SVG}</span>`
            : ''

      const mascot =
        state === 'current' && module.status === 'liberado'
          ? `<img class="module-station__mascot" src="${mascotMap}" alt="" aria-hidden="true" />`
          : ''

      return `
        <${tag} class="module-station module-station--${state}" ${attrs}
          style="left:${stations[i].x}%;top:${stations[i].y}px;--station-accent:${visual.accent};"
          aria-label="${escapeHtml(visual.title)} — ${statusText}">
          <span class="module-station__art">
            <img class="module-station__img" src="${visual.image}" alt="" aria-hidden="true" />
            ${badge}
            ${mascot}
          </span>
          <span class="module-station__name">${escapeHtml(visual.title)}</span>
          <span class="module-station__status">${statusText}</span>
        </${tag}>
      `
    })
    .join('')

  root.innerHTML = `
    <div class="screen screen--modules">
      <div class="journey-header">
        <img src="${logoImg}" alt="" />
        <div class="journey-header__copy">
          <h1 class="title">${SPACE_CHAPTER_TITLE}</h1>
          <p class="journey-header__context"><span>Jornada de ${escapeHtml(childName)}</span></p>
        </div>
      </div>

      <div class="modules-world" style="height:${height}px">
        <svg class="modules-path" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">
          ${segments}
        </svg>
        ${stationsHtml}
      </div>
    </div>
  `

  root.querySelectorAll('[data-module-id]').forEach((station) => {
    station.addEventListener('click', () => {
      const module = modules.find((m) => m.id === station.dataset.moduleId)
      if (module) onOpenModule?.(module)
    })
  })

  root.querySelector('.module-station--current')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
