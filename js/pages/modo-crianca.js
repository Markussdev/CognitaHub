import { getStubActivityContract } from '../data/modo-crianca-stub.js'
import { mount as montarContar } from './moldes/contar.js'

// Registro dos moldes conhecidos pela casca — só o nome, o resto é opaco
// (a casca nunca importa nada específico de dentro de um molde).
const MOLDES = {
  contar: montarContar,
}

// Integração futura: ler ?activity=&role=&return= e buscar do Supabase.
// Hoje sempre o stub — a casca não fala com o Supabase (item 5 da direção).
function resolveContract() {
  return getStubActivityContract()
}

function formatTemplate(str, data) {
  return str.replace(/\{(\w+)\}/g, (_, key) => (key in data ? data[key] : `{${key}}`))
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)]
}

// A máquina de estados: um estado de cada vez, sem cadeado e sem streak
// entre eles (guardrail da direção de design). "Adaptação" não é um estado
// visual — é a folha do adulto mexendo em config e voltando pra 'atividade'.
class ModoCrianca {
  constructor(contract) {
    this.contract = contract
    this.config = { ...contract.config }
    this.state = 'acolhimento'
    this.previousState = null
    this.round = 0
    this.startedAt = Date.now()
    this.usouMaisFacil = false
    this.comoEncerrou = null
    this.pendingFeedbackKind = 'acerto'
    this.sheetAberta = false
    this.activeMold = null

    this.el = {
      stage: document.getElementById('stage'),
      instruction: document.getElementById('stage-instruction'),
      btnPausar: document.getElementById('btn-pausar'),
      btnPrincipal: document.getElementById('btn-principal'),
      panels: document.querySelectorAll('.panel'),
      moldSlot: document.getElementById('mold-slot'),
      acolhimentoTitulo: document.getElementById('acolhimento-titulo'),
      acolhimentoFala: document.getElementById('acolhimento-fala'),
      feedbackIcon: document.getElementById('feedback-icon'),
      feedbackTexto: document.getElementById('feedback-texto'),
      encerramentoTitulo: document.getElementById('encerramento-titulo'),
      encerramentoResumo: document.getElementById('encerramento-resumo'),
      adultBtn: document.getElementById('adult-btn'),
      sheet: document.getElementById('adult-sheet'),
      sheetBackdrop: document.getElementById('sheet-backdrop'),
      sheetSub: document.getElementById('sheet-sub'),
      sheetClose: document.getElementById('sheet-close'),
    }

    this.bindEvents()
    this.render()
  }

  bindEvents() {
    this.el.btnPausar.addEventListener('click', () => this.pausar())
    this.el.btnPrincipal.addEventListener('click', () => this.onPrincipal())

    this.bindLongPress(this.el.adultBtn, () => this.abrirSheet())
    this.el.sheetBackdrop.addEventListener('click', () => this.fecharSheet())
    this.el.sheetClose.addEventListener('click', () => this.fecharSheet())
    this.el.sheet.querySelectorAll('[data-adult-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.onAdultAction(btn.dataset.adultAction))
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sheetAberta) this.fecharSheet()
    })

    this.el.instruction.addEventListener('animationend', () => {
      this.el.instruction.classList.remove('repeat-pulse')
    })
  }

  // Toque e segure (ou Enter/Espaço seguros) — trava de calma do item 3:
  // a criança não consegue disparar os controles do adulto sem querer.
  bindLongPress(el, onOpen, holdMs = 550) {
    let timer = null
    const start = () => {
      el.classList.add('holding')
      timer = setTimeout(() => {
        onOpen()
        el.classList.remove('holding')
      }, holdMs)
    }
    const cancel = () => {
      clearTimeout(timer)
      el.classList.remove('holding')
    }
    el.addEventListener('pointerdown', start)
    el.addEventListener('pointerup', cancel)
    el.addEventListener('pointerleave', cancel)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !timer) start()
    })
    el.addEventListener('keyup', cancel)
  }

  // Fonte única de verdade pro botão principal: o rótulo do rodapé e a ação
  // do clique vêm sempre do mesmo cálculo, nunca de duas tabelas separadas.
  proximoPasso() {
    const rodadas = this.config.rodadas || 3
    switch (this.state) {
      case 'acolhimento':
        return { label: 'Começar', acao: () => this.iniciarRodada() }
      case 'atividade':
        // Se há um molde plugado, ele é quem sabe se a criança terminou
        // certo ou não — "Pronto" pergunta a ele em vez de decidir sozinha.
        return { label: 'Pronto', acao: () => this.reportarResultado(this.activeMold?.avaliar?.()) }
      case 'feedback':
        return this.round >= rodadas
          ? { label: 'Ver resumo', acao: () => this.encerrar('crianca_concluiu') }
          : { label: 'Continuar', acao: () => this.iniciarRodada() }
      case 'pausado':
        return { label: 'Retomar', acao: () => this.retomar() }
      case 'encerramento':
        return { label: 'Voltar', acao: () => this.sair() }
      default:
        return { label: '', acao: () => {} }
    }
  }

  onPrincipal() {
    this.proximoPasso().acao()
  }

  // Uma rodada nova monta o molde do zero (novo sorteio, nova config) e só
  // depois muda o estado — nunca o contrário, senão a folha do adulto veria
  // por uma fração de segundo o slot ainda com a rodada anterior.
  iniciarRodada() {
    this.montarMolde()
    this.irPara('atividade')
  }

  // Ponto de plugue do molde (item do design): a casca só conhece o nome
  // do molde (this.contract.molde) e devolve pra ele tema/config/callback.
  // Nada aqui sabe o que é "contar" — se amanhã for outro molde, só troca
  // o que está registrado em MOLDES.
  montarMolde() {
    this.el.moldSlot.innerHTML = ''
    this.activeMold = null
    const montar = MOLDES[this.contract.molde]
    if (!montar) return
    this.activeMold = montar(this.el.moldSlot, {
      tema: this.contract.tema,
      config: this.config,
      onResultado: (kind) => this.reportarResultado(kind),
    })
  }

  // Chamado pelo molde (via onResultado) quando ele mesmo detecta o
  // resultado, ou por "Pronto" perguntando ao molde via avaliar().
  //
  // Decisão pedagógica: só acerto avança a rodada. Dificuldade deixa a
  // criança tentar de novo na mesma rodada — ela não pode "gastar" o
  // orçamento de rodadas só por estar com dificuldade e encerrar sem
  // ter conseguido.
  reportarResultado(kind) {
    this.pendingFeedbackKind = kind || pickRandom(['acerto', 'acerto', 'dificuldade'])
    if (this.pendingFeedbackKind === 'acerto') this.round += 1
    this.irPara('feedback')
  }

  pausar() {
    if (this.state === 'pausado') return
    this.previousState = this.state
    this.irPara('pausado')
  }

  retomar() {
    this.irPara(this.previousState || 'atividade')
  }

  irPara(novoEstado) {
    this.state = novoEstado
    this.render()
  }

  onAdultAction(action) {
    if (action === 'mais-facil') {
      this.config.nivel = Math.max(1, this.config.nivel - 1)
      this.usouMaisFacil = true
      this.fecharSheet()
      this.iniciarRodada()
    } else if (action === 'mais-dificil') {
      this.config.nivel = Math.min(5, this.config.nivel + 1)
      this.fecharSheet()
      this.iniciarRodada()
    } else if (action === 'repetir') {
      this.fecharSheet()
      this.anunciarInstrucao()
    } else if (action === 'pausar') {
      this.fecharSheet()
      this.pausar()
    } else if (action === 'encerrar') {
      this.fecharSheet()
      this.encerrar('adulto_encerrou')
    }
  }

  encerrar(motivo) {
    this.comoEncerrou = motivo
    this.irPara('encerramento')
  }

  // O gancho de saída (item 6): monta o sinal leve pro Registro de Sessão.
  // A gravação em si fica para a integração — aqui só deixamos o objeto pronto.
  montarAtividadeExecucao() {
    return {
      molde: this.contract.molde,
      tema: this.contract.tema,
      nivel_final: this.config.nivel,
      precisou_mais_facil: this.usouMaisFacil,
      tempo_aproximado_segundos: Math.round((Date.now() - this.startedAt) / 1000),
      como_encerrou: this.comoEncerrou || 'adulto_encerrou',
    }
  }

  sair() {
    const execucao = this.montarAtividadeExecucao()
    console.info('[modo-crianca] atividade_execucao', execucao)

    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('return')
    if (returnTo) {
      window.location.href = returnTo
    } else if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = 'atividades.html'
    }
  }

  abrirSheet() {
    this.sheetAberta = true
    this.el.sheetSub.textContent = `Nível atual: ${this.config.nivel} de 5`
    this.el.sheet.classList.add('open')
    this.el.sheet.setAttribute('aria-hidden', 'false')
    this.el.sheetBackdrop.classList.add('open')
  }

  fecharSheet() {
    this.sheetAberta = false
    this.el.sheet.classList.remove('open')
    this.el.sheet.setAttribute('aria-hidden', 'true')
    this.el.sheetBackdrop.classList.remove('open')
  }

  // "Repetir instrução" só faz sentido durante a atividade — fora dela,
  // não há instrução na tela pra repetir, então não faz nada (em vez de
  // apagar o texto em silêncio). O pulso é o sinal perceptível de que
  // a instrução "voltou"; sem ele, reescrever o mesmo texto no mesmo
  // lugar não é notável pela criança.
  anunciarInstrucao() {
    if (this.state !== 'atividade') return
    const el = this.el.instruction
    el.classList.remove('repeat-pulse')
    void el.offsetWidth // força reflow pra poder retriggar a animação
    el.classList.add('repeat-pulse')
  }

  render() {
    this.el.stage.dataset.state = this.state

    this.el.panels.forEach((panel) => {
      panel.toggleAttribute('data-active', panel.dataset.panel === this.state)
    })

    // Pausar fica disponível "a qualquer momento" (item 2), exceto quando
    // já está pausado ou quando a atividade terminou.
    this.el.btnPausar.hidden = this.state === 'pausado' || this.state === 'encerramento'

    this.el.btnPrincipal.textContent = this.proximoPasso().label

    // A instrução ocupa sempre a mesma posição (previsibilidade espacial);
    // some de conteúdo, não de layout.
    this.el.instruction.textContent = this.state === 'atividade' ? this.contract.instrucao : ''

    if (this.state === 'acolhimento') {
      this.el.acolhimentoTitulo.textContent = this.contract.acolhimento.titulo
      this.el.acolhimentoFala.textContent = this.contract.acolhimento.fala
    }

    if (this.state === 'feedback') {
      const isAcerto = this.pendingFeedbackKind === 'acerto'
      const mensagens = isAcerto ? this.contract.feedback_acerto : this.contract.feedback_dificuldade
      this.el.feedbackTexto.textContent = pickRandom(mensagens)
      this.el.feedbackIcon.className = `feedback-icon ${isAcerto ? 'acerto' : 'dificuldade'}`
      this.el.feedbackIcon.innerHTML = isAcerto
        ? '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>'
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><circle cx="12" cy="16.3" r=".4" fill="currentColor"/></svg>'
    }

    if (this.state === 'encerramento') {
      this.el.encerramentoTitulo.textContent = this.contract.encerramento.titulo
      this.el.encerramentoResumo.textContent = formatTemplate(this.contract.encerramento.resumo, this.config)
    }

    this.el.adultBtn.hidden = this.state === 'encerramento'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const instance = new ModoCrianca(resolveContract())
  window.CognitaModoCrianca = {
    reportarResultado: (kind) => instance.reportarResultado(kind),
  }
})
