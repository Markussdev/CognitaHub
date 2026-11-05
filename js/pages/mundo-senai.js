// Página especial Mundo SENAI 2026 (pages/mundo-senai.html).
//
// Dois modos na mesma página:
//   Explorar      body[data-modo="pagina"]        a página longa: revelar ao rolar, marcar no menu a seção
//                                                  atual e dar fundo de vidro ao header depois de rolar.
//   Apresentação  body[data-modo="apresentacao"]  o palco div.ap, em tela cheia, com 4 cenas (uma por
//                                                  integrante). A equipe controla as trocas: nada avança
//                                                  sozinho de uma cena para outra.
//
// Independência: este arquivo não importa o cliente do Supabase, não faz requisição e não lê nem grava
// dado algum. As demonstrações do palco são SIMULAÇÃO LOCAL, com dados fictícios e estados
// determinísticos ("Simulação didática"). Se a internet cair depois do carregamento, tudo continua
// funcionando (as fontes caem para a fonte do sistema se não estiverem em cache).
//
// Entrada direta no palco: ?apresentacao=1 (e &cena=1..4 para abrir numa cena).
// Teclado no palco: → / PageDown avança · ← / PageUp volta · Home / End vão à primeira / última cena.
//
// Com movimento reduzido (ou sem IntersectionObserver) nada fica escondido e nada se anima sozinho:
// as sequências das cenas 3 e 4 avançam só no clique.

const raiz = document.documentElement
const corpo = document.body
const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const temObservador = 'IntersectionObserver' in window

// O CSS só esconde o que vai ser revelado quando esta classe existe: sem JS a página aparece inteira.
raiz.classList.add('js-ativo')

// ---------------------------------------------------------------------------------------------
// Modo Explorar
// ---------------------------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------------------------
// Modo Apresentação
// ---------------------------------------------------------------------------------------------

// Uma cena por integrante. O tempo é só uma sugestão exibida no rodapé, nunca dispara nada.
const CENAS = [
  { nome: 'Origem', tempo: '0–20 s' },
  { nome: 'Plataforma', tempo: '20–50 s' },
  { nome: 'Redes', tempo: '50–90 s' },
  { nome: 'Nuvem', tempo: '90–120 s' },
]

const TEXTOS_NUVEM = {
  liberado: 'A consulta passa pelo mesmo controle. A criança vê a missão disponível.',
  negado: 'Sem vínculo de pareamento, o banco não devolve nada.',
  rlsNegado: 'sem vínculo de pareamento: nenhuma linha liberada',
}

// Lê ?apresentacao=1 e ?cena=N. Qualquer outra coisa cai no padrão (modo Explorar, cena 1).
function lerUrl() {
  const params = new URLSearchParams(window.location.search)
  const valor = (params.get('apresentacao') || '').toLowerCase()
  const cena = Number.parseInt(params.get('cena'), 10)
  return {
    ativa: ['1', 'true', 'sim', 'on'].includes(valor),
    cena: Number.isInteger(cena) && cena >= 1 && cena <= CENAS.length ? cena : 1,
  }
}

// Ignora a rejeição de uma Promise (tela cheia pode ser negada pelo navegador; não é erro do app).
function semErro(promessa) {
  if (promessa && typeof promessa.catch === 'function') promessa.catch(() => {})
}

// Sequência passo a passo para as cenas 3 e 4: avança sozinha de tempos em tempos (a menos que a
// pessoa prefira menos movimento) e também por clique. A etapa 0 é "ainda nada aceso".
function criarSequencia({ total, intervalo, aplicar, aoMudar }) {
  let etapa = 0
  let timer = null

  const totalAtual = () => (typeof total === 'function' ? total() : total)
  const parar = () => {
    window.clearTimeout(timer)
    timer = null
  }
  const definir = (n) => {
    etapa = Math.max(0, Math.min(totalAtual(), n))
    aplicar(etapa)
    if (aoMudar) aoMudar(etapa, totalAtual())
  }
  const andarSozinha = () => {
    if (etapa >= totalAtual()) {
      timer = null
      return
    }
    definir(etapa + 1)
    timer = window.setTimeout(andarSozinha, intervalo)
  }

  const sequencia = {
    iniciar() {
      parar()
      definir(0)
      if (reduzMovimento) {
        definir(1)
        return
      }
      timer = window.setTimeout(andarSozinha, 350)
    },
    passo() {
      parar()
      if (etapa >= totalAtual()) sequencia.iniciar()
      else definir(etapa + 1)
    },
    ir(n) {
      parar()
      definir(n)
    },
    parar,
  }
  return sequencia
}

function montarApresentacao() {
  const palco = document.querySelector('[data-ap]')
  if (!palco) return null

  const cenas = [...palco.querySelectorAll('[data-cena]')]
  const passos = [...palco.querySelectorAll('[data-ir]')]
  const area = palco.querySelector('.ap__palco')
  const btnVoltar = palco.querySelector('[data-acao="voltar"]')
  const rotuloAvancar = palco.querySelector('[data-rotulo-avancar]')
  const meta = palco.querySelector('[data-meta]')
  const anuncio = palco.querySelector('[data-anuncio]')
  const btnTela = palco.querySelector('[data-tela-cheia]')
  const botaoLiberar = palco.querySelector('[data-liberar]')
  const aparelhoPlataforma = palco.querySelector('[data-aparelho="plataforma"]')

  // Sem a estrutura mínima o palco não abre: a página longa continua funcionando sozinha.
  if (cenas.length !== CENAS.length || !area || !btnVoltar || !rotuloAvancar || !meta) return null

  const estado = { ativa: false, cena: 1, rolagem: 0 }
  let ultimoGatilho = null

  function anunciar(texto) {
    if (!anuncio) return
    anuncio.textContent = ''
    window.setTimeout(() => { anuncio.textContent = texto }, 60)
  }

  // ---- Cena 2: estado fictício da missão ------------------------------------------------------

  function definirMissao(liberada, { silencioso = false } = {}) {
    palco.dataset.missao = liberada ? 'liberada' : 'bloqueada'
    if (aparelhoPlataforma) aparelhoPlataforma.dataset.estado = liberada ? 'liberada' : 'espera'
    if (botaoLiberar) botaoLiberar.setAttribute('aria-disabled', liberada ? 'true' : 'false')
    if (silencioso) return
    anunciar(liberada
      ? 'Missão liberada. A tela da criança agora mostra a missão.'
      : 'Demonstração refeita. A missão está bloqueada de novo.')
  }

  function liberarMissao() {
    if (palco.dataset.missao === 'liberada') return
    definirMissao(true)
  }

  // ---- Cena 3: o caminho do pedido (Dispositivo → rede local → roteador → internet → serviço) --

  const redeEl = palco.querySelector('[data-rede]')
  const rede = redeEl && criarSequencia({
    total: 5,
    intervalo: 3200,
    aplicar(etapa) {
      redeEl.dataset.etapa = String(etapa)
      redeEl.querySelectorAll('.ap-no').forEach((no, i) => {
        const n = i + 1
        no.classList.toggle('is-ativo', etapa === n)
        no.classList.toggle('is-feito', etapa > n)
        const ligacao = no.querySelector('.ap-lig')
        if (ligacao) ligacao.classList.toggle('is-fluindo', etapa === n + 1)
      })
      redeEl.querySelectorAll('[data-leg]').forEach((bloco) => {
        bloco.hidden = Number(bloco.dataset.leg) !== etapa
      })
    },
    aoMudar(etapa, total) {
      const rotulo = redeEl.querySelector('[data-rotulo-passo]')
      if (rotulo) rotulo.textContent = etapa >= total ? 'Repetir o caminho' : 'Próximo salto'
    },
  })

  // ---- Cena 4: a nuvem (API → autenticação → RLS → PostgreSQL → consulta da criança) ---------

  const nuvemEl = palco.querySelector('[data-nuvem]')
  const fecho = palco.querySelector('[data-fecho]')
  const negado = () => nuvemEl.dataset.acesso === 'negado'

  const nuvem = nuvemEl && criarSequencia({
    // Com acesso negado o banco nem é consultado: o resultado vem logo depois do RLS.
    total: () => (negado() ? 4 : 5),
    intervalo: 2600,
    aplicar(etapa) {
      const barrado = negado()
      // fase 5 = resultado na tela da criança
      const fase = barrado && etapa === 4 ? 5 : etapa
      nuvemEl.dataset.etapa = String(fase)

      const etapas = nuvemEl.querySelectorAll('.ap-pp')
      etapas.forEach((pp, i) => {
        const n = i + 1
        const alcancada = barrado ? n <= 3 : true
        pp.classList.toggle('is-ativo', alcancada && fase === n)
        pp.classList.toggle('is-feito', alcancada && fase > n)
        pp.classList.toggle('is-barrou', barrado && n === 3 && fase >= 3)
      })

      const descricaoRls = etapas[2] && etapas[2].querySelector('small')
      if (descricaoRls) {
        if (!descricaoRls.dataset.original) descricaoRls.dataset.original = descricaoRls.textContent
        descricaoRls.textContent = barrado && fase >= 3 ? TEXTOS_NUVEM.rlsNegado : descricaoRls.dataset.original
      }

      const aparelho = nuvemEl.querySelector('[data-aparelho="nuvem"]')
      if (aparelho) aparelho.dataset.estado = fase >= 5 ? (barrado ? 'negada' : 'liberada') : 'espera'

      const texto = nuvemEl.querySelector('[data-res-txt]')
      if (texto) texto.textContent = fase >= 5 ? (barrado ? TEXTOS_NUVEM.negado : TEXTOS_NUVEM.liberado) : ''

      if (fecho) fecho.classList.toggle('is-visivel', fase >= 5)
    },
    aoMudar(etapa, total) {
      const rotulo = nuvemEl.querySelector('[data-rotulo-passo]')
      if (rotulo) rotulo.textContent = etapa >= total ? 'Repetir' : 'Próxima etapa'
    },
  })

  function definirAcesso(valor) {
    if (!nuvemEl) return
    nuvemEl.dataset.acesso = valor === 'negado' ? 'negado' : 'autorizado'
    nuvemEl.querySelectorAll('button[data-acesso]').forEach((botao) => {
      botao.setAttribute('aria-pressed', botao.dataset.acesso === nuvemEl.dataset.acesso ? 'true' : 'false')
    })
    if (estado.cena === 4 && nuvem) nuvem.iniciar()
  }

  // ---- Navegação entre as cenas ---------------------------------------------------------------

  function sincronizarUrl() {
    try {
      const url = new URL(window.location.href)
      if (estado.ativa) {
        url.searchParams.set('apresentacao', '1')
        url.searchParams.set('cena', String(estado.cena))
      } else {
        url.searchParams.delete('apresentacao')
        url.searchParams.delete('cena')
      }
      window.history.replaceState(null, '', url)
    } catch (erro) {
      // Sem URL editável (por exemplo, aberto como arquivo): a apresentação segue funcionando.
    }
  }

  function irParaCena(n, sentido = 0) {
    const alvo = Math.max(1, Math.min(CENAS.length, n))
    if (rede) rede.parar()
    if (nuvem) nuvem.parar()

    estado.cena = alvo
    palco.dataset.cenaAtual = String(alvo)

    cenas.forEach((cena) => { cena.hidden = Number(cena.dataset.cena) !== alvo })
    passos.forEach((passo) => {
      const numero = Number(passo.dataset.ir)
      if (numero === alvo) passo.setAttribute('aria-current', 'step')
      else passo.removeAttribute('aria-current')
      passo.classList.toggle('is-feita', numero < alvo)
    })

    btnVoltar.disabled = alvo === 1
    rotuloAvancar.textContent = alvo < CENAS.length ? `Próxima: ${CENAS[alvo].nome}` : 'Recomeçar'
    meta.textContent = `Cena ${alvo} de ${CENAS.length} · ${CENAS[alvo - 1].tempo}`

    const cena = cenas[alvo - 1]
    cena.classList.remove('is-entrando')
    if (sentido !== 0) {
      cena.style.setProperty('--dx', sentido < 0 ? '-28px' : '28px')
      void cena.offsetWidth // reinicia a animação de entrada
      cena.classList.add('is-entrando')
    }
    area.scrollTop = 0

    if (alvo === 3 && rede) rede.iniciar()
    if (alvo === 4 && nuvem) nuvem.iniciar()

    const titulo = cena.querySelector('h2')
    anunciar(`Cena ${alvo} de ${CENAS.length}: ${titulo ? titulo.textContent : CENAS[alvo - 1].nome}`)
    sincronizarUrl()
  }

  function reiniciar() {
    definirMissao(false, { silencioso: true })
    definirAcesso('autorizado')
    irParaCena(1, -1)
  }

  function abrir(cena = 1, gatilho = null) {
    if (!estado.ativa) {
      estado.rolagem = window.scrollY
      estado.ativa = true
      ultimoGatilho = gatilho
      corpo.dataset.modo = 'apresentacao'
      palco.hidden = false
      definirMissao(false, { silencioso: true })
      definirAcesso('autorizado')
    }
    irParaCena(cena)
    palco.focus({ preventScroll: true })
  }

  function fechar() {
    if (!estado.ativa) return
    if (rede) rede.parar()
    if (nuvem) nuvem.parar()
    estado.ativa = false
    corpo.dataset.modo = 'pagina'
    palco.hidden = true
    if (document.fullscreenElement && document.exitFullscreen) semErro(document.exitFullscreen())
    sincronizarUrl()

    // Volta ao ponto da página longa onde a pessoa estava (sem a rolagem suave do CSS)
    raiz.style.scrollBehavior = 'auto'
    window.scrollTo(0, estado.rolagem)
    raiz.style.scrollBehavior = ''
    if (ultimoGatilho && ultimoGatilho.isConnected) ultimoGatilho.focus({ preventScroll: true })
  }

  function alternarTelaCheia() {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) semErro(document.exitFullscreen())
    } else if (raiz.requestFullscreen) {
      semErro(raiz.requestFullscreen())
    }
  }

  if (btnTela) btnTela.hidden = !(document.fullscreenEnabled && raiz.requestFullscreen)

  // ---- Eventos --------------------------------------------------------------------------------

  palco.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button')
    if (!botao || !palco.contains(botao)) return
    const { acao, ir, etapa, acesso } = botao.dataset

    if (ir) {
      const destino = Number(ir)
      irParaCena(destino, destino === estado.cena ? 0 : (destino > estado.cena ? 1 : -1))
      return
    }
    if (etapa && rede) {
      rede.ir(Number(etapa))
      return
    }
    if (acesso) {
      definirAcesso(acesso)
      return
    }

    switch (acao) {
      case 'voltar':
        if (estado.cena > 1) irParaCena(estado.cena - 1, -1)
        break
      case 'avancar':
        if (estado.cena < CENAS.length) irParaCena(estado.cena + 1, 1)
        else reiniciar()
        break
      case 'reiniciar':
        reiniciar()
        break
      case 'sair':
        fechar()
        break
      case 'tela-cheia':
        alternarTelaCheia()
        break
      case 'liberar':
        liberarMissao()
        break
      case 'refazer':
        definirMissao(false)
        break
      case 'rede-passo':
        if (rede) rede.passo()
        break
      case 'nuvem-passo':
        if (nuvem) nuvem.passo()
        break
      default:
        break
    }
  })

  document.addEventListener('keydown', (evento) => {
    if (!estado.ativa || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return
    if (evento.target.closest && evento.target.closest('input, textarea, select, [contenteditable="true"]')) return

    switch (evento.key) {
      case 'ArrowRight':
      case 'PageDown':
        evento.preventDefault()
        if (estado.cena < CENAS.length) irParaCena(estado.cena + 1, 1)
        break
      case 'ArrowLeft':
      case 'PageUp':
        evento.preventDefault()
        if (estado.cena > 1) irParaCena(estado.cena - 1, -1)
        break
      case 'Home':
        evento.preventDefault()
        irParaCena(1, -1)
        break
      case 'End':
        evento.preventDefault()
        irParaCena(CENAS.length, 1)
        break
      default:
        break
    }
  })

  return { abrir }
}

function ligarApresentacao() {
  const apresentacao = montarApresentacao()
  if (!apresentacao) return

  document.querySelectorAll('[data-acao="iniciar"]').forEach((botao) => {
    botao.addEventListener('click', () => apresentacao.abrir(1, botao))
  })

  const inicial = lerUrl()
  if (inicial.ativa) apresentacao.abrir(inicial.cena)
}

revelarAoRolar()
marcarSecaoAtual()
fundoDoCabecalho()
ligarApresentacao()
