import { escapeHtml } from '../utils/html.js'

const LABELS = {
  locked: 'Bloqueada',
  available: 'Disponível',
  completed: 'Concluída',
}

const ICONS = {
  locked: '🔒',
  available: '★',
  completed: '✓',
}

export function missionNodeHtml({ title, state = 'locked', activityId = null }) {
  const tag = activityId ? 'button' : 'div'
  const attrs = activityId ? `type="button" data-activity-id="${activityId}"` : ''
  const safeTitle = escapeHtml(title)

  return `
    <${tag} class="mission-node mission-node--${state}" ${attrs}>
      <div class="mission-node__circle">${ICONS[state] ?? ICONS.locked}</div>
      <div class="mission-node__label">${safeTitle}<br />${LABELS[state] ?? ''}</div>
    </${tag}>
  `
}
