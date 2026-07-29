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
function journeyHeaderHtml({ title, avatarSrc, missionTitle = null, progress = null, withBack = false }) {
  const context = missionTitle
    ? `
      <p class="journey-header__context">
        <strong>Agora</strong>
        <span>${escapeHtml(missionTitle)}</span>
      </p>
    `
    : ''

  // Barrinha dourada no lugar do "5 / 12" escondido no painel lateral —
  // a criança vê o quanto anda faltando sem precisar ler número nenhum.
  const progressBar = progress
    ? `
      <div class="journey-header__progress" role="img" aria-label="Missão ${progress.current} de ${progress.total}">
        <span style="width:${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%"></span>
      </div>
    `
    : ''

  const back = withBack
    ? `<button class="journey-header__back" type="button" aria-label="Voltar aos módulos">‹</button>`
    : ''

  return `
    <div class="journey-header ${withBack ? 'journey-header--with-back' : ''}">
      ${back}
      <img src="${avatarSrc}" alt="" />
      <div class="journey-header__copy">
        <h1 class="title">${escapeHtml(title)}</h1>
        ${context}
        ${progressBar}
      </div>
    </div>
  `
}

export function renderJourney(
  root,
  { childName, childAvatar, trail, currentModule, missions, moduleVisual, onBack, onOpenMission, onRefresh },
) {
  const fallbackTitle = `Jornada de ${childName}`
  const header = journeyHeaderHtml({ title: fallbackTitle, avatarSrc: childAvatar })

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
    renderModuleComplete(root, journeyHeaderHtml({ title: moduleTitle, avatarSrc: childAvatar, withBack: Boolean(onBack) }), {
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
    avatarSrc: childAvatar,
    missionTitle: currentMission?.mission_templates?.title,
    progress: { current: Math.max(currentIndex + 1, 1), total: displayMissions.length },
    withBack: Boolean(onBack),
  })
  const { height, nodes, landmarkY, landmarkPathPoint } = computeLayout(displayMissions.length)

  const segmentDefs = nodes.slice(0, -1).map((pos, i) => {
    const state = displayMissions[i + 1].status === 'concluida' ? 'done' : i + 1 === currentIndex ? 'current' : 'future'
    return { d: segmentPath(pos, nodes[i + 1]), state }
  })

  // O landmark é o destino da jornada, não um enfeite solto — o caminho
  // continua até a base dele.
  segmentDefs.push({ d: segmentPath(nodes.at(-1), landmarkPathPoint), state: 'future' })

  // Duas passadas nos mesmos segmentos: embaixo a "estrada" contínua na
  // cor de detalhe do terreno (o mesmo caminho de terra/pedra/tapete que
  // sai da porta do prédio na seleção de módulos), em cima o pontilhado
  // de progresso.
  const roadHtml = segmentDefs.map(({ d }) => `<path d="${d}" fill="none" />`).join('')
  const trailHtml = segmentDefs
    .map(({ d, state }) => `<path d="${d}" class="journey-path__seg journey-path__seg--${state}" fill="none" />`)
    .join('')

  const nodesHtml = displayMissions
    .map((mission, i) =>
      missionNodeHtml({
        title: mission.mission_templates.title,
        state: MISSION_STATES[mission.status] ?? 'locked',
        activityId: mission.status === 'disponivel' ? mission.child_activities?.[0]?.id ?? null : null,
        x: nodes[i].x,
        y: nodes[i].y,
        isCheckpoint: (i + 1) % 4 === 0,
      }),
    )
    .join('')

  const landmarkWidth = moduleVisual?.journey?.landmarkWidth ?? '140px'

  // O preset chega inteiro — antes a trilha usava só image/title/width e
  // redesenhava um mundo genérico por cima. Agora as custom properties
  // vão na .screen--journey (não só no mundo) pro cabeçalho e a moldura
  // desktop herdarem o tema também; céu, horizonte, terreno, estrelas e
  // nuvens são desenhados com o MESMO vocabulário do modules.css.
  const env = moduleVisual?.environment ?? {}
  const ground = moduleVisual?.ground ?? {}
  const themeVars = [
    `--sky-top:${env.skyTop ?? '#202a76'}`,
    `--sky-bottom:${env.skyBottom ?? '#3c4bae'}`,
    `--horizon:${env.horizon ?? '#8fa2dc'}`,
    `--glow:${env.glow ?? '#7ac9ff'}`,
    `--stars:${env.stars ?? 0}`,
    `--clouds:${env.clouds ?? 0}`,
    `--ground-top:${ground.top ?? '#5a68a8'}`,
    `--ground-bottom:${ground.bottom ?? '#3c4bae'}`,
    `--ground-detail:${ground.detail ?? '#6b79b4'}`,
  ].join(';')

  // O céu acaba logo abaixo da base do landmark — ele senta na linha do
  // horizonte e todo o resto da coluna é terreno do tema, não degradê.
  const horizonY = landmarkY + 80

  // Reaproveita o mesmo cenário (árvores, folhagem, páginas, pegadas) já
  // usado na seleção de módulos — sem asset novo. Só a Biblioteca e o
  // Museu dos Dinossauros têm isso hoje; os outros temas ficam só com a
  // paleta (céu/chão/brilho) até ganharem seus próprios props.
  const sceneryHtml = (moduleVisual?.scenery ?? [])
    .map((item) => {
      const isBackdrop = item.className?.includes('scenery--backdrop')
      const isFloat = item.className?.includes('scenery--float')

      // Três alturas, não duas: backdrop atrás do landmark no horizonte,
      // props flutuantes (páginas) no céu, props de chão (pegadas) no
      // terreno depois da saída — pegada voando ao lado do crânio não.
      const top = isBackdrop ? landmarkY + 46 : isFloat ? landmarkY - 78 : landmarkY + 138
      const left = isBackdrop ? '50%' : isFloat ? '74%' : '64%'
      const width = isBackdrop ? '230px' : isFloat ? '84px' : '92px'
      const rotate = !isBackdrop && item.rotate ? `rotate:${item.rotate};` : ''
      const opacity = !isBackdrop && item.opacity ? `opacity:${item.opacity};` : ''
      return `
        <img
          src="${item.src}"
          alt=""
          aria-hidden="true"
          class="journey-scenery${isBackdrop ? ' journey-scenery--backdrop' : ''}${isFloat ? ' journey-scenery--float' : ''}"
          style="top:${top}px;left:${left};width:${width};${rotate}${opacity}"
        />
      `
    })
    .join('')

  root.innerHTML = `
    <div class="screen screen--journey" style="${themeVars}">
      ${headerWithContext}
      <div class="journey-world journey-world--ground-${ground.type ?? 'plain'}" style="height:${height}px;--horizon-y:${horizonY}px">
        <div class="journey-world__sky" aria-hidden="true">
          <div class="journey-world__stars"></div>
          <div class="journey-world__clouds"></div>
        </div>
        <div class="journey-world__horizon" aria-hidden="true"></div>

        <svg class="journey-path" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">
          <g class="journey-path__road">${roadHtml}</g>
          ${trailHtml}
        </svg>

        ${sceneryHtml}

        <div class="journey-landmark" style="top:${landmarkY}px;--landmark-width:${landmarkWidth};" aria-hidden="true">
          <img src="${landmarkImg}" alt="" />
        </div>

        <div class="journey-nodes">
          ${nodesHtml}
        </div>
      </div>

      <nav class="journey-scroll-controls" aria-label="Navegação pela trilha">
        <button type="button" data-journey-scroll="up" aria-label="Subir na trilha">↑</button>
        <button type="button" data-journey-scroll="current" aria-label="Voltar à missão atual">●</button>
        <button type="button" data-journey-scroll="down" aria-label="Descer na trilha">↓</button>
      </nav>
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
  scrollTarget?.scrollIntoView({ behavior: 'auto', block: 'center' })

  // Setinhas laterais só aparecem em telas largas (desktop) — no celular
  // a rolagem por toque/roda já resolve, os botões só ocupariam espaço.
  const journeyScreen = root.querySelector('.screen--journey')
  const scrollAmount = () => Math.max(380, journeyScreen.clientHeight * 0.72)

  root.querySelector('[data-journey-scroll="up"]')?.addEventListener('click', () => {
    journeyScreen.scrollBy({ top: -scrollAmount(), behavior: 'smooth' })
  })
  root.querySelector('[data-journey-scroll="down"]')?.addEventListener('click', () => {
    journeyScreen.scrollBy({ top: scrollAmount(), behavior: 'smooth' })
  })
  root.querySelector('[data-journey-scroll="current"]')?.addEventListener('click', () => {
    scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
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
