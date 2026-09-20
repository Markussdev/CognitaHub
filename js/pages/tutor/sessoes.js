import { el } from '../../lib/ui.js'
import { MOLDES_REGISTRO } from '../../data/moldes-registro.js'
import { listPendingExecucoes } from '../../data/atividade-execucao.js'
import { createSessionWithExecucoes, getCycleSessions } from '../../data/sessions.js'
import { firstName, pickEmbedded, formatDate, formatExecucaoQuando, gatoMatematicoSrc } from './shared.js'

// Domínio de registro e histórico de sessões — extraído de js/pages/tutor.js.
// Contrato com o resto da tela (renderRecord/buildSessionsPanel em
// tutor.js): renderSessionForm(cycle, onSaved) devolve um elemento com
// .open (get/set), .openManual(), .fillSuggestedActivity(), .reloadPending(),
// .onPendingLoaded (setter externo) e os eventos 'sw-toggle'/'sw-saved'.
// Nada disso mudou nesta extração — só o arquivo que contém o código.

function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function formatDuracaoAprox(segundos) {
  if (!segundos) return null
  if (segundos < 60) return `${segundos}s`
  return `${Math.round(segundos / 60)} min`
}

const COMO_ENCERROU_LABEL = {
  crianca_concluiu: 'Concluída',
  adulto_encerrou: 'Encerrada pelo adulto',
  pausa: 'Pausada',
  recusa: 'Recusada',
}

// ── Registro de sessão — assistente em 3 passos ──────────────────────────────
// A aba Sessões aterrissa numa linha do tempo (buildSessionsPanel); este
// assistente só aparece ao tocar "Registrar sessão". Passo 1: o que aconteceu
// (execuções do Modo Criança e/ou registro manual). Passo 2: como foi —
// perguntas humanas, uma abaixo da outra. Passo 3: a devolutiva pra família,
// COMPOSTA deterministicamente a partir das respostas (sem IA) — o tutor
// revisa e personaliza em vez de escrever tudo duas vezes. O que persiste não
// mudou (createSessionWithExecucoes). Contrato com o resto da tela: .open
// (get/set), .openManual(), .fillSuggestedActivity(), .onPendingLoaded e os
// eventos 'sw-toggle'/'sw-saved' que a linha do tempo escuta.
// TODO(wiring:sessions): persistir participação/apoio/resultado quando o
// schema de sessions ganhar as colunas (engagement/difficulty/result) — hoje
// essas respostas alimentam só a composição da devolutiva.

const PARTICIPACAO_OPTS = [
  { val: 'bem', label: 'Participou bem' },
  { val: 'oscilou', label: 'Oscilou durante a atividade' },
  { val: 'incentivo', label: 'Precisou de incentivo' },
  { val: 'nao_quis', label: 'Não quis participar' },
]
const APOIO_OPTS = [
  { val: 'autonomia', label: 'Fez com autonomia' },
  { val: 'pouco', label: 'Pouco apoio' },
  { val: 'frequente', label: 'Apoio frequente' },
  { val: 'nao_concluiu', label: 'Não foi possível concluir' },
]
const RESULTADO_OPTS = [
  { val: 'avancou', label: 'Avançou' },
  { val: 'manteve', label: 'Manteve o que já sabia' },
  { val: 'dificuldade', label: 'Teve dificuldade' },
  { val: 'retomar', label: 'Ficou para retomar' },
]

function fraseAtividades(titulos) {
  if (!titulos.length) return 'da sessão de hoje'
  if (titulos.length === 1) return `da atividade "${titulos[0]}"`
  if (titulos.length === 2) return `das atividades "${titulos[0]}" e "${titulos[1]}"`
  return `das ${titulos.length} atividades de hoje`
}

// Devolutiva determinística: 2-3 frases curtas montadas a partir das
// respostas do passo 2. O próximo passo NÃO entra aqui — a família já o vê
// como campo próprio (next_step) no painel dela; repetir duplicaria.
function composeFamilySummary({ nome, atividadeFrase, participacao, apoio, resultado }) {
  const primeira = {
    bem: `${nome} participou bem ${atividadeFrase}.`,
    oscilou: `${nome} participou ${atividadeFrase}, alternando momentos de mais e menos envolvimento.`,
    incentivo: `${nome} precisou de incentivo para participar ${atividadeFrase}.`,
    nao_quis: `${nome} não quis participar ${atividadeFrase} desta vez — tudo bem, isso também faz parte do processo.`,
  }[participacao] || `${nome} participou ${atividadeFrase}.`

  const segunda = participacao === 'nao_quis' ? '' : ({
    autonomia: 'Fez as propostas com autonomia.',
    pouco: 'Precisou de pouco apoio pelo caminho.',
    frequente: 'Contou com apoio frequente do tutor.',
    nao_concluiu: 'Não foi possível concluir a proposta desta vez.',
  }[apoio] || '')

  const terceira = {
    avancou: 'Avançou no que estava sendo trabalhado.',
    manteve: 'Manteve o que já vinha construindo.',
    dificuldade: 'Encontrou dificuldade em alguns pontos, que vamos retomar com calma.',
    retomar: 'A atividade ficou para ser retomada no próximo encontro.',
  }[resultado] || ''

  return [primeira, segunda, terceira].filter(Boolean).join(' ')
}

export function renderSessionForm(cycle, onSaved) {
  const wrap = el('section', 'sw')
  wrap.hidden = true
  const childName = firstName(cycle.children?.name)

  const blank = () => ({
    step: 1,
    selected: new Set(), // ids de atividade_execucao incluídas na sessão
    manualOpen: false,
    manualTitulo: '',
    manualFoco: '',
    date: todayISO(),
    duration: '',
    durationTouched: false,
    participacao: '',
    apoio: '',
    resultado: '',
    observacao: '',
    proximoPasso: '',
    familyText: '',
    familyEdited: false,
    reviewed: false,
    activityId: null, // vindo da Biblioteca (?activity=)
  })
  let s = blank()
  let pending = []
  let isOpen = false
  let sideBox = null
  let navForward = null

  const tituloDe = (e) => {
    const molde = MOLDES_REGISTRO[e.molde]
    const temaLabel = molde?.temas.find((t) => t.id === e.tema)?.label || e.tema
    const atividade = pickEmbedded(e.child_activities)
    return atividade?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || e.molde} · ${temaLabel}`
  }

  // Fatos derivados da seleção — título/foco/duração nascem das execuções
  // marcadas (+ o registro manual, se houver); o tutor só corrige se precisar.
  function facts() {
    const execs = pending.filter((e) => s.selected.has(e.id))
    const titulos = execs.map(tituloDe)
    if (s.manualTitulo.trim()) titulos.push(s.manualTitulo.trim())
    const focos = [...new Set(execs.map((e) => MOLDES_REGISTRO[e.molde]?.label || e.molde))]
    if (s.manualFoco.trim()) focos.push(s.manualFoco.trim())
    const autoMin = Math.round(execs.reduce((sum, e) => sum + (e.tempo_aproximado_segundos || 0), 0) / 60)
    return {
      titulos,
      activityTitle: titulos.length === 1 ? titulos[0] : `${titulos.length} atividades: ${titulos.join(', ')}`,
      focusArea: focos.join(', '),
      autoMin,
    }
  }

  function syncDuration() {
    if (s.durationTouched) return
    const { autoMin } = facts()
    s.duration = autoMin > 0 ? String(autoMin) : ''
  }

  // Pré-marca as execuções do dia mais recente (uma "experiência").
  function preselectCluster() {
    s.selected.clear()
    if (pending.length) {
      const topDay = new Date(pending[0].created_at).toDateString()
      pending.forEach((e) => { if (new Date(e.created_at).toDateString() === topDay) s.selected.add(e.id) })
    }
    syncDuration()
  }

  function setOpen(open, { manual = false } = {}) {
    if (open && isOpen) return // já aberto: não reseta o que o tutor digitou
    isOpen = open
    wrap.hidden = !open
    if (open) {
      s = blank()
      preselectCluster()
      s.manualOpen = manual || !pending.length
      render()
    }
    wrap.dispatchEvent(new CustomEvent('sw-toggle', { detail: { open } }))
  }
  Object.defineProperty(wrap, 'open', { get: () => isOpen, set: (v) => setOpen(!!v) })
  wrap.openManual = () => setOpen(true, { manual: true })

  wrap.onPendingLoaded = null
  async function loadPending() {
    const { data, error } = await listPendingExecucoes(cycle.child_id, cycle.id)
    pending = error ? [] : (data ?? [])
    wrap.onPendingLoaded?.(pending, !!error)
  }
  loadPending()
  wrap.reloadPending = loadPending

  wrap.fillSuggestedActivity = (activity) => {
    setOpen(true, { manual: true })
    s.manualTitulo = activity?.title || ''
    s.manualFoco = activity?.focus || ''
    s.proximoPasso = activity?.nextStep || ''
    s.activityId = activity?.id || null
    // Vem do Modo Condução (Biblioteca) com a duração já cronometrada — se
    // presente, marca durationTouched pra syncDuration() não sobrescrever.
    if (activity?.durationMinutes) {
      s.duration = String(activity.durationMinutes)
      s.durationTouched = true
    }
    // Observação livre do Modo Condução vira nota interna (tutor-only) —
    // não é o resumo pra família, que continua composto no Passo 3.
    if (activity?.observacaoInterna) s.observacao = activity.observacaoInterna
    render()
  }

  // ── render por passo ──────────────────────────────────────────────────

  const STEP_LABELS = ['O que aconteceu', 'Como foi', 'Família']

  function render() {
    wrap.replaceChildren()
    const grid = el('div', 'sw-grid')
    const main = el('div', 'card sw-main')

    const head = el('div', 'sw-head')
    const headTx = el('div')
    headTx.append(el('h3', 'sw-title', `Registrar sessão de ${childName}`))
    headTx.append(el('p', 'sw-sub', `Passo ${s.step} de 3`))
    head.append(headTx)
    const cancel = el('button', 'btn btn-ghost btn-sm', 'Cancelar')
    cancel.type = 'button'
    cancel.addEventListener('click', () => setOpen(false))
    head.append(cancel)

    const steps = el('div', 'sw-steps')
    STEP_LABELS.forEach((lb, i) => {
      const n = i + 1
      const item = el('span', `sw-step${n === s.step ? ' is-current' : n < s.step ? ' is-done' : ''}`)
      item.append(el('span', 'sw-step-dot', n < s.step ? '✓' : String(n)))
      item.append(document.createTextNode(lb))
      steps.append(item)
    })

    main.append(head, steps)
    if (s.step === 1) main.append(renderStep1())
    else if (s.step === 2) main.append(renderStep2())
    else main.append(renderStep3())
    main.append(renderNav())

    sideBox = renderSide()
    grid.append(main, sideBox)
    wrap.append(grid)
  }

  function updateSide() {
    if (!sideBox) return
    const nb = renderSide()
    sideBox.replaceWith(nb)
    sideBox = nb
  }

  function canContinue() {
    if (s.step === 1) return facts().titulos.length > 0
    if (s.step === 2) return !!(s.participacao && s.apoio && s.resultado)
    return !!(s.familyText.trim() && s.reviewed)
  }
  function updateNav() { if (navForward) navForward.disabled = !canContinue() }

  function goStep(n) {
    s.step = n
    render()
    requestAnimationFrame(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function textField(labelText, value, onInput, placeholder) {
    const f = el('div', 'field')
    f.append(el('label', null, labelText))
    const input = document.createElement('input')
    input.type = 'text'
    input.value = value
    input.placeholder = placeholder || ''
    input.addEventListener('input', () => onInput(input.value))
    f.append(input)
    return f
  }

  // ── Passo 1: o que aconteceu ──────────────────────────────────────────

  function renderExecCard(e) {
    const selected = s.selected.has(e.id)
    const item = el('div', `pending-execucao-item sw-exec${selected ? ' is-selected' : ''}`)
    item.setAttribute('role', 'checkbox')
    item.setAttribute('aria-checked', String(selected))
    item.tabIndex = 0

    const molde = MOLDES_REGISTRO[e.molde]
    const detalhes = [
      `Nível ${e.nivel_final ?? '—'}`,
      COMO_ENCERROU_LABEL[e.como_encerrou],
      formatDuracaoAprox(e.tempo_aproximado_segundos),
      e.precisou_mais_facil ? 'precisou de mais fácil' : null,
    ].filter(Boolean).join(' · ')
    const quando = formatExecucaoQuando(e.created_at)

    const stateLine = el('p', 'sw-exec-state', selected ? '✓ Incluída na sessão' : 'Tocar para incluir')
    item.append(
      el('strong', null, tituloDe(e)),
      el('p', 'pending-execucao-detalhes', [quando ? `Feita ${quando}` : null, detalhes].filter(Boolean).join(' · ')),
      stateLine
    )

    const toggle = () => {
      const on = !s.selected.has(e.id)
      if (on) s.selected.add(e.id); else s.selected.delete(e.id)
      item.classList.toggle('is-selected', on)
      item.setAttribute('aria-checked', String(on))
      stateLine.textContent = on ? '✓ Incluída na sessão' : 'Tocar para incluir'
      syncDuration()
      updateSide()
      updateNav()
    }
    item.addEventListener('click', toggle)
    item.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggle() }
    })
    return item
  }

  function renderStep1() {
    const box = el('div', 'sw-step2')

    if (pending.length) {
      const b = el('div', 'sw-block')
      b.append(el('h4', 'sw-q', `O que ${childName} fez no aparelho?`))
      b.append(el('p', 'sw-hint', 'Toque para incluir ou tirar da sessão — as do dia mais recente já vêm marcadas.'))
      pending.forEach((e) => b.append(renderExecCard(e)))
      box.append(b)
      box.append(el('div', 'sw-divider', 'ou'))
    }

    const manual = document.createElement('details')
    manual.className = 'sw-collapsible'
    manual.open = s.manualOpen || !pending.length
    manual.addEventListener('toggle', () => { s.manualOpen = manual.open })
    const sum = document.createElement('summary')
    sum.textContent = pending.length ? 'Registrar algo feito fora do Modo Criança' : 'O que foi feito na sessão?'
    manual.append(sum)
    const mBody = el('div', 'sw-manual-body')
    mBody.append(textField('Atividade realizada', s.manualTitulo, (v) => { s.manualTitulo = v; syncDuration(); updateSide(); updateNav() }, 'Ex.: Soma com apoio visual — blocos de cores'))
    mBody.append(textField('Foco trabalhado', s.manualFoco, (v) => { s.manualFoco = v; updateSide() }, 'Ex.: Contagem e correspondência 1-a-1'))
    manual.append(mBody)
    box.append(manual)

    const when = el('div', 'sw-block')
    const row = el('div', 'sw-compact-row')
    const dField = el('div', 'field')
    dField.append(el('label', null, 'Data'))
    const dInput = document.createElement('input')
    dInput.type = 'date'
    dInput.value = s.date
    dInput.addEventListener('input', () => { s.date = dInput.value; updateSide() })
    dField.append(dInput)
    const duField = el('div', 'field')
    duField.append(el('label', null, 'Duração (min)'))
    const duInput = document.createElement('input')
    duInput.type = 'number'
    duInput.min = '0'
    duInput.value = s.duration
    duInput.placeholder = 'auto'
    duInput.addEventListener('input', () => { s.duration = duInput.value; s.durationTouched = true; updateSide() })
    duField.append(duInput)
    row.append(dField, duField)
    when.append(row)
    when.append(el('p', 'sw-hint', 'Preenchidas pelas atividades marcadas — ajuste se precisar.'))
    box.append(when)

    return box
  }

  // ── Passo 2: como foi ─────────────────────────────────────────────────

  function questionGroup(titulo, opts, get, set) {
    const b = el('div', 'sw-block')
    b.append(el('h4', 'sw-q', titulo))
    const list = el('div', 'sw-options')
    list.setAttribute('role', 'radiogroup')
    list.setAttribute('aria-label', titulo)
    const btns = []
    opts.forEach(({ val, label }) => {
      const on = get() === val
      const btn = el('button', `sw-option${on ? ' is-selected' : ''}`)
      btn.type = 'button'
      btn.setAttribute('role', 'radio')
      btn.setAttribute('aria-checked', String(on))
      btn.append(el('span', 'sw-option-dot'), document.createTextNode(label))
      btn.addEventListener('click', () => {
        set(val)
        btns.forEach((x) => { x.classList.remove('is-selected'); x.setAttribute('aria-checked', 'false') })
        btn.classList.add('is-selected')
        btn.setAttribute('aria-checked', 'true')
        updateNav()
      })
      btns.push(btn)
      list.append(btn)
    })
    b.append(list)
    return b
  }

  function renderStep2() {
    const box = el('div', 'sw-step2')
    box.append(questionGroup(`Como ${childName} participou?`, PARTICIPACAO_OPTS, () => s.participacao, (v) => { s.participacao = v }))
    box.append(questionGroup('Quanto apoio foi necessário?', APOIO_OPTS, () => s.apoio, (v) => { s.apoio = v }))
    box.append(questionGroup('Como a atividade terminou?', RESULTADO_OPTS, () => s.resultado, (v) => { s.resultado = v }))

    const obs = el('div', 'sw-block')
    obs.append(el('h4', 'sw-q', 'Alguma observação importante? (opcional)'))
    const obsField = el('div', 'field')
    const obsInput = document.createElement('textarea')
    obsInput.value = s.observacao
    obsInput.placeholder = 'Dúvidas técnicas, pontos para revisar com a equipe…'
    obsInput.addEventListener('input', () => { s.observacao = obsInput.value })
    obsField.append(obsInput)
    obs.append(obsField)
    const lockHint = el('p', 'sw-note-hint')
    lockHint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    lockHint.append(document.createTextNode('Nota interna — a família nunca vê o que você escrever aqui.'))
    obs.append(lockHint)
    box.append(obs)

    const plan = document.createElement('details')
    plan.className = 'sw-collapsible'
    plan.open = !!s.proximoPasso
    const psum = document.createElement('summary')
    psum.textContent = 'Adicionar planejamento (opcional)'
    plan.append(psum)
    const pBody = el('div', 'sw-manual-body')
    const pField = el('div', 'field')
    const pInput = document.createElement('textarea')
    pInput.value = s.proximoPasso
    pInput.placeholder = 'O que trabalhar na próxima sessão?'
    pInput.addEventListener('input', () => { s.proximoPasso = pInput.value })
    pField.append(pInput)
    pBody.append(pField)
    pBody.append(el('p', 'sw-hint', 'A família vê isso como "próximo passo".'))
    plan.append(pBody)
    box.append(plan)

    return box
  }

  // ── Passo 3: o que a família recebe ───────────────────────────────────

  function renderStep3() {
    if (!s.familyEdited || !s.familyText.trim()) {
      s.familyText = composeFamilySummary({
        nome: childName,
        atividadeFrase: fraseAtividades(facts().titulos),
        participacao: s.participacao,
        apoio: s.apoio,
        resultado: s.resultado,
      })
      s.familyEdited = false
    }

    const box = el('div', 'sw-step2')

    const preview = el('div', 'family-preview')
    preview.append(el('div', 'family-preview-label', 'Como a família verá'))
    preview.append(el('strong', null, `${childName}: resumo da sessão`))
    const previewSummary = el('p', null, s.familyText)
    preview.append(previewSummary)
    const next = s.proximoPasso.trim()
    if (next) preview.append(el('p', null, `Próximo passo: ${next}`))

    const b1 = el('div', 'sw-block')
    b1.append(el('h4', 'sw-q', 'O que a família vai receber'))
    b1.append(el('p', 'sw-hint', 'Montamos este resumo a partir das suas respostas — revise e deixe com a sua voz.'))
    const fField = el('div', 'field')
    const fInput = document.createElement('textarea')
    fInput.value = s.familyText
    fInput.maxLength = 800
    fInput.style.minHeight = '110px'
    fField.append(fInput)
    const counter = el('div', 'char-count', `${s.familyText.length} / 800 caracteres`)
    fInput.addEventListener('input', () => {
      s.familyText = fInput.value
      s.familyEdited = true
      counter.textContent = `${fInput.value.length} / 800 caracteres`
      previewSummary.textContent = fInput.value.trim() || '…'
      updateNav()
    })
    b1.append(fField, counter)
    const regen = el('button', 'btn btn-ghost btn-sm sw-regen', '↻ Gerar sugestão novamente')
    regen.type = 'button'
    regen.addEventListener('click', () => { s.familyEdited = false; s.familyText = ''; render() })
    b1.append(regen)

    const rev = el('label', 'sw-review')
    const rcb = document.createElement('input')
    rcb.type = 'checkbox'
    rcb.checked = s.reviewed
    rcb.addEventListener('change', () => { s.reviewed = rcb.checked; updateNav() })
    rev.append(rcb, document.createTextNode('Revisei a mensagem que será compartilhada com a família.'))

    const err = el('p', 'form-error')
    err.hidden = true
    err.dataset.swErr = ''

    box.append(b1, preview, el('p', 'sw-hint', 'Use linguagem simples, respeitosa e baseada no que você observou.'), rev, err)
    return box
  }

  // ── navegação + salvar ────────────────────────────────────────────────

  function renderNav() {
    const nav = el('div', 'sw-nav')
    const left = el('div')
    if (s.step > 1) {
      const back = el('button', 'btn btn-ghost', 'Voltar')
      back.type = 'button'
      back.addEventListener('click', () => goStep(s.step - 1))
      left.append(back)
    }
    nav.append(left)

    if (s.step < 3) {
      navForward = el('button', 'btn btn-accent', 'Continuar')
      navForward.type = 'button'
      navForward.addEventListener('click', () => { if (canContinue()) goStep(s.step + 1) })
    } else {
      navForward = el('button', 'btn btn-accent', 'Salvar e compartilhar')
      navForward.type = 'button'
      navForward.addEventListener('click', onSave)
    }
    navForward.disabled = !canContinue()
    nav.append(navForward)
    return nav
  }

  async function onSave() {
    const err = wrap.querySelector('[data-sw-err]')
    if (err) err.hidden = true
    const f = facts()
    const familySummary = s.familyText.trim()
    if (!familySummary || !s.reviewed) { updateNav(); return }

    navForward.disabled = true
    navForward.textContent = 'Salvando…'

    const { error } = await createSessionWithExecucoes({
      cycleId: cycle.id,
      activityId: s.activityId,
      sessionDate: s.date || todayISO(),
      durationMinutes: s.duration ? Number(s.duration) : null,
      activityTitle: f.activityTitle,
      focusArea: f.focusArea,
      familySummary,
      notes: s.observacao.trim() || null,
      nextStep: s.proximoPasso.trim(),
      execucaoIds: [...s.selected],
    })

    navForward.disabled = false
    navForward.textContent = 'Salvar e compartilhar'

    if (error) {
      if (err) {
        err.textContent = 'Não conseguimos salvar agora. Nada foi perdido — tente novamente.'
        err.hidden = false
      }
      return
    }

    setOpen(false)
    await loadPending()
    wrap.dispatchEvent(new CustomEvent('sw-saved'))
    await onSaved()
  }

  // ── lateral: resumo vivo da sessão ────────────────────────────────────

  function renderSide() {
    const side = document.createElement('details')
    side.className = 'card sw-side'
    side.open = window.matchMedia('(min-width: 941px)').matches
    const sum = document.createElement('summary')
    sum.textContent = 'Resumo da sessão'
    side.append(sum)

    const f = facts()
    const dl = document.createElement('dl')
    const add = (dt, dd) => {
      const a = document.createElement('dt'); a.textContent = dt
      const b = document.createElement('dd'); b.textContent = dd
      dl.append(a, b)
    }
    add('Data', formatDate(s.date) ?? '—')
    add('Duração', s.duration ? `${s.duration} min` : '—')
    add('Atividades', f.titulos.length
      ? (f.titulos.length <= 2 ? f.titulos.join(' · ') : `${f.titulos.length} atividades`)
      : 'Nenhuma ainda')
    side.append(dl)
    side.append(el('p', 'sw-side-hint', s.step === 3
      ? 'Ao salvar, a família já vê o resumo.'
      : 'Nada é salvo até o passo 3.'))
    return side
  }

  return wrap
}

// ── Sessões: tabela de histórico ─────────────────────────────────────────────

function renderSessionRow(record, index) {
  const tr = document.createElement('tr')

  const dateTd = document.createElement('td')
  dateTd.className = 'num'
  dateTd.textContent = formatDate(record.date) ?? '—'

  const actTd = document.createElement('td')
  actTd.textContent = record.activity_title ?? '—'

  const focusTd = document.createElement('td')
  focusTd.className = 'muted'
  focusTd.textContent = record.focus_area || '—'

  const durTd = document.createElement('td')
  durTd.className = 'num muted'
  durTd.textContent = record.duration_minutes ? `${record.duration_minutes} min` : '—'

  const famTd = document.createElement('td')
  const pill = el('span', 'pill pill-ok', 'Visível')
  famTd.append(pill)

  tr.append(dateTd, actTd, focusTd, durTd, famTd)
  return tr
}

async function loadSessionsTable(cycleId, tbody, emptyWrap, table) {
  tbody.replaceChildren()
  const { data, error } = await getCycleSessions(cycleId)
  const rows = error ? [] : (data ?? [])

  if (!rows.length) {
    table.hidden = true
    emptyWrap.hidden = false
  } else {
    table.hidden = false
    emptyWrap.hidden = true
    rows.forEach((r, i) => tbody.append(renderSessionRow(r, i)))
  }
  return rows
}

// ── Painel: Sessões ───────────────────────────────────────────────────────────

export function buildSessionsPanel(cycle, state, sessionForm) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'sessions'
  panel.hidden = true
  const childFirst = firstName(cycle.children?.name)

  const stack = el('div', 'stack')
  stack.style.maxWidth = 'none'

  if (state === 'cycle_active') {
    // Linha do tempo: a aba aterrissa aqui (pendências + CTA + histórico) —
    // o assistente de registro só aparece depois do clique, nunca de cara.
    const timeline = el('div', 'card')
    const inner = el('div', 'sw-timeline-inner')
    const tx = el('div')
    const titleEl = el('strong', 'sw-timeline-title', 'Carregando…')
    const subEl = el('p', 'sw-timeline-sub', '')
    tx.append(titleEl, subEl)
    const cta = el('button', 'btn btn-accent', 'Registrar sessão')
    cta.type = 'button'
    inner.append(tx, cta)
    timeline.append(inner)
    const miniList = el('div', 'sw-timeline-list')
    timeline.append(miniList)
    const okFlash = el('p', 'form-ok sw-timeline-ok')
    okFlash.hidden = true
    timeline.append(okFlash)

    sessionForm.onPendingLoaded = (rows, hadError) => {
      miniList.replaceChildren()
      if (hadError) {
        titleEl.textContent = 'Não foi possível carregar as atividades pendentes.'
        subEl.textContent = 'Você ainda pode registrar a sessão normalmente.'
        cta.className = 'btn btn-accent'
        cta.textContent = 'Registrar sessão'
        cta.onclick = () => { sessionForm.open = true }
        return
      }
      if (rows.length) {
        titleEl.textContent = rows.length === 1
          ? `1 atividade de ${childFirst} aguardando registro`
          : `${rows.length} atividades de ${childFirst} aguardando registro`
        subEl.textContent = 'Transforme o que a criança fez numa devolutiva para a família.'
        cta.className = 'btn btn-accent'
        cta.textContent = 'Registrar sessão'
        cta.onclick = () => { sessionForm.open = true }
        rows.slice(0, 3).forEach((e) => {
          const item = el('div', 'sw-timeline-item')
          item.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
          const molde = MOLDES_REGISTRO[e.molde]
          const temaLabel = molde?.temas.find((t) => t.id === e.tema)?.label || e.tema
          const titulo = pickEmbedded(e.child_activities)?.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || e.molde} · ${temaLabel}`
          item.append(document.createTextNode([titulo, formatExecucaoQuando(e.created_at)].filter(Boolean).join(' · ')))
          miniList.append(item)
        })
        if (rows.length > 3) miniList.append(el('div', 'sw-timeline-item sw-timeline-more', `e mais ${rows.length - 3}…`))
      } else {
        titleEl.textContent = 'Nenhuma atividade aguardando registro.'
        subEl.textContent = 'Você ainda pode registrar uma sessão realizada fora do Modo Criança.'
        cta.className = 'btn btn-ghost'
        cta.textContent = 'Registrar manualmente'
        cta.onclick = () => sessionForm.openManual()
      }
    }

    // Enquanto o assistente está aberto, ele É o conteúdo da aba — linha do
    // tempo e histórico saem de cena pra sobrar um foco só.
    sessionForm.addEventListener('sw-toggle', (ev) => {
      timeline.hidden = ev.detail.open
      historyCard.hidden = ev.detail.open
      if (ev.detail.open) okFlash.hidden = true
    })
    sessionForm.addEventListener('sw-saved', () => {
      okFlash.textContent = 'Sessão registrada. A família já consegue acompanhar o resumo.'
      okFlash.hidden = false
    })

    stack.append(timeline, sessionForm)
  } else {
    const LOCKED = {
      cycle_planned: 'O registro de sessões libera assim que a equipe ativar o ciclo. Por enquanto, dá para conferir o perfil pedagógico em "Ver perfil".',
      cycle_paused: 'Os registros estão bloqueados enquanto o ciclo estiver pausado. Fale com a equipe Cognita para retomar.',
      cycle_completed: 'Este ciclo já foi concluído, então não é mais possível registrar novas sessões. O histórico completo está logo abaixo.',
    }
    const lockedCard = el('div', 'card')
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(LOCKED[state] ?? LOCKED.cycle_planned))
    lockedCard.append(note)
    stack.append(lockedCard)
  }

  const historyCard = el('div', 'card')
  const bar = el('div', 'tbl-bar')
  bar.append(el('h3', null, 'Histórico de sessões'))
  historyCard.append(bar)

  const table = el('table', 'tbl')
  table.innerHTML = `<thead><tr><th>Data</th><th>Atividade</th><th>Foco</th><th>Duração</th><th>Família</th></tr></thead>`
  const tbody = document.createElement('tbody')
  table.append(tbody)

  const emptyWrap = el('div', 'card-b')
  const empty = el('div', 'empty-state')
  const img = document.createElement('img')
  img.src = gatoMatematicoSrc
  img.alt = ''
  empty.append(
    img,
    el('strong', null, 'Nenhuma sessão registrada ainda.'),
    el('span', null, 'Depois da primeira atividade, o histórico aparece aqui — e a família já consegue acompanhar.')
  )
  emptyWrap.append(empty)
  emptyWrap.hidden = true

  historyCard.append(table, emptyWrap)
  stack.append(historyCard)
  panel.append(stack)

  panel.loadTable = () => loadSessionsTable(cycle.id, tbody, emptyWrap, table)
  return panel
}
