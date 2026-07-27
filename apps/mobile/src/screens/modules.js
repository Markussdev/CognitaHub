import logoImg from '../assets/logo-icon-transparent.webp'
import { escapeHtml } from '../utils/html.js'
import { getLandmarkPreset } from '../config/module-visuals.js'

// Seleção de módulos = cena por módulo (Duolingo ABC), navegação horizontal
// por setas/swipe — não rolagem vertical. Cada landmark carrega seu próprio
// ambiente (céu, sol/lua, estrelas, nuvens); o tema não é mais um capítulo
// fixo, é escolha por módulo (ver module-visuals.js).
//
// Estados do banco → estados visuais:
//   concluido            → completed (colorida + check; conquista, não cinza)
//   liberado             → current   (destaque, única clicável)
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

export function renderModules(root, { childName, modules, onOpenModule, onOpenSettings, initialPageIndex }) {
  const currentModuleIndex = Math.max(
    modules.findIndex((m) => m.status === 'liberado' || m.status === 'aguardando_revisao'),
    0,
  )
  // Volta pra página que a criança estava vendo (não necessariamente o
  // módulo jogável), senão o carrossel "reinicia" toda vez que ela volta
  // de configurações ou da trilha.
  const startIndex = initialPageIndex ?? currentModuleIndex

  const scenesHtml = modules
    .map((module, index) => {
      const visual = getLandmarkPreset(index)
      const env = visual.environment
      const ground = visual.ground ?? {
        type: 'plain',
        top: env.horizon,
        bottom: env.horizon,
        detail: env.horizon,
        start: '67%',
        startSmall: '64%',
      }
      const state = stationState(module.status)
      const clickable = state === 'current'
      const tag = clickable ? 'button' : 'section'
      const attrs = clickable ? `type="button" data-module-id="${module.id}"` : ''

      // O título pedagógico vem do banco — o landmark é cenário, não
      // conteúdo. Só cai pro nome do preset se o módulo não tiver título
      // próprio (não deveria acontecer com dado real).
      const moduleTitle = module.trail_modules?.title ?? visual.label

      const badge =
        state === 'locked'
          ? `<span class="module-scene__lock" aria-hidden="true">${LOCK_SVG}</span>`
          : state === 'completed'
            ? `<span class="module-scene__check" aria-hidden="true">${CHECK_SVG}</span>`
            : ''

      const sel = visual.selection
      const sceneStyle = [
        `--landmark-width:${sel.landmarkWidth}`,
        `--landmark-y:${sel.landmarkY}`,
        `--sky-top:${env.skyTop}`,
        `--sky-bottom:${env.skyBottom}`,
        `--glow:${env.glow}`,
        `--stars:${env.stars}`,
        `--clouds:${env.clouds}`,
        `--ground-top:${ground.top}`,
        `--ground-bottom:${ground.bottom}`,
        `--ground-detail:${ground.detail}`,
        `--ground-start:${ground.start}`,
        `--ground-start-small:${ground.startSmall}`,
      ].join(';')

      return `
        <${tag}
          class="module-scene module-scene--${state} module-scene--${env.celestial}"
          ${attrs}
          style="${sceneStyle}"
          aria-label="${escapeHtml(moduleTitle)} — ${STATUS_TEXT[module.status] ?? ''}"
        >
          <div class="module-scene__sky" aria-hidden="true"></div>
          <div class="module-scene__clouds" aria-hidden="true"></div>
          <div class="module-scene__ground module-scene__ground--${ground.type}" aria-hidden="true"></div>

          <div class="module-scene__content">
            <div class="module-scene__art">
              <img class="module-scene__station" src="${visual.image}" alt="" aria-hidden="true" />
              ${badge}
            </div>

            <div class="module-scene__copy">
              <span class="module-scene__eyebrow">Módulo ${index + 1} de ${modules.length}</span>
              <h2>${escapeHtml(moduleTitle)}</h2>
              <p>${STATUS_TEXT[module.status] ?? ''}</p>
            </div>
          </div>
        </${tag}>
      `
    })
    .join('')

  const dotsHtml = modules.map((_, i) => `<span class="modules-dots__dot" data-dot="${i}"></span>`).join('')

  root.innerHTML = `
    <div class="screen screen--modules">
      <header class="modules-header">
        <img src="${logoImg}" alt="" />
        <div>
          <h1>Jornada de ${escapeHtml(childName)}</h1>
          <p>Escolha seu próximo módulo</p>
        </div>
        <button class="modules-header__settings" type="button" aria-label="Abrir configurações">⚙</button>
      </header>

      <main class="modules-scenes">
        ${scenesHtml}
      </main>

      <button class="modules-arrow modules-arrow--prev" type="button" data-modules-arrow="prev" aria-label="Módulo anterior">‹</button>
      <button class="modules-arrow modules-arrow--next" type="button" data-modules-arrow="next" aria-label="Próximo módulo">›</button>
      <div class="modules-dots" aria-hidden="true">${dotsHtml}</div>
    </div>
  `

  root.querySelectorAll('[data-module-id]').forEach((scene) => {
    scene.addEventListener('click', () => {
      const module = modules.find((item) => item.id === scene.dataset.moduleId)
      if (module) onOpenModule?.(module)
    })
  })

  root.querySelector('.modules-header__settings')?.addEventListener('click', () => onOpenSettings?.())

  // Carrossel horizontal (Duolingo ABC), não rolagem vertical — uma cena
  // por página, setas + pontos + swipe nativo do scroll-snap.
  const scroller = root.querySelector('.modules-scenes')
  const dots = [...root.querySelectorAll('[data-dot]')]
  const scenes = [...root.querySelectorAll('.module-scene')]
  const prevBtn = root.querySelector('[data-modules-arrow="prev"]')
  const nextBtn = root.querySelector('[data-modules-arrow="next"]')
  const lastIndex = modules.length - 1
  let page = startIndex

  function setPage(index, behavior) {
    page = Math.max(0, Math.min(lastIndex, index))
    scroller.scrollTo({ left: page * scroller.clientWidth, behavior })
    updateControls()
  }

  function updateControls() {
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === page))
    scenes.forEach((scene, i) => scene.classList.toggle('is-active-page', i === page))
    prevBtn.disabled = page <= 0
    nextBtn.disabled = page >= lastIndex
  }

  prevBtn?.addEventListener('click', () => setPage(page - 1, 'smooth'))
  nextBtn?.addEventListener('click', () => setPage(page + 1, 'smooth'))

  // Swipe/arraste nativo (scroll-snap) também precisa manter os pontos e
  // as setas sincronizados — só os cliques nas setas não bastam.
  let syncRaf = null
  scroller.addEventListener('scroll', () => {
    if (syncRaf) return
    syncRaf = requestAnimationFrame(() => {
      page = Math.round(scroller.scrollLeft / scroller.clientWidth)
      updateControls()
      syncRaf = null
    })
  })

  setPage(startIndex, 'auto')
}
