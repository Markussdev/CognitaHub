import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { renderLoading } from './screens/loading.js'
import { renderPairing } from './screens/pairing.js'
import { renderJourney } from './screens/journey.js'
import { renderMission } from './screens/mission.js'
import { statusMessageHtml } from './components/status-message.js'
import { escapeHtml } from './utils/html.js'
import { ensureAnonymousSession } from './services/auth.js'
import { claimPairingCode, getPairedChildContext } from './services/pairing.js'
import { getChildTrail, getChildTrailModules, getModuleMissions } from './services/trails.js'
import { getChildActivity } from './services/activities.js'
import { createActivityExecution } from './services/executions.js'

// Etapa 6: ciclo fechado — jornada, execução das missões suportadas e
// gravação de atividade_execucao. O banco controla o progresso; o
// aplicativo recarrega a jornada após cada alteração (missão concluída,
// botão "Atualizar jornada" ou retomada do segundo plano).
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
  }
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
      showAwaitingJourney(root, context)
      return
    }

    const trail = await getChildTrail(context.child_trail_id)
    const modules = await getChildTrailModules(context.child_trail_id)

    const currentModule = modules.find((module) => module.status !== 'concluido') ?? modules.at(-1)

    const missions =
      !currentModule || currentModule.status === 'bloqueado' ? [] : await getModuleMissions(currentModule.id)

    renderJourney(root, {
      childName: context.primeiro_nome,
      trail,
      modules,
      currentModule,
      missions,

      onRefresh() {
        renderLoading(root)
        boot(root)
      },

      async onOpenMission(activityId) {
        renderLoading(root)
        try {
          const activity = await getChildActivity(activityId)
          renderMission(root, {
            activity,
            onExit: () => boot(root),

            async onComplete(result) {
              await createActivityExecution({
                activity,
                executedBy: session.user.id,
                durationSeconds: result.durationSeconds,
              })

              renderLoading(root)
              await boot(root)
            },
          })
        } catch (err) {
          showError(root, err)
        }
      },
    })
  } catch (err) {
    showError(root, err)
  } finally {
    booting = false
  }
}

function showPairing(root) {
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
