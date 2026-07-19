import { renderLoading } from './screens/loading.js'
import { renderPairing } from './screens/pairing.js'
import { renderJourney } from './screens/journey.js'
import { statusMessageHtml } from './components/status-message.js'
import { ensureAnonymousSession } from './services/auth.js'
import { claimPairingCode, getPairedChildContext } from './services/pairing.js'
import { getChildTrail, getChildTrailModules, getModuleMissions } from './services/trails.js'

// Etapa 3: sessão anônima + pareamento + jornada formal, tudo lido direto
// do Supabase. Ainda é só leitura — abrir uma missão entra no bloco
// seguinte (activity-runner).
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
      <h1 class="title">Oi, ${context.primeiro_nome}!</h1>
      ${statusMessageHtml({ type: 'info', text: 'Seu tutor ainda não montou sua jornada. Volte daqui a pouco.' })}
    </div>
  `
}

function showError(root, err) {
  console.error(err)
  root.innerHTML = `
    <div class="screen screen--pairing">
      ${statusMessageHtml({ type: 'error', text: 'Não foi possível conectar. Verifique a internet e tente de novo.' })}
      <button class="btn-primary" id="retry-btn" type="button">Tentar novamente</button>
    </div>
  `
  root.querySelector('#retry-btn').addEventListener('click', () => {
    renderLoading(root)
    boot(root)
  })
}
