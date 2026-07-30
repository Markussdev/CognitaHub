const ICONS = {
  info: 'ℹ️',
  error: '⚠️',
  success: '✅',
}

export function statusMessageHtml({ type = 'info', text }) {
  return `
    <div class="status-message status-message--${type}" role="status">
      <span aria-hidden="true">${ICONS[type] ?? ICONS.info}</span>
      <span>${text}</span>
    </div>
  `
}
