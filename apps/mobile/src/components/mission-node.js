const LABELS = {
  locked: 'Bloqueada',
  available: 'Disponível',
  completed: 'Concluída',
  review: 'Em revisão',
}

const ICONS = {
  locked: '🔒',
  available: '★',
  completed: '✓',
  review: '⏳',
}

export function missionNodeHtml({ title, state = 'locked' }) {
  return `
    <div class="mission-node mission-node--${state}">
      <div class="mission-node__circle">${ICONS[state] ?? ICONS.locked}</div>
      <div class="mission-node__label">${title}<br />${LABELS[state] ?? ''}</div>
    </div>
  `
}
