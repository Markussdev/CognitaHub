import logoImg from '../assets/logo-icon-transparent.webp'
import spaceCleanBg from '../assets/cap1/space-clean-bg.webp'
import landmarkAbacus from '../assets/cap1/landmark-abacus.webp'
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

// Identificação da missão atual mora aqui, no cabeçalho — não numa
// cápsula colada no nó nem num card separado embaixo (as duas versões
// competiam com o nó roxo como "área de ação"). O título completo
// continua acessível via aria-label no próprio nó.
function journeyHeaderHtml(childName, missionTitle = null, withBack = false) {
  const context = missionTitle
    ? `
      <p class="journey-header__context">
        <strong>Agora</strong>
        <span>${escapeHtml(missionTitle)}</span>
      </p>
    `
    : ''

  const back = withBack
    ? `<button class="journey-header__back" type="button" aria-label="Voltar aos módulos">‹</button>`
    : ''

  return `
    <div class="journey-header ${withBack ? 'journey-header--with-back' : ''}">
      ${back}
      <img src="${logoImg}" alt="" />
      <div class="journey-header__copy">
        <h1 class="title">Jornada de ${escapeHtml(childName)}</h1>
        ${context}
      </div>
    </div>
  `
}

export function renderJourney(root, { childName, trail, currentModule, missions, moduleVisual, onBack, onOpenMission, onRefresh }) {
  const header = journeyHeaderHtml(childName)

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

  // O landmark do topo é a mesma estação tocada na seleção de módulos —
  // a criança entra "naquele lugar", então o destino da trilha é ele.
  const landmarkImg = moduleVisual?.image ?? landmarkAbacus

  if (currentModule.status === 'aguardando_revisao') {
    renderModuleComplete(root, journeyHeaderHtml(childName, null, Boolean(onBack)), { landmarkImg, onRefresh, onBack })
    return
  }

  const currentIndex = missions.findIndex((m) => m.status === 'disponivel')
  const currentMission = currentIndex >= 0 ? missions[currentIndex] : null
  const headerWithContext = journeyHeaderHtml(childName, currentMission?.mission_templates?.title, Boolean(onBack))
  const { height, nodes, landmarkY, landmarkPathPoint } = computeLayout(missions.length)

  const missionSegments = nodes
    .slice(0, -1)
    .map((pos, i) => {
      const next = nodes[i + 1]
      const state = missions[i + 1].status === 'concluida' ? 'done' : i + 1 === currentIndex ? 'current' : 'future'
      return `<path d="${segmentPath(pos, next)}" class="journey-path__seg journey-path__seg--${state}" fill="none" />`
    })
    .join('')

  // O ábaco é o destino da jornada, não um enfeite solto — o caminho
  // continua até a base dele.
  const landmarkSegment = `<path d="${segmentPath(nodes.at(-1), landmarkPathPoint)}" class="journey-path__seg journey-path__seg--future" fill="none" />`

  const segments = missionSegments + landmarkSegment

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
      ${headerWithContext}
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

  root.querySelector('.journey-header__back')?.addEventListener('click', () => onBack?.())

  const nodeEls = root.querySelectorAll('.mission-node')
  const scrollTarget = currentIndex >= 0 ? nodeEls[currentIndex] : root.querySelector('.journey-landmark')
  scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Tela curta, não o mapa inteiro de novo — a criança já viu o caminho
// enquanto jogava; repetir tudo só pra mostrar "espere o tutor" é exagero
// visual pra um estado de espera.
function renderModuleComplete(root, header, { landmarkImg, onRefresh, onBack }) {
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
  root.querySelector('.journey-header__back')?.addEventListener('click', () => onBack?.())
}

function renderMessage(root, header, text) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      ${header}
      ${statusMessageHtml({ type: 'info', text })}
    </div>
  `
}
