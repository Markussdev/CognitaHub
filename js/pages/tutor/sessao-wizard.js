// Assistente de registro de sessão (3 passos) e composição da devolutiva.
import { listPendingExecucoes } from '../../data/atividade-execucao.js'
import { MOLDES_REGISTRO } from '../../data/moldes-registro.js'
import { createSessionWithExecucoes } from '../../data/sessions.js'
import { el } from '../../lib/ui.js'
import { COMO_ENCERROU_LABEL, firstName, formatDate, formatDuracaoAprox, formatExecucaoQuando, pickEmbedded, todayISO } from './helpers.js'

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
