import { mascotHtml } from '../components/mascot.js'
import { statusMessageHtml } from '../components/status-message.js'

const GROUP_LEN = 4

// mode 'initial' = primeiro pareamento do aparelho (tela cheia, sem volta).
// mode 'switch' = troca de criança a partir de "Para responsáveis" — o
// vínculo atual só muda se um código VÁLIDO for enviado (claim_pairing_code
// já resolve isso no banco); até lá, cancelar ou digitar errado não afeta
// a criança conectada agora.
export function renderPairing(root, { mode = 'initial', onSubmit, onCancel } = {}) {
  const isSwitch = mode === 'switch'
  const title = isSwitch ? 'Trocar criança' : 'Digite seu código'
  const subtitle = isSwitch
    ? 'Digite o novo código enviado pelo responsável ou tutor.'
    : 'Peça o código de 8 letras para o seu tutor ou responsável.'
  const submitLabel = isSwitch ? 'Conectar' : 'Entrar'

  root.innerHTML = `
    <div class="screen screen--pairing">
      ${isSwitch ? '' : mascotHtml({ size: 'sm' })}
      <h1 class="title">${title}</h1>
      <p class="subtitle">${subtitle}</p>

      <form class="code-form" id="pairing-form">
        <div class="code-groups">
          <input class="code-input" id="code-a" inputmode="text" maxlength="${GROUP_LEN}" autocapitalize="characters" autocomplete="off" aria-label="Primeiros 4 caracteres do código" />
          <span class="code-dash" aria-hidden="true">-</span>
          <input class="code-input" id="code-b" inputmode="text" maxlength="${GROUP_LEN}" autocapitalize="characters" autocomplete="off" aria-label="Últimos 4 caracteres do código" />
        </div>
        <button class="btn-primary" id="pairing-submit" type="submit" disabled>${submitLabel}</button>
        ${isSwitch ? `<button class="btn-text" id="pairing-cancel" type="button">Cancelar</button>` : ''}
      </form>

      <div id="pairing-status"></div>

      ${isSwitch ? '' : `<p class="help-text">O código aparece na tela do tutor e vale por 10 minutos.</p>`}
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

  root.querySelector('#pairing-cancel')?.addEventListener('click', () => onCancel?.())

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitBtn.disabled) return
    const code = inputA.value + inputB.value
    statusEl.innerHTML = ''
    submitBtn.disabled = true
    submitBtn.textContent = isSwitch ? 'Conectando...' : 'Entrando...'
    try {
      await onSubmit?.(code)
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = submitLabel
    }
  })

  return {
    showStatus(type, text) {
      statusEl.innerHTML = statusMessageHtml({ type, text })
    },
  }
}
