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
  const dataAttr = activityId ? ` data-activity-id="${activityId}"` : ''
  return `
    <div class="mission-node mission-node--${state}"${dataAttr}>
      <div class="mission-node__circle">${ICONS[state] ?? ICONS.locked}</div>
      <div class="mission-node__label">${title}<br />${LABELS[state] ?? ''}</div>
    </div>
  `
}
