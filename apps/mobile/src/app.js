import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { renderLoading } from './screens/loading.js'
import { renderPairing } from './screens/pairing.js'
import { renderModules } from './screens/modules.js'
import { renderJourney } from './screens/journey.js'
import { renderMission } from './screens/mission.js'
import { renderSettings } from './screens/settings.js'
import { statusMessageHtml } from './components/status-message.js'
import { escapeHtml } from './utils/html.js'
import { ensureAnonymousSession } from './services/auth.js'
import { claimPairingCode, getPairedChildContext } from './services/pairing.js'
import { getChildTrail, getChildTrailModules, getModuleMissions } from './services/trails.js'
import { getChildActivity } from './services/activities.js'
import { createActivityExecution } from './services/executions.js'
import { LANDMARK_PRESETS, getLandmarkPreset } from './config/module-visuals.js'

// Fluxo: pareamento → seleção de módulos → trilha do módulo → atividade →
// trilha atualizada (ou módulos → configurações). O banco continua
// mandando no progresso; o app só decide qual tela mostrar. Sem router —
// `screen`/`openModule` existem só pra o botão físico de voltar do
// Android saber o que fazer em cada tela.
const appState = {
  session: null,
  context: null,
  trail: null,
  modules: [],
  currentModule: null,
  openModule: null,
  screen: 'loading',
  modulesPageIndex: null,
}

// Laboratório visual dos 7 landmarks — só em dev, via
// ?landmarkShowcase=1 (combinar com ?journeyNodes=12 pra ver cada um como
// destino de uma trilha longa). Não grava nada no Supabase: pega um módulo
// real (pra ter missões de verdade pra abrir) e clona ele 7x, um por
// preset, todos liberados.
const LANDMARK_SHOWCASE_ENABLED =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('landmarkShowcase') === '1'

function buildLandmarkShowcaseModules(realModules) {
  const sourceModule =
    realModules.find((module) => module.status === 'liberado' || module.status === 'aguardando_revisao') ??
    realModules.find((module) => module.status !== 'bloqueado') ??
    realModules[0]

  if (!sourceModule) return realModules

  return LANDMARK_PRESETS.map((preset, index) => ({
    ...sourceModule,
    id: `landmark-showcase-${preset.key}`, // id só do carrossel
    sourceModuleId: sourceModule.id, // id real, usado pra buscar as missões
    visualIndex: index, // fixa o preset certo, não depende da posição
    visualShowcase: true, // marca "não existe no banco" pro resto do app
    status: 'liberado',
    trail_modules: {
      ...sourceModule.trail_modules,
      id: `landmark-showcase-template-${preset.key}`,
      position: index + 1,
      title: preset.label,
      objective: `Teste visual do tema ${preset.label}`,
    },
  }))
}

export async function initApp(root) {
  renderLoading(root)
  await boot(root)

  // No navegador (`npm run dev`), o plugin emula isso com o
  // visibilitychange da aba — trocar de aba recarregaria a tela à toa.
  // No Android de verdade é o app sendo minimizado/reaberto, que é o que
  // interessa.
  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        renderLoading(root)
        boot(root)
      }
    })

    App.addListener('backButton', () => handleBackButton(root))
  }
}

// Atividade → jornada do mesmo módulo; jornada/configurações → módulos;
// módulos → confirma antes de sair; qualquer outra tela (pareamento,
// carregando, erro, aguardando jornada) → sai direto, não tem "voltar".
function handleBackButton(root) {
  if (appState.screen === 'mission') {
    showJourney(root, appState.openModule)
    return
  }

  if (appState.screen === 'journey' || appState.screen === 'settings') {
    showModules(root)
    return
  }

  if (appState.screen === 'modules') {
    if (window.confirm('Quer sair do Cognita?')) {
      App.exitApp()
    }
    return
  }

  App.exitApp()
}

let booting = false

async function boot(root) {
  if (booting) return
  booting = true
  try {
    const session = await ensureAnonymousSession()
    const context = await getPairedChildContext()

    if (!context) {
      showPairing(root)
      return
    }

    if (!context.child_trail_id) {
      appState.screen = 'awaiting'
      showAwaitingJourney(root, context)
      return
    }

    const trail = await getChildTrail(context.child_trail_id)
    const realModules = await getChildTrailModules(context.child_trail_id)
    const modules = LANDMARK_SHOWCASE_ENABLED ? buildLandmarkShowcaseModules(realModules) : realModules
    const currentModule = modules.find((module) => module.status !== 'concluido') ?? modules.at(-1)

    Object.assign(appState, { session, context, trail, modules, currentModule })

    // Jornada encerrada/pausada ou sem módulo nenhum: renderJourney já
    // resolve essas mensagens de estado — não faz sentido mostrar o mapa.
    if (trail?.status !== 'ativa' || modules.length === 0) {
      appState.screen = 'journey'
      renderJourney(root, {
        childName: context.primeiro_nome,
        trail,
        currentModule: null,
        missions: [],
        onRefresh: () => {
          renderLoading(root)
          boot(root)
        },
      })
      return
    }

    showModules(root)
  } catch (err) {
    appState.screen = 'error'
    showError(root, err)
  } finally {
    booting = false
  }
}

function showModules(root) {
  appState.screen = 'modules'
  appState.openModule = null

  // A criança não deveria sentir que o carrossel "reiniciou" ao voltar —
  // manda a página que ela estava vendo (não necessariamente o módulo
  // jogável). Na primeira vez ainda não existe uma, e aí renderModules
  // decide sozinho (módulo atual).
  renderModules(root, {
    childName: appState.context.primeiro_nome,
    modules: appState.modules,
    initialPageIndex: appState.modulesPageIndex ?? undefined,
    onOpenModule: (module) => showJourney(root, module),
    onOpenSettings: () => showSettings(root),
  })
}

function showSettings(root) {
  rememberModulesPage(root)
  appState.screen = 'settings'

  renderSettings(root, {
    onBack: () => showModules(root),
  })
}

function rememberModulesPage(root) {
  const scroller = root.querySelector('.modules-scenes')
  if (!scroller || !scroller.clientWidth) return
  appState.modulesPageIndex = Math.round(scroller.scrollLeft / scroller.clientWidth)
}

async function showJourney(root, module) {
  if (!module || module.status === 'bloqueado') return

  rememberModulesPage(root)
  appState.openModule = module

  renderLoading(root)
  try {
    // No showcase, o módulo do carrossel é sintético — as missões vêm do
    // módulo real por trás dele, mas o preset visual é o do landmark
    // sendo testado, não o da posição real desse módulo.
    const sourceModuleId = module.sourceModuleId ?? module.id
    const missions = await getModuleMissions(sourceModuleId)
    const moduleIndex = module.visualIndex ?? appState.modules.findIndex((item) => item.id === module.id)

    appState.screen = 'journey'
    renderJourney(root, {
      childName: appState.context.primeiro_nome,
      trail: appState.trail,
      currentModule: module,
      missions,
      moduleVisual: getLandmarkPreset(moduleIndex),

      onBack: () => showModules(root),

      onRefresh() {
        renderLoading(root)
        boot(root)
      },

      // Módulo sintético = nada de abrir atividade real nem gravar
      // execução no Supabase — o mapa só existe pra avaliar o visual.
      onOpenMission: module.visualShowcase
        ? undefined
        : async (activityId) => {
            renderLoading(root)
            try {
              const activity = await getChildActivity(activityId)
              appState.screen = 'mission'
              renderMission(root, {
                activity,
                onExit: () => showJourney(root, module),

                async onComplete(result) {
                  await createActivityExecution({
                    activity,
                    executedBy: appState.session.user.id,
                    durationSeconds: result.durationSeconds,
                  })

                  renderLoading(root)
                  await reloadJourney(root, module.id)
                },
              })
            } catch (err) {
              showError(root, err)
            }
          },
    })
  } catch (err) {
    showError(root, err)
  }
}

// Depois de concluir uma missão, a criança volta pra trilha do MESMO
// módulo com os dados frescos (caminho cresce, próximo nó abre) — não pra
// seleção de módulos, que quebraria o momento de recompensa.
async function reloadJourney(root, moduleId) {
  try {
    const modules = await getChildTrailModules(appState.context.child_trail_id)
    appState.modules = modules
    appState.currentModule = modules.find((m) => m.status !== 'concluido') ?? modules.at(-1)

    const module = modules.find((m) => m.id === moduleId) ?? appState.currentModule
    await showJourney(root, module)
  } catch (err) {
    showError(root, err)
  }
}

function showPairing(root) {
  appState.screen = 'pairing'

  const pairing = renderPairing(root, {
    async onSubmit(code) {
      try {
        await claimPairingCode(code)
        renderLoading(root)
        await boot(root)
      } catch (error) {
        console.error('Erro ao reivindicar código de pareamento:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          error,
        })
        pairing.showStatus('error', 'Código inválido ou expirado. Peça um novo código ao seu tutor.')
      }
    },
  })
}

function showAwaitingJourney(root, context) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      <h1 class="title">Oi, ${escapeHtml(context.primeiro_nome)}!</h1>
      ${statusMessageHtml({ type: 'info', text: 'Seu tutor ainda não montou sua jornada. Volte daqui a pouco.' })}
    </div>
  `
}

function showError(root, err) {
  console.error(err)
  const text =
    err?.message === 'MISSION_NOT_AVAILABLE'
      ? 'Essa missão não está mais disponível. Volte ao mapa pra ver o que você já pode fazer.'
      : 'Não foi possível conectar. Verifique a internet e tente de novo.'

  appState.screen = 'error'

  root.innerHTML = `
    <div class="screen screen--pairing">
      ${statusMessageHtml({ type: 'error', text })}
      <button class="btn-primary" id="retry-btn" type="button">Tentar novamente</button>
    </div>
  `
  root.querySelector('#retry-btn').addEventListener('click', () => {
    renderLoading(root)
    boot(root)
  })
}
