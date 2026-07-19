import dino0 from '../assets/activities/dinosaurs/dinossauro.png'
import dino1 from '../assets/activities/dinosaurs/dinossauro1.png'
import dino2 from '../assets/activities/dinosaurs/dinossauro2.png'
import dino3 from '../assets/activities/dinosaurs/dinossauro3.png'
import dino4 from '../assets/activities/dinosaurs/dinossauro4.png'
import dino5 from '../assets/activities/dinosaurs/dinossauro5.png'
import dino6 from '../assets/activities/dinosaurs/dinossauro6.png'
import dino7 from '../assets/activities/dinosaurs/dinossauro7.png'

const TEMAS = {
  dinossauros: [dino0, dino1, dino2, dino3, dino4, dino5, dino6, dino7],
}

function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// A casca só mexe em config.nivel (genérico, mold-agnostic); cabe ao
// molde decidir o que "nível" significa — aqui, mais nível = mais itens.
function quantidadeParaNivel(config) {
  const base = config?.quantidade || 5
  const nivel = config?.nivel || 1
  return Math.max(3, Math.min(8, base + (nivel - 1)))
}

// Uma rodada: escolhe N itens, a criança toca em cada um, onSuccess()
// dispara quando todos estiverem contados. Sem estado entre rodadas —
// quem controla repetição (config.rodadas) é o runner.
export function mountCounting(stageEl, { tema, config, onSuccess }) {
  const banco = TEMAS[tema] || TEMAS.dinossauros
  const quantidade = quantidadeParaNivel(config)
  const escolhidos = shuffle(banco).slice(0, quantidade)
  let contados = 0
  let concluido = false

  stageEl.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'counting'

  const contador = document.createElement('p')
  contador.className = 'counting-counter'
  contador.textContent = `0 de ${quantidade}`

  const grade = document.createElement('div')
  grade.className = 'counting-grid'
  grade.setAttribute('role', 'group')
  grade.setAttribute('aria-label', 'Itens para contar')

  escolhidos.forEach((src) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'counting-item'
    item.setAttribute('aria-pressed', 'false')
    item.setAttribute('aria-label', 'Toque para contar')

    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    item.appendChild(img)

    item.addEventListener('click', () => {
      if (concluido || item.classList.contains('is-counted')) return

      contados += 1
      item.classList.add('is-counted')
      item.setAttribute('aria-pressed', 'true')

      const badge = document.createElement('span')
      badge.className = 'counting-badge'
      badge.textContent = String(contados)
      badge.setAttribute('aria-hidden', 'true')
      item.appendChild(badge)

      contador.textContent = `${contados} de ${quantidade}`

      if (contados === quantidade) {
        concluido = true
        contador.classList.add('is-complete')
        setTimeout(() => onSuccess?.(), 650)
      }
    })

    grade.appendChild(item)
  })

  wrap.append(contador, grade)
  stageEl.appendChild(wrap)

  return true
}
