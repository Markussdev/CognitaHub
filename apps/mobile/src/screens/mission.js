import { mascotHtml } from '../components/mascot.js'
import { statusMessageHtml } from '../components/status-message.js'
import { escapeHtml } from '../utils/html.js'
import { mountActivity } from '../activities/activity-runner.js'

// welcome -> playing (1..rodadas) -> feedback -> playing|finished
export function renderMission(root, { activity, onExit }) {
  renderWelcome(root, activity, onExit)
}

function renderWelcome(root, activity, onExit) {
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
  root.querySelector('#start-btn').addEventListener('click', () => runRounds(root, activity, onExit))
}

function runRounds(root, activity, onExit) {
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
          renderFinished(root, onExit)
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

function renderFinished(root, onExit) {
  root.innerHTML = `
    <div class="screen screen--mission">
      ${mascotHtml()}
      <h1 class="title">Missão concluída por hoje!</h1>
      <button class="btn-primary" id="back-btn" type="button">Voltar ao mapa</button>
    </div>
  `
  root.querySelector('#back-btn').addEventListener('click', () => onExit?.())
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
