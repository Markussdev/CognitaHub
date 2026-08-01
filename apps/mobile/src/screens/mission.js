import { mascotHtml } from '../components/mascot.js'
import { statusMessageHtml } from '../components/status-message.js'
import { escapeHtml } from '../utils/html.js'
import { mountActivity } from '../activities/activity-runner.js'

// welcome -> playing (1..rodadas) -> feedback -> playing|finished
export function renderMission(root, { activity, onExit, onComplete }) {
  renderWelcome(root, activity, onExit, onComplete)
}

function renderWelcome(root, activity, onExit, onComplete) {
  root.innerHTML = `
    <div class="screen screen--mission">
      ${mascotHtml({ size: 'sm' })}
      <h1 class="title">${escapeHtml(activity.titulo || 'Vamos começar?')}</h1>
      ${activity.instrucao ? `<p class="subtitle">${escapeHtml(activity.instrucao)}</p>` : ''}
      <button class="btn-primary" id="start-btn" type="button">Começar</button>
      <button class="btn-text" id="exit-btn" type="button">Voltar ao mapa</button>
    </div>
  `

  root.querySelector('#exit-btn').addEventListener('click', () => onExit?.())
  root.querySelector('#start-btn').addEventListener('click', () => {
    runRounds(root, activity, onExit, onComplete, Date.now())
  })
}

function runRounds(root, activity, onExit, onComplete, startedAt) {
  const totalRounds = activity.config?.rodadas || 1
  let round = 1

  playRound()

  function playRound() {
    root.innerHTML = `
      <div class="screen screen--mission">
        <p class="mission-round">Rodada ${round} de ${totalRounds}</p>
        <div class="mission-stage" id="mission-stage"></div>
      </div>
    `

    const stageEl = root.querySelector('#mission-stage')
    const mounted = mountActivity(activity, { stageEl, onSuccess: handleRoundDone })

    if (!mounted) {
      renderUnsupported(root, onExit)
    }
  }

  function handleRoundDone() {
    const isLastRound = round >= totalRounds
    renderFeedback(root, {
      onContinue: () => {
        if (isLastRound) {
          renderFinished(root, { onComplete, startedAt })
        } else {
          round += 1
          playRound()
        }
      },
    })
  }
}

function renderFeedback(root, { onContinue }) {
  root.innerHTML = `
    <div class="screen screen--mission">
      ${mascotHtml({ size: 'sm' })}
      ${statusMessageHtml({ type: 'success', text: 'Mandou muito bem!' })}
      <button class="btn-primary" id="continue-btn" type="button">Continuar</button>
    </div>
  `
  root.querySelector('#continue-btn').addEventListener('click', onContinue)
}

function renderFinished(root, { onComplete, startedAt }) {
  root.innerHTML = `
    <div class="screen screen--mission">
      ${mascotHtml()}
      <h1 class="title">Missão concluída por hoje!</h1>
      <div id="finish-status"></div>
      <button class="btn-primary" id="finish-btn" type="button">Voltar ao mapa</button>
    </div>
  `

  const btn = root.querySelector('#finish-btn')
  const statusEl = root.querySelector('#finish-status')
  const originalLabel = btn.textContent

  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'Salvando...'
    statusEl.innerHTML = ''

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))

    try {
      await onComplete({ durationSeconds })
    } catch (err) {
      console.error(err)
      statusEl.innerHTML = statusMessageHtml({
        type: 'error',
        text: 'Não conseguimos salvar esta missão. Confira a internet e tente novamente.',
      })
      btn.disabled = false
      btn.textContent = originalLabel
    }
  })
}

function renderUnsupported(root, onExit) {
  root.innerHTML = `
    <div class="screen screen--mission">
      ${statusMessageHtml({ type: 'info', text: 'Esta atividade ainda não está disponível neste aplicativo.' })}
      <button class="btn-primary" id="back-btn" type="button">Voltar ao mapa</button>
    </div>
  `
  root.querySelector('#back-btn').addEventListener('click', () => onExit?.())
}
