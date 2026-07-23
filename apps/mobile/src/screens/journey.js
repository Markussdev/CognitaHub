import logoImg from '../assets/logo-icon-transparent.webp'
import spaceCleanBg from '../assets/cap1/space-clean-bg.webp'
import landmarkAbacus from '../assets/cap1/landmark-abacus.webp'
import landmarkFinal from '../assets/cap1/landmark-final.webp'
import mascotMap from '../assets/cap1/mascot-map.webp'
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

  // Só existe um "landmark" por módulo: ábaco pra qualquer módulo com mais
  // trilha pela frente, o observatório final só pro último módulo mesmo
  // (não é o mesmo conceito de "módulo concluído" — um módulo no meio pode
  // ficar em aguardando_revisao sem ser o fim da jornada).
  const isLastModule = modules?.at(-1)?.id === currentModule.id
  const landmarkImg = isLastModule ? landmarkFinal : landmarkAbacus

  if (currentModule.status === 'aguardando_revisao') {
    renderModuleComplete(root, header, { landmarkImg, onRefresh })
    return
  }

  const currentIndex = missions.findIndex((m) => m.status === 'disponivel')
  const { height, nodes, landmarkY } = computeLayout(missions.length)

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
        x: nodes[i].x,
        y: nodes[i].y,
        isCurrent: i === currentIndex,
      }),
    )
    .join('')

  root.innerHTML = `
    <div class="screen screen--journey">
      ${header}
      <div class="journey-world" style="height:${height}px">
        <img class="journey-world__bg" src="${spaceCleanBg}" alt="" aria-hidden="true" />

        <svg class="journey-path" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">
          ${segments}
        </svg>

        <img class="journey-landmark" src="${landmarkImg}" alt="" aria-hidden="true" style="top:${landmarkY}px" />

        <div class="journey-nodes">
          ${nodesHtml}
        </div>
      </div>
    </div>
  `

  root.querySelectorAll('[data-activity-id]').forEach((node) => {
    node.addEventListener('click', () => {
      onOpenMission?.(node.dataset.activityId)
    })
  })

  const nodeEls = root.querySelectorAll('.mission-node')
  const scrollTarget = currentIndex >= 0 ? nodeEls[currentIndex] : root.querySelector('.journey-landmark')
  scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Tela curta, não o mapa inteiro de novo — a criança já viu o caminho
// enquanto jogava; repetir tudo só pra mostrar "espere o tutor" é exagero
// visual pra um estado de espera.
function renderModuleComplete(root, header, { landmarkImg, onRefresh }) {
  root.innerHTML = `
    <div class="screen screen--journey-complete">
      ${header}
      <div class="journey-complete__art">
        <img class="journey-complete__landmark" src="${landmarkImg}" alt="" aria-hidden="true" />
        <img class="journey-complete__mascot" src="${mascotMap}" alt="" aria-hidden="true" />
      </div>
      <h2 class="title">Módulo concluído!</h2>
      ${statusMessageHtml({ type: 'info', text: 'Agora é hora de aguardar seu tutor.' })}
      <button class="btn-primary" id="refresh-btn" type="button">Atualizar jornada</button>
    </div>
  `
  root.querySelector('#refresh-btn')?.addEventListener('click', () => onRefresh?.())
}

function renderMessage(root, header, text) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      ${header}
      ${statusMessageHtml({ type: 'info', text })}
    </div>
  `
}
