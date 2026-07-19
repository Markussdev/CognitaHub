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

// Etapa 4: jornada formal + execução da missão (molde "contar"). Gravar
// atividade_execucao e desbloquear a próxima missão ainda não existe —
// voltar do mapa recarrega o mesmo estado.
export async function initApp(root) {
  renderLoading(root)
  await boot(root)
}

async function boot(root) {
  try {
    await ensureAnonymousSession()
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

      async onOpenMission(activityId) {
        renderLoading(root)
        try {
          const activity = await getChildActivity(activityId)
          renderMission(root, {
            activity,
            onExit: () => boot(root),
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

function showPairing(root) {
  const pairing = renderPairing(root, {
    async onSubmit(code) {
      try {
        await claimPairingCode(code)
        renderLoading(root)
        await boot(root)
      } catch {
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
