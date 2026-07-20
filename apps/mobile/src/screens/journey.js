import logoImg from '../assets/logo-icon-transparent.webp'
import spaceBg from '../assets/cap1/space-bg.webp'
import spaceCity from '../assets/cap1/space-city.webp'
import spaceLeftMoon from '../assets/cap1/space-left-moon.webp'
import spaceRightObservatory from '../assets/cap1/space-right-observatory.webp'
import platformStart from '../assets/cap1/platform-start.webp'
import landmarkAbacus from '../assets/cap1/landmark-abacus.webp'
import landmarkFinal from '../assets/cap1/landmark-final.webp'
import { missionNodeHtml } from '../components/mission-node.js'
import { statusMessageHtml } from '../components/status-message.js'
import { escapeHtml } from '../utils/html.js'
import { computeLayout, segmentPath } from './journey-layout.js'

const MISSION_STATES = {
  bloqueada: 'locked',
  disponivel: 'available',
  concluida: 'completed',
}

export function renderJourney(root, { childName, trail, modules, currentModule, missions, onOpenMission, onRefresh }) {
  const header = `
    <div class="journey-header">
      <img src="${logoImg}" alt="" />
      <h1 class="title">Jornada de ${escapeHtml(childName)}</h1>
    </div>
  `

  if (trail?.status === 'concluida') {
    renderMessage(root, header, 'Você concluiu sua jornada!')
    return
  }

  if (trail?.status === 'pausada') {
    renderMessage(root, header, 'Sua jornada está pausada.')
    return
  }

  if (!currentModule || currentModule.status === 'bloqueado') {
    renderMessage(root, header, 'Seu tutor está preparando o próximo módulo.')
    return
  }

  if (missions.length === 0) {
    renderMessage(root, header, 'Nenhuma missão disponível no momento.')
    return
  }

  const isReview = currentModule.status === 'aguardando_revisao'
  const currentIndex = missions.findIndex((m) => m.status === 'disponivel')
  const { height, nodes, abacusY, finalY, startPlatformY } = computeLayout(missions.length)

  const segments = nodes
    .slice(0, -1)
    .map((pos, i) => {
      const next = nodes[i + 1]
      const state = missions[i + 1].status === 'concluida' ? 'done' : i + 1 === currentIndex ? 'current' : 'future'
      return `<path d="${segmentPath(pos, next)}" class="journey-path__seg journey-path__seg--${state}" fill="none" />`
    })
    .join('')

  const nodesHtml = missions
    .map((mission, i) =>
      missionNodeHtml({
        title: mission.mission_templates.title,
        state: MISSION_STATES[mission.status] ?? 'locked',
        activityId: mission.status === 'disponivel' ? mission.child_activities?.[0]?.id ?? null : null,
        index: i,
        x: nodes[i].x,
        y: nodes[i].y,
        isCurrent: i === currentIndex,
      }),
    )
    .join('')

  const finalHtml = isReview
    ? `<img class="journey-landmark journey-landmark--final" src="${landmarkFinal}" alt="" aria-hidden="true" style="top:${finalY}px" />`
    : ''

  const footer = isReview
    ? `
      <div class="journey-footer">
        ${statusMessageHtml({ type: 'info', text: 'Módulo concluído! Agora é hora de aguardar seu tutor.' })}
        <button class="btn-primary" id="refresh-btn" type="button">Atualizar jornada</button>
      </div>
    `
    : ''

  root.innerHTML = `
    <div class="screen screen--journey">
      ${header}
      <div class="journey-world" style="height:${height}px">
        <img class="journey-world__bg" src="${spaceBg}" alt="" aria-hidden="true" />
        <img class="journey-deco journey-deco--city" src="${spaceCity}" alt="" aria-hidden="true" />
        <img class="journey-deco journey-deco--moon" src="${spaceLeftMoon}" alt="" aria-hidden="true" />
        <img class="journey-deco journey-deco--observatory" src="${spaceRightObservatory}" alt="" aria-hidden="true" />

        <svg class="journey-path" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">
          ${segments}
        </svg>

        <img class="journey-landmark journey-landmark--abacus" src="${landmarkAbacus}" alt="" aria-hidden="true" style="top:${abacusY}px" />
        ${finalHtml}

        <img class="journey-start-platform" src="${platformStart}" alt="" aria-hidden="true" style="top:${startPlatformY}px" />

        <div class="journey-nodes">
          ${nodesHtml}
        </div>
      </div>
      ${footer}
    </div>
  `

  root.querySelector('#refresh-btn')?.addEventListener('click', () => onRefresh?.())

  root.querySelectorAll('[data-activity-id]').forEach((node) => {
    node.addEventListener('click', () => {
      onOpenMission?.(node.dataset.activityId)
    })
  })

  const nodeEls = root.querySelectorAll('.mission-node')
  const scrollTarget =
    (currentIndex >= 0 ? nodeEls[currentIndex] : null) ??
    root.querySelector('.journey-landmark--final') ??
    root.querySelector('.journey-landmark--abacus')
  scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function renderMessage(root, header, text) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      ${header}
      ${statusMessageHtml({ type: 'info', text })}
    </div>
  `
}
