// Página Mundo SENAI 2026 (pages/mundo-senai.html): apresentação de 4 slides embutida na própria página.
//
// Independência: este arquivo não importa o cliente do Supabase, não faz requisição e não lê nem
// grava dado algum. A única demonstração ("Liberar missão", slide 2) é um estado local, em memória,
// com dados fictícios. Se a internet cair depois do carregamento, tudo continua funcionando (as
// fontes caem para a fonte do sistema se não estiverem em cache).
//
// Navegação: botões anterior/próximo, pontos indicadores e setas ← → do teclado. Nada avança sozinho.
//
// Os slides 3 e 4 se animam só com CSS: cada slide escondido tem display:none, então a animação
// recomeça sozinha toda vez que ele volta a aparecer. Ao reabrir o slide 2, o estado da demonstração
// é restaurado aqui. Sem JavaScript, o slide 1 continua visível e completo.

const show = document.querySelector('[data-show]')

function iniciar() {
  if (!show) return

  const slides = [...show.querySelectorAll('[data-slide]')]
  const pontos = [...show.querySelectorAll('[data-ir]')]
  const anterior = show.querySelector('[data-acao="anterior"]')
  const proximo = show.querySelector('[data-acao="proximo"]')
  const liberar = show.querySelector('[data-acao="liberar"]')
  const anuncio = show.querySelector('[data-anuncio]')

  // Sem a estrutura mínima não há o que navegar: o slide 1 fica como está.
  if (slides.length < 2 || !anterior || !proximo) return

  let atual = 0

  function anunciar(texto) {
    if (!anuncio) return
    anuncio.textContent = ''
    window.setTimeout(() => { anuncio.textContent = texto }, 60)
  }

  // Estado fictício da missão (slide 2). Só um atributo no <main>: o CSS troca textos, cores e a tela da criança.
  function definirMissao(liberada, { silencioso = false } = {}) {
    show.dataset.missao = liberada ? 'liberada' : 'bloqueada'
    if (liberar) liberar.setAttribute('aria-disabled', liberada ? 'true' : 'false')
    if (silencioso) return
    anunciar(liberada
      ? 'Missão liberada. A tela da criança mostra a missão.'
      : 'Demonstração restaurada. A missão está bloqueada de novo.')
  }

  function ir(destino, sentido = 0) {
    const alvo = Math.max(0, Math.min(slides.length - 1, destino))
    atual = alvo

    slides.forEach((slide, i) => { slide.hidden = i !== alvo })
    pontos.forEach((ponto, i) => {
      if (i === alvo) ponto.setAttribute('aria-current', 'true')
      else ponto.removeAttribute('aria-current')
    })
    anterior.disabled = alvo === 0
    proximo.disabled = alvo === slides.length - 1

    // Ao (re)abrir o slide 2 a demonstração volta ao começo, para o próximo grupo.
    if (alvo === 1) definirMissao(false, { silencioso: true })

    const slide = slides[alvo]
    slide.classList.remove('is-entrando')
    if (sentido !== 0) {
      slide.style.setProperty('--dx', sentido < 0 ? '-24px' : '24px')
      void slide.offsetWidth // reinicia a animação de entrada
      slide.classList.add('is-entrando')
    }
    const area = show.querySelector('.show__slides')
    if (area) area.scrollTop = 0

    const titulo = slide.querySelector('h2')
    anunciar(`Slide ${alvo + 1} de ${slides.length}: ${titulo ? titulo.textContent.trim() : ''}`)
  }

  show.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button')
    if (!botao || !show.contains(botao)) return
    const { acao, ir: destino } = botao.dataset

    if (destino) {
      const n = Number(destino) - 1
      if (n !== atual) ir(n, n > atual ? 1 : -1)
      return
    }

    switch (acao) {
      case 'anterior':
        if (atual > 0) ir(atual - 1, -1)
        break
      case 'proximo':
        if (atual < slides.length - 1) ir(atual + 1, 1)
        break
      case 'liberar':
        if (show.dataset.missao !== 'liberada') definirMissao(true)
        break
      case 'refazer':
        definirMissao(false)
        break
      default:
        break
    }
  })

  document.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      if (atual < slides.length - 1) ir(atual + 1, 1)
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault()
      if (atual > 0) ir(atual - 1, -1)
    }
  })

  definirMissao(false, { silencioso: true })
  ir(0)
}

iniciar()
