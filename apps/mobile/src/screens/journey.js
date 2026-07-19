import logoImg from '../assets/logo-icon-transparent.png'
import { missionNodeHtml } from '../components/mission-node.js'
import { statusMessageHtml } from '../components/status-message.js'
import { escapeHtml } from '../utils/html.js'

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

  const nodes = missions.map((mission) =>
    missionNodeHtml({
      title: mission.mission_templates.title,
      state: MISSION_STATES[mission.status] ?? 'locked',
      activityId: mission.status === 'disponivel' ? mission.child_activities?.[0]?.id ?? null : null,
    }),
  )

  const reviewBanner =
    currentModule.status === 'aguardando_revisao'
      ? `
        ${statusMessageHtml({ type: 'info', text: 'Módulo concluído! Agora é hora de aguardar seu tutor.' })}
        <button class="btn-primary" id="refresh-btn" type="button">Atualizar jornada</button>
      `
      : ''

  const emptyState =
    missions.length === 0
      ? statusMessageHtml({ type: 'info', text: 'Nenhuma missão disponível no momento.' })
      : ''

  root.innerHTML = `
    <div class="screen screen--journey">
      ${header}
      <div class="journey-map">
        ${nodes.join('')}
      </div>
      ${reviewBanner}
      ${emptyState}
    </div>
  `

  root.querySelector('#refresh-btn')?.addEventListener('click', () => onRefresh?.())

  root.querySelectorAll('[data-activity-id]').forEach((node) => {
    node.addEventListener('click', () => {
      onOpenMission?.(node.dataset.activityId)
    })
  })
}

function renderMessage(root, header, text) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      ${header}
      ${statusMessageHtml({ type: 'info', text })}
    </div>
  `
}
