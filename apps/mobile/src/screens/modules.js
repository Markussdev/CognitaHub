import logoImg from '../assets/logo-icon-transparent.webp'
import { escapeHtml } from '../utils/html.js'
import { getModuleVisual, SPACE_CHAPTER_TITLE } from '../config/module-visuals.js'

// Seleção de módulos = cena vertical por módulo (Duolingo ABC), não a
// trilha de nós pequenos (Duolingo normal) — os assets espaciais foram
// feitos pra serem protagonistas, não ícones de mapa. A trilha de missões
// com caminho orbital continua existindo dentro de cada módulo, em
// journey.js; só a seleção mudou de metáfora.
//
// Estados do banco → estados visuais:
//   concluido            → completed (colorida + check; conquista, não cinza)
//   liberado             → current   (destaque, gato-guia, única clicável)
//   aguardando_revisao   → current   (clicável; a jornada mostra a tela de espera)
//   bloqueado            → locked    (adormecida, não morta — sem clique)

const STATUS_TEXT = {
  concluido: 'Concluído',
  liberado: 'Toque para continuar',
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

export function renderModules(root, { childName, modules, onOpenModule, onOpenSettings }) {
  const scenesHtml = modules
    .map((module, index) => {
      const visual = getModuleVisual(index)
      const state = stationState(module.status)
      const clickable = state === 'current'
      const tag = clickable ? 'button' : 'section'
      const attrs = clickable ? `type="button" data-module-id="${module.id}"` : ''

      const badge =
        state === 'locked'
          ? `<span class="module-scene__lock" aria-hidden="true">${LOCK_SVG}</span>`
          : state === 'completed'
            ? `<span class="module-scene__check" aria-hidden="true">${CHECK_SVG}</span>`
            : ''

      // Só a estação atual ganha o gato-guia — é a única pergunta que a
      // criança precisa responder de relance: "é aqui que eu continuo".
      // Posição/tamanho vêm do module-visuals.js (cada silhueta é diferente).
      const mascot =
        state === 'current'
          ? `<img class="module-scene__mascot" src="${visual.mascot}" alt="" aria-hidden="true" />`
          : ''

      const sel = visual.selection
      const sceneStyle = [
        `--module-accent:${visual.accent}`,
        `--station-width:${sel.stationWidth}`,
        `--station-y:${sel.stationY}`,
        `--mascot-x:${sel.mascotX}`,
        `--mascot-y:${sel.mascotY}`,
        `--mascot-width:${sel.mascotWidth}`,
        `--mascot-flip:${sel.mascotFlip ? -1 : 1}`,
      ].join(';')

      return `
        <${tag} class="module-scene module-scene--${state}" ${attrs} style="${sceneStyle}" aria-label="${escapeHtml(visual.title)} — ${STATUS_TEXT[module.status] ?? ''}">
          <div class="module-scene__sky" aria-hidden="true"></div>

          <div class="module-scene__content">
            <div class="module-scene__art">
              <img class="module-scene__station" src="${visual.image}" alt="" aria-hidden="true" />
              ${badge}
              ${mascot}
            </div>

            <div class="module-scene__copy">
              <span class="module-scene__eyebrow">Módulo ${index + 1}</span>
              <h2>${escapeHtml(visual.title)}</h2>
              <p>${STATUS_TEXT[module.status] ?? ''}</p>
            </div>
          </div>
        </${tag}>
      `
    })
    .join('')

  root.innerHTML = `
    <div class="screen screen--modules">
      <header class="modules-header">
        <img src="${logoImg}" alt="" />
        <div>
          <h1>${SPACE_CHAPTER_TITLE}</h1>
          <p>Jornada de ${escapeHtml(childName)}</p>
        </div>
        <button class="modules-header__settings" type="button" aria-label="Abrir configurações">⚙</button>
      </header>

      <main class="modules-scenes">
        ${scenesHtml}
      </main>
    </div>
  `

  root.querySelectorAll('[data-module-id]').forEach((scene) => {
    scene.addEventListener('click', () => {
      const module = modules.find((item) => item.id === scene.dataset.moduleId)
      if (module) onOpenModule?.(module)
    })
  })

  root.querySelector('.modules-header__settings')?.addEventListener('click', () => onOpenSettings?.())

  root.querySelector('.module-scene--current')?.scrollIntoView({ block: 'start' })
}
