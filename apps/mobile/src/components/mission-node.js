import { escapeHtml } from '../utils/html.js'
import mascotMap from '../assets/cap1/mascot-map.webp'

const STATUS_LABELS = {
  locked: 'bloqueada',
  available: 'disponível agora',
  completed: 'concluída',
}

const LOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="3" fill="currentColor"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`
const CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Título só aparece pra missão disponível — bloqueada/concluída não
// precisam de texto, só do ícone (regra: a criança precisa achar rápido
// onde continuar, não ler o mapa inteiro).
export function missionNodeHtml({ title, state = 'locked', activityId = null, x, y, isCurrent = false }) {
  const tag = activityId ? 'button' : 'div'
  const attrs = activityId ? `type="button" data-activity-id="${activityId}"` : ''
  const safeTitle = escapeHtml(title)

  const badge =
    state === 'locked'
      ? `<span class="mission-node__badge mission-node__badge--lock">${LOCK_SVG}</span>`
      : state === 'completed'
        ? `<span class="mission-node__badge mission-node__badge--check">${CHECK_SVG}</span>`
        : ''

  const mascot = isCurrent ? `<img class="mission-node__mascot" src="${mascotMap}" alt="" aria-hidden="true" />` : ''

  // Título completo só existe no aria-label agora — a identificação da
  // missão pra criança mora no cabeçalho (journey-header__context), não
  // numa cápsula colada no nó.
  return `
    <${tag} class="mission-node mission-node--${state}" ${attrs} style="left:${x}%;top:${y}px;" aria-label="${safeTitle} — ${STATUS_LABELS[state] ?? ''}">
      <span class="mission-node__btn">
        ${badge}
        ${mascot}
      </span>
    </${tag}>
  `
}
