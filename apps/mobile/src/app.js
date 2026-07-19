import { renderLoading } from './screens/loading.js'
import { renderPairing } from './screens/pairing.js'
import { renderJourney } from './screens/journey.js'
import { statusMessageHtml } from './components/status-message.js'
import { ensureAnonymousSession } from './services/auth.js'
import { claimPairingCode, getPairedChildContext } from './services/pairing.js'

// Etapa 2: sessão anônima + pareamento reais contra o Supabase.
// A leitura da jornada/módulos/missões de verdade (trails.js) ainda não
// existe — quando o dispositivo já está pareado e tem child_trail_id, a
// tela de jornada mostra o nome real da criança mas a lista de missões
// continua com os dados demo até a etapa 4.
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

    renderJourney(root, { childName: context.primeiro_nome })
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
