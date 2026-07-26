import logoImg from '../assets/logo-icon-transparent.webp'
import spaceCleanBg from '../assets/cap1/space-clean-bg.webp'
import landmarkAbacus from '../assets/cap1/landmark-abacus.webp'
import { missionNodeHtml } from '../components/mission-node.js'
import { statusMessageHtml } from '../components/status-message.js'
import { escapeHtml } from '../utils/html.js'
import { computeLayout, segmentPath } from './journey-layout.js'

const MISSION_STATES = {
  bloqueada: 'locked',
  disponivel: 'available',
  concluida: 'completed',
}

// Modo de estresse visual — só em dev, só via ?journeyNodes=12. Existe
// pra ver se o mapa aguenta uma trilha de verdade (12 missões) sem
// bagunçar o Supabase com missão fake. Nunca compila em produção porque
// import.meta.env.DEV vira `false` estático no build.
const VISUAL_TEST_TITLES = [
  'Identificar números de 1 a 3',
  'Contar objetos até 3',
  'Identificar números de 1 a 5',
  'Revisão de 1 a 5',
  'Contar objetos até 5',
  'Identificar números no espaço',
  'Contar estrelas até 5',
  'Revisão calma até 5',
  'Encontrar o número correto',
  'Contar grupos de objetos',
  'Revisão mista',
  'Desafio final do módulo',
]

function buildVisualTestMissions(missions, count = 12) {
  if (!missions.length) return missions

  const availableMission = missions.find((mission) => mission.status === 'disponivel') ?? missions[0]

  return Array.from({ length: count }, (_, index) => {
    const source = missions[index % missions.length]
    const status = index < 4 ? 'concluida' : index === 4 ? 'disponivel' : 'bloqueada'

    return {
      ...source,
      id: `visual-test-${index}`, // só pra não repetir id dentro do teste
      status,
      mission_templates: { ...source.mission_templates, title: VISUAL_TEST_TITLES[index] },
      // Só o nó marcado como atual continua abrindo uma atividade real.
      child_activities: status === 'disponivel' ? availableMission.child_activities : [],
    }
  })
}

// Dentro do módulo, o cabeçalho identifica ONDE a criança está (o nome
// dela já apareceu na seleção) — título da estação, não "Jornada de
// Fulano" de novo. Título completo da missão continua acessível via
// aria-label no próprio nó, não numa cápsula colada nele.
function journeyHeaderHtml({ title, missionTitle = null, withBack = false }) {
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
        <h1 class="title">${escapeHtml(title)}</h1>
        ${context}
      </div>
    </div>
  `
}

export function renderJourney(root, { childName, trail, currentModule, missions, moduleVisual, onBack, onOpenMission, onRefresh }) {
  const fallbackTitle = `Jornada de ${childName}`
  const header = journeyHeaderHtml({ title: fallbackTitle })

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
  // a criança entra "naquele lugar", então o destino da trilha é ele. O
  // título do cabeçalho também vira o nome dessa estação, não mais
  // "Jornada de Fulano" (isso já apareceu na seleção).
  const landmarkImg = moduleVisual?.image ?? landmarkAbacus
  const moduleTitle = moduleVisual?.title ?? fallbackTitle

  if (currentModule.status === 'aguardando_revisao') {
    renderModuleComplete(root, journeyHeaderHtml({ title: moduleTitle, withBack: Boolean(onBack) }), {
      landmarkImg,
      mascotImg: moduleVisual?.mascot,
      onRefresh,
      onBack,
    })
    return
  }

  // ?journeyNodes=12 troca a trilha real por uma trilha falsa de 12 nós
  // só pra teste visual de densidade — nunca ativa fora de dev.
  const visualTestEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('journeyNodes') === '12'
  const displayMissions = visualTestEnabled ? buildVisualTestMissions(missions, 12) : missions

  const currentIndex = displayMissions.findIndex((m) => m.status === 'disponivel')
  const currentMission = currentIndex >= 0 ? displayMissions[currentIndex] : null
  const headerWithContext = journeyHeaderHtml({
    title: moduleTitle,
    missionTitle: currentMission?.mission_templates?.title,
    withBack: Boolean(onBack),
  })
  const { height, nodes, landmarkY, landmarkPathPoint } = computeLayout(displayMissions.length)

  const missionSegments = nodes
    .slice(0, -1)
    .map((pos, i) => {
      const next = nodes[i + 1]
      const state = displayMissions[i + 1].status === 'concluida' ? 'done' : i + 1 === currentIndex ? 'current' : 'future'
      return `<path d="${segmentPath(pos, next)}" class="journey-path__seg journey-path__seg--${state}" fill="none" />`
    })
    .join('')

  // O ábaco é o destino da jornada, não um enfeite solto — o caminho
  // continua até a base dele.
  const landmarkSegment = `<path d="${segmentPath(nodes.at(-1), landmarkPathPoint)}" class="journey-path__seg journey-path__seg--future" fill="none" />`

  const segments = missionSegments + landmarkSegment

  const nodesHtml = displayMissions
    .map((mission, i) =>
      missionNodeHtml({
        title: mission.mission_templates.title,
        state: MISSION_STATES[mission.status] ?? 'locked',
        activityId: mission.status === 'disponivel' ? mission.child_activities?.[0]?.id ?? null : null,
        x: nodes[i].x,
        y: nodes[i].y,
        isCheckpoint: (i + 1) % 4 === 0,
        isCurrent: i === currentIndex,
      }),
    )
    .join('')

  const landmarkWidth = moduleVisual?.journey?.landmarkWidth ?? '140px'

  root.innerHTML = `
    <div class="screen screen--journey">
      ${headerWithContext}
      <div class="journey-world" style="height:${height}px">
        <img class="journey-world__bg" src="${spaceCleanBg}" alt="" aria-hidden="true" />

        <svg class="journey-path" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">
          ${segments}
        </svg>

        <img class="journey-landmark" src="${landmarkImg}" alt="" aria-hidden="true" style="top:${landmarkY}px;--landmark-width:${landmarkWidth};" />

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
function renderModuleComplete(root, header, { landmarkImg, mascotImg, onRefresh, onBack }) {
  const mascot = mascotImg ? `<img class="journey-complete__mascot" src="${mascotImg}" alt="" aria-hidden="true" />` : ''

  root.innerHTML = `
    <div class="screen screen--journey-complete">
      ${header}
      <div class="journey-complete__art">
        <img class="journey-complete__landmark" src="${landmarkImg}" alt="" aria-hidden="true" />
        ${mascot}
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
    <div class="screen screen--pairing screen--journey-message">
      ${header}
      ${statusMessageHtml({ type: 'info', text })}
    </div>
  `
}
