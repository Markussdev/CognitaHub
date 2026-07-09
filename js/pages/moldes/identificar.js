// Molde Identificar — segundo molde a plugar na casca do Modo Criança.
// Contrato de montagem: mount(slotEl, { tema, config, onResultado }) =>
// { avaliar, instrucao }. `instrucao` é a única extensão em relação ao
// contrato do molde contar: aqui o alvo é sorteado a cada rodada, então o
// texto que a criança lê ("Toque no número 3") muda toda vez — o molde
// devolve a frase certa e a casca prioriza isso sobre o instrucao estático
// do contrato (ver render()/montarMolde() em modo-crianca.js). O contar não
// devolve isso e continua funcionando exatamente igual.

const TEMAS = {
  numeros: { formatarOpcao: (n) => String(n) },
}

function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// A casca só mexe em config.nivel (genérico, mold-agnostic). Aqui, mais
// nível = mais opções na tela (mais distração), sempre limitado pelo teto
// de maiorNumero — mesma ideia de quantidadeParaNivel em moldes/contar.js.
function opcoesParaNivel(config) {
  const maior = config.maiorNumero || 5
  const base = config.opcoes || 4
  const nivel = config.nivel || 1
  return Math.max(3, Math.min(maior, base + Math.floor((nivel - 1) / 2)))
}

let estiloInjetado = false
function injetarEstilos() {
  if (estiloInjetado) return
  estiloInjetado = true
  const style = document.createElement('style')
  style.textContent = `
    .molde-identificar { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; max-width: 420px; }
    .molde-identificar-item {
      width: 92px; height: 92px; border-radius: 24px;
      background: #fff; border: 2px solid rgba(20,17,98,.12);
      display: grid; place-items: center; cursor: pointer; padding: 10px;
      font: inherit; font-family: var(--font-display); font-weight: 800;
      font-size: 2rem; color: var(--brand-deep);
      transition: transform .12s ease, border-color .12s ease, background .12s ease;
    }
    .molde-identificar-item:active { transform: scale(.94); }
    .molde-identificar-item.certo {
      border-color: var(--ok); background: var(--ok-soft); color: var(--ok);
      animation: molde-identificar-pop .3s ease;
    }
    .molde-identificar-item.errado {
      border-color: var(--warn); background: var(--warn-soft);
      animation: molde-identificar-shake .3s ease;
    }
    @keyframes molde-identificar-pop {
      0% { transform: scale(1); } 45% { transform: scale(1.08); } 100% { transform: scale(1); }
    }
    /* tremor pequeno, não é punição — só sinaliza "não essa" sem travar a rodada */
    @keyframes molde-identificar-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
  `
  document.head.appendChild(style)
}

export function mount(slotEl, { tema, config, onResultado }) {
  injetarEstilos()

  const temaDef = TEMAS[tema] || TEMAS.numeros
  const maior = config.maiorNumero || 5
  const totalOpcoes = opcoesParaNivel(config)

  const alvo = 1 + Math.floor(Math.random() * maior)
  const distratores = []
  for (let n = 1; n <= maior; n += 1) if (n !== alvo) distratores.push(n)
  const escolhidos = shuffle([alvo, ...shuffle(distratores).slice(0, Math.max(0, totalOpcoes - 1))])

  let concluido = false

  slotEl.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'molde-identificar'
  wrap.setAttribute('role', 'group')
  wrap.setAttribute('aria-label', 'Opções para identificar')

  escolhidos.forEach((n) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'molde-identificar-item'
    item.textContent = temaDef.formatarOpcao(n)
    item.setAttribute('aria-label', String(n))

    item.addEventListener('click', () => {
      if (concluido) return

      if (n === alvo) {
        concluido = true
        item.classList.add('certo')
        setTimeout(() => onResultado('acerto'), 550)
      } else {
        // Errar não avança nem encerra nada — só um tremor calmo, e a
        // criança tenta de novo na mesma rodada (mesma decisão pedagógica
        // do molde contar: só acerto conta).
        item.classList.add('errado')
        setTimeout(() => item.classList.remove('errado'), 450)
      }
    })

    wrap.appendChild(item)
  })

  slotEl.appendChild(wrap)

  return {
    avaliar: () => (concluido ? 'acerto' : 'dificuldade'),
    instrucao: `Toque no número ${temaDef.formatarOpcao(alvo)}.`,
  }
}
