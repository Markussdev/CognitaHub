import { el, ageFrom } from '../../lib/ui.js'
import { emblemaUrl } from '../../lib/trilha-assets.js'
import { MOLDES_REGISTRO, buildContractFromParts, formatConfigResumo } from '../../data/moldes-registro.js'
import { createChildActivity, listChildActivities, updateChildActivity, archiveChildActivity, restoreChildActivity } from '../../data/child-activities.js'
import { firstName, pickEmbedded, gatoMatematicoSrc, kebabMenu, MISSION_STATUS_LABEL, formatLastSession } from './shared.js'

// Domínio Atividades — acervo + assistente de criação/edição — extraído de
// js/pages/tutor.js. Contrato com o resto da tela (renderRecord em
// tutor.js): buildActivitiesPanel(cycle, state, { onSaved, tutorId })
// devolve um <section> com .loadTable() (recarrega o acervo, devolve as
// linhas ativas pro badge da aba) e .openPreset(preset) (ponte
// ?preset=<slug> vinda da Biblioteca — undefined nos estados bloqueados,
// sem wizard pra receber). `tutorId` é session.user.id, passado explícito
// porque este módulo não conhece a sessão do tutor, só quem a preparou.
// Nada do comportamento mudou nesta extração — só o arquivo que contém o
// código.
//
// A aba aterrissa num ACERVO (lista com filtros), não num formulário; criar/
// editar/duplicar abre um assistente de 3 passos (mesma casca visual das
// Sessões) com a prévia REAL do Modo Criança fixa à direita — o iframe roda a
// própria casca (?preview=1) e recebe o contrato ao vivo via postMessage.
// O que salva é a instância child_activities. O motor
// (moldes declarativos em MOLDES_REGISTRO, buildContractFromParts) não mudou.
// "Últimas execuções" saiu daqui — essa informação vive no Resumo (timeline)
// e em Sessões (aguardando registro); cada aba com um trabalho só.

// Emblemas por molde (mesmos assets da Jornada). 'revisar' existe mas não é
// um molde autorável; tudo que não é 'contar' cai em 'identificar'.
function emblemaDeMolde(molde) {
  return emblemaUrl(molde === 'contar' ? 'contar' : 'identificar')
}

// Descrição pedagógica de cada experiência (o tutor escolhe a experiência,
// não um "molde" técnico). Fica aqui e não no registro porque é copy da
// tela de autoria, não contrato da casca.
const MOLDE_DESCRICAO = {
  contar: 'A criança toca nos elementos enquanto conta.',
  identificar: 'A criança encontra o número pedido entre algumas opções.',
  comparar: 'A criança compara quantidades e escolhe a maior.',
  associar: 'A criança liga cada número à quantidade certa.',
}

// Frase humana do passo de revisão. Fallback genérico cobre moldes futuros.
const FRASE_REVISAO = {
  contar: (cfg, temaLabel, nome) => `${nome} vai contar até ${cfg.quantidade} com ${temaLabel.toLowerCase()}, em ${cfg.rodadas} ${cfg.rodadas === 1 ? 'rodada' : 'rodadas'}.`,
  identificar: (cfg, temaLabel, nome) => `${nome} vai encontrar números de 1 a ${cfg.maiorNumero}, entre ${cfg.opcoes} opções, em ${cfg.rodadas} ${cfg.rodadas === 1 ? 'rodada' : 'rodadas'}.`,
}

// ── Controles de formulário (slider, pills) ──────────────────────────────────
// Usados só pelo passo 2 do assistente (campos dinâmicos do molde).

// Slider — pra faixas largas ("de sensação contínua", ex.: quantos itens).
function makeSlider({ label, min, max, value, onChange }) {
  const field = el('div', 'field')
  const head = el('div', 'slider-head')
  head.append(el('label', null, label))
  const valueBox = el('span', 'slider-value num', String(value))
  head.append(valueBox)
  field.append(head)

  const input = document.createElement('input')
  input.type = 'range'
  input.className = 'slider-input'
  input.min = String(min)
  input.max = String(max)
  input.value = String(value)

  let current = value
  function setValue(v) {
    current = Number(v)
    input.value = String(current)
    valueBox.textContent = String(current)
    onChange?.(current)
  }
  input.addEventListener('input', () => setValue(input.value))

  field.append(input)
  return { field, getValue: () => current, setValue }
}

// Pills numeradas — pra faixas curtas e precisas (ex.: nível, rodadas).
function makePillSelector({ label, min, max, value, onChange }) {
  const field = el('div', 'field')
  field.append(el('label', null, label))
  const row = el('div', 'pill-select-row')

  let current = value
  const buttons = []
  const values = []
  function setValue(n) {
    const idx = values.indexOf(n)
    if (idx === -1) return
    buttons.forEach((b) => b.classList.remove('selected'))
    buttons[idx].classList.add('selected')
    current = n
    onChange?.(current)
  }
  for (let n = min; n <= max; n += 1) {
    const btn = el('button', 'pill-num', String(n))
    btn.type = 'button'
    if (n === value) btn.classList.add('selected')
    btn.addEventListener('click', () => setValue(n))
    buttons.push(btn)
    values.push(n)
    row.append(btn)
  }

  field.append(row)
  return { field, getValue: () => current, setValue }
}

// ── Assistente de criação/edição de atividade (3 passos + prévia viva) ──────

function renderActivityWizard(cycle, onSaved, tutorId) {
  const wrap = el('section', 'aw')
  wrap.hidden = true
  const childName = firstName(cycle.children?.name)
  const childAge = ageFrom(cycle.children?.birth_date)

  // Completa o estado com os padrões do molde/tema — chamada tanto ao criar
  // do zero quanto ao trocar de experiência no passo 1.
  function withMoldeDefaults(base) {
    const molde = MOLDES_REGISTRO[base.molde]
    const tema = base.tema ?? molde.temas.find((t) => t.disponivel)?.id
    const temaLabel = molde.temas.find((t) => t.id === tema)?.label || ''
    const config = {}
    molde.campos.forEach((c) => { config[c.key] = base.config?.[c.key] ?? c.default })
    return {
      ...base,
      tema,
      config,
      instrucao: base.instrucao ?? (molde.instrucaoPadrao || ''),
      titulo: base.titulo ?? (molde.tituloPadrao?.(temaLabel) || molde.label),
      textTouched: base.textTouched ?? false,
    }
  }
  const blank = () => {
    const moldeKey = Object.entries(MOLDES_REGISTRO).find(([, m]) => m.disponivel)?.[0]
    return withMoldeDefaults({ step: 1, mode: 'create', editingId: null, molde: moldeKey })
  }
  let s = blank()
  let isOpen = false
  let navForward = null

  // Prévia estável: criada UMA vez (recriar por passo recarregaria o iframe).
  // É o Modo Criança de verdade em ?preview=1 — não grava nada.
  const previewIframe = document.createElement('iframe')
  previewIframe.src = 'modo-crianca.html?preview=1'
  previewIframe.title = 'Prévia do Modo Criança'
  previewIframe.addEventListener('load', pushPreview)
  const previewCard = el('div', 'card aw-preview')
  const previewHead = el('div', 'card-h')
  const previewHeadInner = el('div', 'preview-card-h')
  previewHeadInner.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
  previewHeadInner.append(document.createTextNode('O que a criança vê — ao vivo'))
  previewHead.append(previewHeadInner)
  const previewFrameWrap = el('div', 'preview-frame-wrap')
  const previewFrame = el('div', 'preview-frame')
  previewFrame.append(previewIframe)
  previewFrameWrap.append(previewFrame)
  previewCard.append(previewHead, previewFrameWrap)

  function pushPreview() {
    if (!previewIframe.contentWindow) return
    const contract = buildContractFromParts({
      molde: s.molde, tema: s.tema, config: s.config, instrucao: s.instrucao, titulo: s.titulo,
    })
    previewIframe.contentWindow.postMessage({ type: 'cognita-preview-contract', contract }, window.location.origin)
  }

  const grid = el('div', 'aw-grid')
  const main = el('div', 'card sw-main')
  grid.append(main, previewCard)
  wrap.append(grid)

  function setOpen(open) {
    isOpen = open
    wrap.hidden = !open
    wrap.dispatchEvent(new CustomEvent('aw-toggle', { detail: { open } }))
    if (open) { render(); pushPreview() }
  }
  wrap.openCreate = () => { s = blank(); setOpen(true) }
  wrap.openEdit = (row) => {
    s = withMoldeDefaults({
      step: 1, mode: 'edit', editingId: row.id,
      molde: row.molde, tema: row.tema, config: row.config,
      instrucao: row.instrucao, titulo: row.titulo, textTouched: true,
    })
    setOpen(true)
  }
  wrap.openDuplicate = (row) => {
    const molde = MOLDES_REGISTRO[row.molde]
    const temaLabel = molde?.temas.find((t) => t.id === row.tema)?.label || row.tema
    const base = row.titulo || molde?.tituloPadrao?.(temaLabel) || molde?.label || ''
    s = withMoldeDefaults({
      step: 1, mode: 'duplicate', editingId: null,
      molde: row.molde, tema: row.tema, config: row.config,
      instrucao: row.instrucao, titulo: `${base} (cópia)`.trim(), textTouched: true,
    })
    setOpen(true)
  }
  // Ponte "Personalizar para Mateus" vinda da Biblioteca (?preset=<slug>,
  // resolvido via DIGITAL_PRESETS) — abre o passo 2 (Ajustar) já com
  // molde/tema/config prontos; o tutor só confirma. mode 'create': salva
  // como atividade nova, não referencia a Biblioteca por id (é só o ponto
  // de partida, não uma cópia de registro).
  wrap.openFromPreset = (preset) => {
    s = withMoldeDefaults({
      step: 2, mode: 'create', editingId: null,
      molde: preset.molde, tema: preset.tema, config: preset.config, textTouched: false,
    })
    setOpen(true)
  }

  const STEP_LABELS = ['Experiência', 'Ajustar', 'Revisar']

  function render() {
    main.replaceChildren()

    const head = el('div', 'sw-head')
    const headTx = el('div')
    headTx.append(el('h3', 'sw-title', s.mode === 'edit' ? 'Editar atividade' : 'Criar atividade'))
    headTx.append(el('p', 'sw-sub', `para ${childName}${childAge != null ? ` · ${childAge} anos` : ''} · Passo ${s.step} de 3`))
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
  }

  function canContinue() {
    if (s.step === 1) return !!s.molde
    if (s.step === 2) return !!s.instrucao.trim()
    return true
  }
  function updateNav() { if (navForward) navForward.disabled = !canContinue() }
  function goStep(n) {
    s.step = n
    render()
    requestAnimationFrame(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // Passo 1 — escolher a experiência (cards explicativos, não pills técnicas)
  function renderStep1() {
    const box = el('div', 'sw-step2')
    const b = el('div', 'sw-block')
    b.append(el('h4', 'sw-q', 'Que experiência você quer criar?'))
    const list = el('div', 'sw-options')
    Object.entries(MOLDES_REGISTRO).forEach(([id, m]) => {
      const card = el('button', `aw-exp${s.molde === id ? ' is-selected' : ''}`)
      card.type = 'button'
      if (!m.disponivel) { card.disabled = true; card.setAttribute('aria-disabled', 'true') }
      const img = el('img', 'aw-exp-emblem')
      img.src = emblemaDeMolde(id)
      img.alt = ''
      const tx = el('span', 'aw-exp-tx')
      tx.append(el('span', 'aw-exp-title', m.disponivel ? m.label : `${m.label} — em breve`))
      tx.append(el('span', 'aw-exp-desc', MOLDE_DESCRICAO[id] || ''))
      card.append(img, tx)
      if (m.disponivel) {
        card.addEventListener('click', () => {
          if (s.molde === id) return
          s = withMoldeDefaults({
            ...s, molde: id,
            tema: undefined, config: undefined, instrucao: undefined, titulo: undefined,
            textTouched: false,
          })
          render()
          pushPreview()
        })
      }
      list.append(card)
    })
    b.append(list)
    box.append(b)
    return box
  }

  // Passo 2 — tema + ajustes (campos dinâmicos do registro) + texto recolhido
  function renderStep2() {
    const molde = MOLDES_REGISTRO[s.molde]
    const box = el('div', 'sw-step2')

    const bTema = el('div', 'sw-block')
    bTema.append(el('h4', 'sw-q', 'Qual será o tema?'))
    const temaList = el('div', 'sw-options')
    molde.temas.forEach((t) => {
      const btn = el('button', `sw-option${s.tema === t.id ? ' is-selected' : ''}`)
      btn.type = 'button'
      if (!t.disponivel) btn.disabled = true
      btn.append(el('span', 'sw-option-dot'), document.createTextNode(t.disponivel ? t.label : `${t.label} — em breve`))
      btn.addEventListener('click', () => {
        s.tema = t.id
        if (!s.textTouched) s.titulo = molde.tituloPadrao?.(t.label) || molde.label
        render()
        pushPreview()
      })
      temaList.append(btn)
    })
    bTema.append(temaList)
    box.append(bTema)

    const bCfg = el('div', 'sw-block')
    bCfg.append(el('h4', 'sw-q', `Ajustar para ${childName}`))
    const pillsRow = el('div', 'row')
    molde.campos.forEach((campo) => {
      const make = campo.control === 'slider' ? makeSlider : makePillSelector
      const control = make({
        label: campo.label, min: campo.min, max: campo.max,
        value: s.config[campo.key] ?? campo.default,
        onChange: (v) => { s.config[campo.key] = v; pushPreview() },
      })
      if (campo.control === 'slider') bCfg.append(control.field)
      else pillsRow.append(control.field)
    })
    if (pillsRow.children.length) bCfg.append(pillsRow)
    box.append(bCfg)

    const det = document.createElement('details')
    det.className = 'sw-collapsible'
    det.open = false
    const sum = document.createElement('summary')
    sum.textContent = 'Personalizar texto e instrução'
    det.append(sum)
    const dBody = el('div', 'sw-manual-body')
    const instField = el('div', 'field')
    instField.append(el('label', null, 'O que a criança lê'))
    const instInput = document.createElement('textarea')
    instInput.value = s.instrucao
    instInput.addEventListener('input', () => { s.instrucao = instInput.value; s.textTouched = true; pushPreview(); updateNav() })
    instField.append(instInput)
    const titField = el('div', 'field')
    titField.append(el('label', null, 'Título (só para você identificar)'))
    const titInput = document.createElement('input')
    titInput.type = 'text'
    titInput.value = s.titulo
    titInput.addEventListener('input', () => { s.titulo = titInput.value; s.textTouched = true })
    titField.append(titInput)
    dBody.append(instField, titField)
    det.append(dBody)
    box.append(det)
    box.append(el('p', 'sw-hint', 'Os textos padrão já funcionam bem — personalize só se quiser.'))
    return box
  }

  // Passo 3 — revisão humana; a prévia ao lado é o destaque
  function renderStep3() {
    const molde = MOLDES_REGISTRO[s.molde]
    const temaLabel = molde.temas.find((t) => t.id === s.tema)?.label || s.tema
    const frase = FRASE_REVISAO[s.molde]?.(s.config, temaLabel, childName)
      || `"${s.titulo}" — ${formatConfigResumo(s.molde, s.config)}.`

    const box = el('div', 'sw-step2')
    const b = el('div', 'sw-block')
    b.append(el('h4', 'sw-q', s.mode === 'edit' ? 'Revisar alterações' : 'Revisar e salvar'))
    b.append(el('p', 'aw-review', frase))
    b.append(el('p', 'sw-hint', `${s.titulo} · ${molde.label} · ${temaLabel} · ${formatConfigResumo(s.molde, s.config)}`))
    const err = el('p', 'form-error')
    err.hidden = true
    err.dataset.awErr = ''
    b.append(err)
    box.append(b)
    box.append(el('p', 'sw-hint', 'Confira a prévia ao lado — é exatamente o que a criança verá.'))
    return box
  }

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
      navForward.disabled = !canContinue()
      nav.append(navForward)
    } else {
      const right = el('div', 'aw-save-row')
      const fazerBtn = el('button', 'btn btn-ghost', `Salvar e fazer agora`)
      fazerBtn.type = 'button'
      fazerBtn.addEventListener('click', () => save({ fazerAgora: true, btn: fazerBtn }))
      const saveBtn = el('button', 'btn btn-accent', s.mode === 'edit' ? 'Salvar alterações' : 'Salvar atividade')
      saveBtn.type = 'button'
      saveBtn.addEventListener('click', () => save({ fazerAgora: false, btn: saveBtn }))
      navForward = saveBtn
      right.append(fazerBtn, saveBtn)
      nav.append(right)
    }
    return nav
  }

  async function save({ fazerAgora, btn }) {
    const errEl = wrap.querySelector('[data-aw-err]')
    if (errEl) errEl.hidden = true

    const instrucao = s.instrucao.trim()
    if (!instrucao) {
      if (errEl) { errEl.textContent = 'A instrução para a criança está vazia — volte ao passo 2 e escreva.'; errEl.hidden = false }
      return
    }
    const molde = MOLDES_REGISTRO[s.molde]
    const temaLabel = molde.temas.find((t) => t.id === s.tema)?.label || ''
    const titulo = s.titulo.trim() || molde.tituloPadrao?.(temaLabel) || molde.label

    btn.disabled = true
    const oldLabel = btn.textContent
    btn.textContent = 'Salvando…'
    const { data, error } = s.mode === 'edit'
      ? await updateChildActivity(s.editingId, { molde: s.molde, tema: s.tema, config: s.config, instrucao, titulo })
      : await createChildActivity({
          childId: cycle.child_id,
          createdBy: tutorId,
          cycleId: cycle.id,
          molde: s.molde,
          tema: s.tema,
          config: s.config,
          instrucao,
          titulo,
        })
    btn.disabled = false
    btn.textContent = oldLabel

    if (error) {
      if (errEl) { errEl.textContent = 'Não conseguimos salvar agora. Nada foi perdido — tente novamente.'; errEl.hidden = false }
      return
    }

    const savedId = s.mode === 'edit' ? s.editingId : data?.id
    if (fazerAgora && savedId) {
      // vai direto pro Modo Criança REAL (grava execução) — volta pra aba
      // Sessões, onde a execução aparece pra virar registro.
      window.location.href = `modo-crianca.html?${new URLSearchParams({ activity: savedId, return: 'tutor.html?view=record&tab=sessions' })}`
      return
    }
    setOpen(false)
    wrap.dispatchEvent(new CustomEvent('aw-saved'))
    await onSaved?.()
  }

  return wrap
}

// ── Painel: Atividades (acervo) ─────────────────────────────────────────────

export function buildActivitiesPanel(cycle, state, { onSaved, tutorId } = {}) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'activities'
  panel.hidden = true
  const childName = firstName(cycle.children?.name)

  const stack = el('div', 'stack')
  stack.style.maxWidth = 'none'

  const LOCKED = {
    cycle_paused: 'Preparar atividades fica bloqueado enquanto o ciclo estiver pausado. Fale com a equipe Cognita para retomar.',
    cycle_completed: 'Este ciclo já foi concluído — não é mais possível preparar novas atividades. O que já foi preparado continua listado abaixo.',
  }
  const locked = !!LOCKED[state]

  const acervo = el('div', 'stack')
  acervo.style.maxWidth = 'none'

  let wizard = null

  const head = el('div', 'acervo-head')
  const headTx = el('div')
  headTx.append(el('h3', 'acervo-title', `Atividades de ${childName}`))
  headTx.append(el('p', 'acervo-sub', 'Prepare experiências individuais ou use-as em uma Jornada.'))
  head.append(headTx)
  if (!locked) {
    wizard = renderActivityWizard(cycle, onSaved, tutorId)
    const createBtn = el('button', 'btn btn-accent', '+ Criar atividade')
    createBtn.type = 'button'
    createBtn.addEventListener('click', () => wizard.openCreate())
    head.append(createBtn)
  }
  acervo.append(head)

  if (locked) {
    const lockedCard = el('div', 'card')
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(LOCKED[state]))
    lockedCard.append(note)
    acervo.append(lockedCard)
  }

  // ── filtros ──
  let filtro = 'todas'
  let allRows = []
  const FILTERS = [
    { id: 'todas', label: 'Todas' },
    { id: 'avulsas', label: 'Avulsas' },
    { id: 'jornada', label: 'Em Jornada' },
    { id: 'arquivadas', label: 'Arquivadas' },
  ]
  const filtersRow = el('div', 'acervo-filters')
  const chipEls = {}
  FILTERS.forEach(({ id, label }) => {
    const chip = el('button', `filter-chip${id === filtro ? ' active' : ''}`)
    chip.type = 'button'
    chip.append(document.createTextNode(label), el('span', 'num', ''))
    chip.addEventListener('click', () => { filtro = id; renderList() })
    chipEls[id] = chip
    filtersRow.append(chip)
  })
  acervo.append(filtersRow)

  const listWrap = el('div', 'acervo-list')
  acervo.append(listWrap)

  function matchesFiltro(row, f) {
    if (f === 'arquivadas') return row.status === 'archived'
    if (row.status === 'archived') return false
    if (f === 'avulsas') return !row.child_trail_mission_id
    if (f === 'jornada') return !!row.child_trail_mission_id
    return true
  }

  async function onArchive(row) {
    const titulo = row.titulo || MOLDES_REGISTRO[row.molde]?.tituloPadrao?.(row.tema) || 'esta atividade'
    const ok = window.confirm(`Arquivar "${titulo}"? Ela sai da lista ativa, mas o histórico de execuções e sessões continua guardado.`)
    if (!ok) return
    const { error } = await archiveChildActivity(row.id)
    if (error) { window.alert('Não conseguimos arquivar agora. Tente de novo em instantes.'); return }
    await onSaved?.()
  }

  async function onRestore(row) {
    const { error } = await restoreChildActivity(row.id)
    if (error) { window.alert('Não conseguimos restaurar agora. Tente de novo em instantes.'); return }
    await onSaved?.()
  }

  function renderAcervoItem(row) {
    const molde = MOLDES_REGISTRO[row.molde]
    const temaLabel = molde?.temas.find((t) => t.id === row.tema)?.label || row.tema
    const titulo = row.titulo || molde?.tituloPadrao?.(temaLabel) || row.molde
    const item = el('div', 'card acervo-item')

    const emblem = el('img', 'acervo-emblem')
    emblem.src = emblemaDeMolde(row.molde)
    emblem.alt = ''

    const tx = el('div', 'acervo-tx')
    tx.append(el('strong', 'acervo-item-title', titulo))
    tx.append(el('p', 'acervo-item-meta', `${molde?.label || row.molde} · ${temaLabel} · ${formatConfigResumo(row.molde, row.config)}`))

    const missaoStatus = row.child_trail_mission_id ? pickEmbedded(row.child_trail_missions)?.status : null
    const statusLine = el('p', 'acervo-item-status')
    if (row.status === 'archived') {
      statusLine.append(el('span', 'pill pill-mid', 'Arquivada'))
    } else if (row.child_trail_mission_id) {
      const cls = missaoStatus === 'disponivel' ? 'pill-ok' : 'pill-mid'
      statusLine.append(el('span', `pill ${cls}`, `Jornada · ${MISSION_STATUS_LABEL[missaoStatus] || missaoStatus || '—'}`))
    } else {
      statusLine.append(document.createTextNode(`Avulsa · criada ${formatLastSession(row.created_at?.slice(0, 10))}`))
    }
    tx.append(statusLine)

    const actions = el('div', 'acervo-actions')
    // Avulsa sempre executável; missão de Jornada só quando 'disponivel'
    // (repetir/adaptar é decisão da Jornada, não um clique aqui).
    const podeExecutar = row.status !== 'archived' && (!row.child_trail_mission_id || missaoStatus === 'disponivel')
    if (podeExecutar) {
      const link = el('a', 'btn btn-ghost btn-sm', `Fazer com ${childName}`)
      link.href = `modo-crianca.html?${new URLSearchParams({ activity: row.id, return: 'tutor.html?view=record&tab=sessions' })}`
      actions.append(link)
    }
    // Atividade de Jornada é administrada pela Jornada — sem editar/arquivar.
    if (!locked && wizard && !row.child_trail_mission_id) {
      const items = row.status === 'archived'
        ? [
            { label: 'Restaurar', run: () => onRestore(row) },
            { label: 'Duplicar', run: () => wizard.openDuplicate(row) },
          ]
        : [
            { label: 'Editar', run: () => wizard.openEdit(row) },
            { label: 'Duplicar', run: () => wizard.openDuplicate(row) },
            { label: 'Arquivar', run: () => onArchive(row), tone: 'bad' },
          ]
      actions.append(kebabMenu(items))
    }

    item.append(emblem, tx, actions)
    return item
  }

  const EMPTY_MSG = {
    avulsas: 'Nenhuma atividade avulsa ainda.',
    jornada: 'Nenhuma atividade de Jornada — elas nascem quando você libera um módulo.',
    arquivadas: 'Nada arquivado.',
  }

  function renderList() {
    FILTERS.forEach(({ id }) => {
      chipEls[id].classList.toggle('active', id === filtro)
      chipEls[id].querySelector('.num').textContent = String(allRows.filter((r) => matchesFiltro(r, id)).length)
    })
    const rows = allRows.filter((r) => matchesFiltro(r, filtro))
    listWrap.replaceChildren()
    if (!rows.length) {
      if (filtro === 'todas' && !allRows.length) {
        const emptyCard = el('div', 'card')
        const emptyBody = el('div', 'card-b')
        const empty = el('div', 'empty-state')
        const img = document.createElement('img')
        img.src = gatoMatematicoSrc
        img.alt = ''
        empty.append(
          img,
          el('strong', null, 'Nenhuma atividade preparada ainda.'),
          el('span', null, `Crie uma experiência simples para começar com ${childName} — leva menos de um minuto.`)
        )
        emptyBody.append(empty)
        emptyCard.append(emptyBody)
        listWrap.append(emptyCard)
      } else {
        listWrap.append(el('p', 'acervo-empty', EMPTY_MSG[filtro] || 'Nada por aqui.'))
      }
      return
    }
    rows.forEach((r) => listWrap.append(renderAcervoItem(r)))
  }

  function renderLoadError() {
    listWrap.replaceChildren()
    const card = el('div', 'card')
    const body = el('div', 'card-b')
    const inner = el('div', 'error-card')
    inner.append(
      el('strong', null, 'Não conseguimos carregar as atividades agora.'),
      el('p', null, 'Verifique a conexão e tente novamente.')
    )
    const retry = el('button', 'btn btn-ghost', 'Tentar novamente')
    retry.type = 'button'
    retry.addEventListener('click', () => panel.loadTable())
    inner.append(retry)
    body.append(inner)
    card.append(body)
    listWrap.append(card)
  }

  async function loadAcervo() {
    const { data, error } = await listChildActivities(cycle.child_id, { incluirArquivadas: true })
    if (error) { renderLoadError(); return [] }
    allRows = data ?? []
    renderList()
    // o badge da aba conta só as ativas (arquivada não é "preparada")
    return allRows.filter((r) => r.status !== 'archived')
  }

  if (wizard) {
    wizard.addEventListener('aw-toggle', (ev) => { acervo.hidden = ev.detail.open })
    stack.append(acervo, wizard)
  } else {
    stack.append(acervo)
  }
  panel.append(stack)

  panel.loadTable = loadAcervo
  // undefined nos estados bloqueados (sem wizard pra receber) — mesmo padrão
  // de prefillFromPlano. Único chamador: a ponte ?preset=<slug> em bootstrap().
  panel.openPreset = wizard ? (preset) => wizard.openFromPreset(preset) : undefined
  return panel
}
