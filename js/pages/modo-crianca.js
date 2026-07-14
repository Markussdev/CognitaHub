import { requireRole } from '../lib/auth.js'
import { getChildActivityById } from '../data/child-activities.js'
import { createAtividadeExecucao } from '../data/atividade-execucao.js'
import { buildContractFromParts } from '../data/moldes-registro.js'
import { getStubActivityContract } from '../data/modo-crianca-stub.js'
import { mount as montarContar } from './moldes/contar.js'
import { mount as montarIdentificar } from './moldes/identificar.js'

// Registro dos moldes conhecidos pela casca — só o nome, o resto é opaco
// (a casca nunca importa nada específico de dentro de um molde).
const MOLDES = {
  contar: montarContar,
  identificar: montarIdentificar,
}

// Contrato a partir de uma child_activity real. buildContractFromParts é
// compartilhado com a prévia ao vivo do form de composição (tutor.js) —
// as duas renderizações nascem exatamente da mesma lógica.
function buildContractFromRow(row) {
  return {
    ...buildContractFromParts(row),
    _childId: row.child_id,
    _childActivityId: row.id,
  }
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
  constructor(contract, authSession, { previewMode = false } = {}) {
    this.contract = contract
    this.authSession = authSession
    this.previewMode = previewMode
    this.config = { ...contract.config }
    // Modo prévia (form de composição do tutor) pula direto pra 'atividade':
    // o que importa ali é ver o palco funcionando, não o acolhimento.
    this.state = previewMode ? 'atividade' : 'acolhimento'
    this.previousState = null
    this.round = 0
    this.startedAt = Date.now()
    this.usouMaisFacil = false
    this.comoEncerrou = null
    this.pendingFeedbackKind = 'acerto'
    this.sheetAberta = false
    this.confirmandoEncerrar = false
    this.activeMold = null

    this.el = {
      stage: document.getElementById('stage'),
      instruction: document.getElementById('stage-instruction'),
      missionBadge: document.getElementById('mission-badge'),
      btnPausar: document.getElementById('btn-pausar'),
      btnPrincipal: document.getElementById('btn-principal'),
      panels: document.querySelectorAll('.panel'),
      moldSlot: document.getElementById('mold-slot'),
      acolhimentoTitulo: document.getElementById('acolhimento-titulo'),
      acolhimentoMissao: document.getElementById('acolhimento-missao'),
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
      sheetActions: document.getElementById('sheet-actions'),
      sheetConfirm: document.getElementById('sheet-confirm'),
      sheetConfirmCancel: document.getElementById('sheet-confirm-cancel'),
      sheetConfirmOk: document.getElementById('sheet-confirm-ok'),
    }

    this.bindEvents()
    if (previewMode) this.montarMolde()
    this.render()
  }

  // Chamado pela prévia ao vivo (postMessage do form de composição) sempre
  // que o tutor muda molde/tema/config/instrução. Atualiza o mesmo palco em
  // vez de recriar a instância — recriar empilharia um listener novo em
  // cada botão a cada tecla digitada.
  updateContract(newContract) {
    const configMudou =
      this.contract.molde !== newContract.molde ||
      this.contract.tema !== newContract.tema ||
      JSON.stringify(this.config) !== JSON.stringify(newContract.config)

    this.contract = newContract
    this.config = { ...newContract.config }
    if (this.state !== 'atividade') this.state = 'atividade'
    if (configMudou) this.montarMolde()
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
    this.el.sheetConfirmCancel.addEventListener('click', () => this.cancelarConfirmEncerrar())
    this.el.sheetConfirmOk.addEventListener('click', () => {
      this.fecharSheet()
      this.encerrar('adulto_encerrou')
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
        return { label: this.rotuloVoltar(), acao: () => this.sair() }
      default:
        return { label: '', acao: () => {} }
    }
  }

  // Quem abriu o Modo Criança (tutor.js hoje; responsável ainda não tem
  // entrada na UI, mas a RLS já permite — ver docs/V2-DIRECAO.md §5). Sem
  // sessão (modo stub/demonstração), cai no rótulo padrão.
  rotuloVoltar() {
    return this.authSession?.profile?.role === 'guardian' ? 'Voltar para o responsável' : 'Voltar para o tutor'
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
      // Não encerra na hora — pede confirmação primeiro (reduz saída
      // acidental sem exigir senha do adulto).
      this.abrirConfirmEncerrar()
    }
  }

  abrirConfirmEncerrar() {
    this.confirmandoEncerrar = true
    this.el.sheetActions.hidden = true
    this.el.sheetConfirm.hidden = false
    this.el.sheetSub.hidden = true // "Nível atual: X de 5" não importa nessa pergunta
  }

  cancelarConfirmEncerrar() {
    this.confirmandoEncerrar = false
    this.el.sheetActions.hidden = false
    this.el.sheetConfirm.hidden = true
    this.el.sheetSub.hidden = false
  }

  encerrar(motivo) {
    this.comoEncerrou = motivo
    this.irPara('encerramento')
  }

  // O gancho de saída (item 6): monta o sinal leve pro Registro de Sessão —
  // Nível 1 (dado estruturado) do Registro em 3 níveis.
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

  // Grava de verdade quando veio de uma child_activity real (tem
  // _childActivityId e sessão autenticada); no modo stub/demonstração
  // (sem ?activity= na URL) não há onde gravar, então só loga.
  async sair() {
    const execucao = this.montarAtividadeExecucao()

    if (this.contract._childActivityId && this.authSession) {
      const { error } = await createAtividadeExecucao({
        childActivityId: this.contract._childActivityId,
        childId: this.contract._childId,
        executedBy: this.authSession.user.id,
        molde: execucao.molde,
        tema: execucao.tema,
        nivelFinal: execucao.nivel_final,
        precisouMaisFacil: execucao.precisou_mais_facil,
        tempoAproximadoSegundos: execucao.tempo_aproximado_segundos,
        comoEncerrou: execucao.como_encerrou,
      })
      if (error) console.error('[modo-crianca] falha ao gravar atividade_execucao', error)
    } else {
      console.info('[modo-crianca] atividade_execucao (modo demonstração, não gravado)', execucao)
    }

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
    this.cancelarConfirmEncerrar() // sempre abre na visão normal, nunca na confirmação da vez passada
    this.el.sheetSub.textContent = `Nível atual: ${this.config.nivel} de 5`
    this.el.sheet.classList.add('open')
    this.el.sheet.setAttribute('aria-hidden', 'false')
    this.el.sheetBackdrop.classList.add('open')
  }

  fecharSheet() {
    this.sheetAberta = false
    this.cancelarConfirmEncerrar()
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
    // some de conteúdo, não de layout. Moldes com alvo sorteado por rodada
    // (ex.: identificar) devolvem sua própria instrução via montarMolde() —
    // ela tem prioridade sobre o contract.instrucao estático. Moldes que não
    // devolvem nada (contar) continuam usando o texto do contrato, igual
    // sempre foi.
    this.el.instruction.textContent = this.state === 'atividade'
      ? (this.activeMold?.instrucao || this.contract.instrucao)
      : ''

    // Missão X de Y — só um rótulo de progresso da rodada atual (prepara a
    // linguagem visual pra uma trilha futura, sem virar mapa navegável).
    // Visível durante a atividade e o feedback dela; some no resto.
    const rodadas = this.config.rodadas || 3
    const mostrarMissao = this.state === 'atividade' || this.state === 'feedback'
    this.el.missionBadge.hidden = !mostrarMissao
    if (mostrarMissao) {
      const atual = Math.min(this.round + 1, rodadas)
      this.el.missionBadge.textContent = `Missão ${atual} de ${rodadas}`
    }

    if (this.state === 'acolhimento') {
      this.el.acolhimentoTitulo.textContent = this.contract.acolhimento.titulo
      this.el.acolhimentoMissao.textContent = `Missão: ${this.contract.missao || this.contract.tema || ''}`
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
      const vezes = this.config.rodadas === 1 ? 'vez' : 'vezes'
      this.el.encerramentoResumo.textContent = formatTemplate(this.contract.encerramento.resumo, { ...this.config, vezes })
    }

    this.el.adultBtn.hidden = this.state === 'encerramento'
  }
}

const params = new URLSearchParams(window.location.search)
const activityId = params.get('activity')
const isPreview = params.get('preview') === '1'

if (isPreview) {
  // Embutido como <iframe> no form de composição do tutor (tutor.js) — a
  // MESMA casca, ao vivo, sem autenticação e sem gravar nada. O tutor vê
  // exatamente o que a criança veria enquanto ainda está compondo.
  const instance = new ModoCrianca(getStubActivityContract(), null, { previewMode: true })
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return
    if (event.data?.type !== 'cognita-preview-contract') return
    instance.updateContract(event.data.contract)
  })
} else {
  // Sem ?activity=: modo stub/demonstração, não exige login (a casca
  // continua testável isolada). Com ?activity=<id>: exige tutor ou
  // responsável autenticado, porque o encerramento grava atividade_execucao
  // com executed_by = auth.uid().
  let authSession = null
  if (activityId) {
    authSession = await requireRole('tutor', 'guardian')
    // requireRole já redireciona pro login quando authSession é null —
    // não monta nada nesse caso, a navegação está em andamento.
  }

  if (!activityId || authSession) {
    let contract = null
    let missaoBloqueada = false
    if (activityId && authSession) {
      const { data: row, error } = await getChildActivityById(activityId)
      if (error || !row) {
        console.warn('[modo-crianca] não achou a atividade — caindo no stub de demonstração', error)
      } else {
        // A lista "Atividades preparadas" já esconde "Fazer com a criança"
        // pra missão de trilha ainda bloqueada (ver tutor.js), mas isso
        // sozinho não impede acesso direto pela URL — confere de novo aqui,
        // é a última linha de defesa antes de abrir a atividade de verdade.
        const missao = Array.isArray(row.child_trail_missions) ? row.child_trail_missions[0] : row.child_trail_missions
        if (row.child_trail_mission_id && missao?.status === 'bloqueada') {
          missaoBloqueada = true
        } else {
          contract = buildContractFromRow(row)
        }
      }
    }

    if (missaoBloqueada) {
      document.body.innerHTML = `
        <div style="display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:'Atkinson Hyperlegible',sans-serif;">
          <div style="max-width:360px;">
            <p style="font-size:1.1rem;font-weight:700;margin:0 0 8px;">Esta missão ainda não foi liberada.</p>
            <p style="margin:0 0 16px;color:#5b4a58;">A criança precisa concluir as missões anteriores da trilha primeiro.</p>
            <a href="tutor.html?view=record&tab=plan" style="color:#141162;font-weight:700;">Voltar para o painel</a>
          </div>
        </div>`
    } else {
      if (!contract) contract = getStubActivityContract()
      const instance = new ModoCrianca(contract, authSession)
      window.CognitaModoCrianca = {
        reportarResultado: (kind) => instance.reportarResultado(kind),
      }
    }
  }
}
