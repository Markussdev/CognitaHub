// Molde Contar — o primeiro molde a plugar na casca do Modo Criança.
// Contrato de montagem: mount(slotEl, { tema, config, onResultado }) => { avaliar }.
// Não toca em nada da casca: só popula o slot recebido e chama onResultado
// quando a criança termina de contar (ou é perguntado via avaliar()).

import dino0 from '../../../assets - Atividades/dinossauro.png'
import dino1 from '../../../assets - Atividades/dinossauro1.png'
import dino2 from '../../../assets - Atividades/dinossauro2.png'
import dino3 from '../../../assets - Atividades/dinossauro3.png'
import dino4 from '../../../assets - Atividades/dinossauro4.png'
import dino5 from '../../../assets - Atividades/dinossauro5.png'
import dino6 from '../../../assets - Atividades/dinossauro6.png'
import dino7 from '../../../assets - Atividades/dinossauro7.png'

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

// A casca só mexe em config.nivel (genérico, mold-agnostic). Cabe a cada
// molde decidir o que "nível" significa pra ele — aqui, mais nível = mais
// itens pra contar.
function quantidadeParaNivel(config) {
  const base = config.quantidade || 5
  const nivel = config.nivel || 1
  return Math.max(3, Math.min(8, base + (nivel - 1)))
}

let estiloInjetado = false
function injetarEstilos() {
  if (estiloInjetado) return
  estiloInjetado = true
  const style = document.createElement('style')
  style.textContent = `
    .molde-contar { display: flex; flex-direction: column; align-items: center; gap: 18px; width: 100%; }
    .molde-contar-contador {
      font-family: var(--font-display); font-weight: 800; font-size: 1.1rem;
      color: var(--brand-deep); background: #fff; border: 1px solid rgba(20,17,98,.14);
      border-radius: 999px; padding: 7px 20px;
    }
    .molde-contar-contador.completo { color: var(--ok); border-color: rgba(28,124,84,.3); background: var(--ok-soft); }
    .molde-contar-grade { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; max-width: 460px; }
    .molde-contar-item {
      position: relative; width: 92px; height: 92px; border-radius: 24px;
      background: #fff; border: 2px solid rgba(20,17,98,.12);
      display: grid; place-items: center; cursor: pointer; padding: 10px;
      font: inherit; transition: transform .12s ease, border-color .12s ease, background .12s ease;
    }
    .molde-contar-item:active { transform: scale(.94); }
    .molde-contar-item img { width: 100%; height: 100%; object-fit: contain; }
    .molde-contar-item.contado { border-color: var(--ok); background: var(--ok-soft); animation: molde-contar-pop .3s ease; }
    @keyframes molde-contar-pop {
      0% { transform: scale(1); }
      45% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    .molde-contar-badge {
      position: absolute; top: -8px; right: -8px; width: 26px; height: 26px; border-radius: 50%;
      background: var(--ok); color: #fff; font-family: var(--font-display); font-weight: 800;
      font-size: .8rem; display: grid; place-items: center; box-shadow: 0 2px 6px rgba(28,124,84,.35);
    }
  `
  document.head.appendChild(style)
}

export function mount(slotEl, { tema, config, onResultado }) {
  injetarEstilos()

  const banco = TEMAS[tema] || TEMAS.dinossauros
  const quantidade = quantidadeParaNivel(config)
  const escolhidos = shuffle(banco).slice(0, quantidade)
  let contados = 0
  let concluido = false

  slotEl.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'molde-contar'

  const contador = document.createElement('p')
  contador.className = 'molde-contar-contador'
  contador.textContent = `0 de ${quantidade}`

  const grade = document.createElement('div')
  grade.className = 'molde-contar-grade'
  grade.setAttribute('role', 'group')
  grade.setAttribute('aria-label', 'Itens para contar')

  escolhidos.forEach((src) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'molde-contar-item'
    item.setAttribute('aria-pressed', 'false')
    item.setAttribute('aria-label', 'Toque para contar')

    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    item.appendChild(img)

    item.addEventListener('click', () => {
      if (concluido || item.classList.contains('contado')) return

      contados += 1
      item.classList.add('contado')
      item.setAttribute('aria-pressed', 'true')

      const badge = document.createElement('span')
      badge.className = 'molde-contar-badge'
      badge.textContent = String(contados)
      badge.setAttribute('aria-hidden', 'true')
      item.appendChild(badge)

      contador.textContent = `${contados} de ${quantidade}`

      if (contados === quantidade) {
        concluido = true
        contador.classList.add('completo')
        setTimeout(() => onResultado('acerto'), 650)
      }
    })

    grade.appendChild(item)
  })

  wrap.append(contador, grade)
  slotEl.appendChild(wrap)

  return {
    avaliar: () => (concluido ? 'acerto' : 'dificuldade'),
  }
}
