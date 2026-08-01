// O enunciado nunca pode mostrar o algarismo-alvo — senão a criança só
// copia o símbolo da pergunta pra uma das opções, sem precisar reconhecer
// número nenhum. Por extenso quebra esse pareamento visual direto (a
// palavra "cinco" não se parece com o botão "5").
const NUMEROS_POR_EXTENSO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
function porExtenso(numero) {
  return NUMEROS_POR_EXTENSO[numero] ?? String(numero)
}

function shuffle(list) {
  const arr = [...list]

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}

function optionsForLevel(config = {}) {
  const maximum = config.maiorNumero || 5
  const base = config.opcoes || 4
  const level = config.nivel || 1

  return Math.max(3, Math.min(maximum, base + Math.floor((level - 1) / 2)))
}

export function mountIdentifying(stageEl, { config = {}, onSuccess }) {
  const maximum = config.maiorNumero || 5
  const totalOptions = optionsForLevel(config)
  const target = 1 + Math.floor(Math.random() * maximum)

  const distractors = []

  for (let number = 1; number <= maximum; number += 1) {
    if (number !== target) distractors.push(number)
  }

  const options = shuffle([target, ...shuffle(distractors).slice(0, totalOptions - 1)])

  let completed = false

  stageEl.innerHTML = ''

  const instruction = document.createElement('p')
  instruction.className = 'identifying-instruction'
  instruction.textContent = `Toque no número ${porExtenso(target)}.`

  const grid = document.createElement('div')
  grid.className = 'identifying-grid'
  grid.setAttribute('role', 'group')
  grid.setAttribute('aria-label', 'Opções de números')

  options.forEach((number) => {
    const button = document.createElement('button')

    button.type = 'button'
    button.className = 'identifying-option'
    button.textContent = String(number)
    button.setAttribute('aria-label', String(number))

    button.addEventListener('click', () => {
      if (completed) return

      if (number === target) {
        completed = true
        button.classList.add('is-correct')

        setTimeout(() => {
          onSuccess?.()
        }, 550)

        return
      }

      button.classList.add('is-wrong')

      setTimeout(() => {
        button.classList.remove('is-wrong')
      }, 450)
    })

    grid.appendChild(button)
  })

  stageEl.append(instruction, grid)

  return true
}
