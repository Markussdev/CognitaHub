import { mascotHtml } from '../components/mascot.js'
import { statusMessageHtml } from '../components/status-message.js'

const GROUP_LEN = 4

export function renderPairing(root, { onSubmit } = {}) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      ${mascotHtml({ size: 'sm' })}
      <h1 class="title">Digite seu código</h1>
      <p class="subtitle">Peça o código de 8 letras para o seu tutor ou responsável.</p>

      <form class="code-form" id="pairing-form">
        <div class="code-groups">
          <input class="code-input" id="code-a" inputmode="text" maxlength="${GROUP_LEN}" autocapitalize="characters" autocomplete="off" aria-label="Primeiros 4 caracteres do código" />
          <span class="code-dash" aria-hidden="true">-</span>
          <input class="code-input" id="code-b" inputmode="text" maxlength="${GROUP_LEN}" autocapitalize="characters" autocomplete="off" aria-label="Últimos 4 caracteres do código" />
        </div>
        <button class="btn-primary" id="pairing-submit" type="submit" disabled>Entrar</button>
      </form>

      <div id="pairing-status"></div>

      <p class="help-text">O código aparece na tela do tutor e vale por 10 minutos.</p>
    </div>
  `

  const inputA = root.querySelector('#code-a')
  const inputB = root.querySelector('#code-b')
  const submitBtn = root.querySelector('#pairing-submit')
  const statusEl = root.querySelector('#pairing-status')
  const form = root.querySelector('#pairing-form')

  function normalize(el) {
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  function updateSubmitState() {
    submitBtn.disabled = !(inputA.value.length === GROUP_LEN && inputB.value.length === GROUP_LEN)
  }

  inputA.addEventListener('input', () => {
    normalize(inputA)
    if (inputA.value.length === GROUP_LEN) inputB.focus()
    updateSubmitState()
  })

  inputB.addEventListener('input', () => {
    normalize(inputB)
    updateSubmitState()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitBtn.disabled) return
    const code = inputA.value + inputB.value
    statusEl.innerHTML = ''
    submitBtn.disabled = true
    submitBtn.textContent = 'Entrando...'
    try {
      await onSubmit?.(code)
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Entrar'
    }
  })

  return {
    showStatus(type, text) {
      statusEl.innerHTML = statusMessageHtml({ type, text })
    },
  }
}
