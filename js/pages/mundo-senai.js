// Página especial Mundo SENAI 2026 (pages/mundo-senai.html).
//
// Só interação visual leve: revelar as seções ao rolar, marcar no menu a seção atual e dar fundo
// de vidro ao header depois de rolar. Não faz requisição nenhuma, não importa o cliente do
// Supabase e não lê nem grava dado algum: a página é pública e independente do resto do sistema.
//
// Com movimento reduzido (ou sem IntersectionObserver) nada fica escondido: tudo aparece de uma vez.
//
// Pontos preparados para a segunda fase, ainda NÃO implementados (ver os data-slot no HTML):
//   simulador-requisicoes  fluxo da seção 2: simulador visual de requisições
//   camadas-tcpip          pacote da seção 4: visualização interativa das camadas TCP/IP
//   inspetor-http          miolo do pacote: inspeção de uma requisição HTTP
//   demo-supabase          nó "Supabase" do fluxo: demonstração real e segura (via js/data/, nunca direto)
//   modo de apresentação   body[data-modo="apresentacao"] + [data-secao] para navegar em tela cheia

const raiz = document.documentElement
const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const temObservador = 'IntersectionObserver' in window

// O CSS só esconde o que vai ser revelado quando esta classe existe: sem JS a página aparece inteira.
raiz.classList.add('js-ativo')

function revelarAoRolar() {
  const itens = document.querySelectorAll('[data-revelar]')

  if (reduzMovimento || !temObservador) {
    itens.forEach((el) => el.classList.add('is-visivel'))
    return
  }

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return
      entrada.target.classList.add('is-visivel')
      observador.unobserve(entrada.target)
    })
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })

  itens.forEach((el) => observador.observe(el))
}

function marcarSecaoAtual() {
  if (!temObservador) return
  const links = [...document.querySelectorAll('.mh__nav a[href^="#"]')]
  const porId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]))

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      const link = porId.get(entrada.target.id)
      if (!link) return
      if (entrada.isIntersecting) {
        links.forEach((a) => a.removeAttribute('aria-current'))
        link.setAttribute('aria-current', 'location')
      } else if (link.getAttribute('aria-current')) {
        link.removeAttribute('aria-current')
      }
    })
  }, { rootMargin: '-45% 0px -50% 0px' })

  document.querySelectorAll('main section[id]').forEach((secao) => {
    if (porId.has(secao.id)) observador.observe(secao)
  })
}

function fundoDoCabecalho() {
  const cabecalho = document.querySelector('[data-cabecalho]')
  if (!cabecalho) return
  let agendado = false

  const atualizar = () => {
    agendado = false
    cabecalho.classList.toggle('mh--rolado', window.scrollY > 24)
  }

  window.addEventListener('scroll', () => {
    if (agendado) return
    agendado = true
    window.requestAnimationFrame(atualizar)
  }, { passive: true })

  atualizar()
}

revelarAoRolar()
marcarSecaoAtual()
fundoDoCabecalho()
