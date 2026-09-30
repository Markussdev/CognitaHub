// Aba Atividades: acervo (lista com filtros) e menu de ações por item.
// O assistente de criação/edição mora em atividade-wizard.js.
import { listChildActivities, archiveChildActivity, restoreChildActivity } from '../../data/child-activities.js'
import { MOLDES_REGISTRO, formatConfigResumo } from '../../data/moldes-registro.js'
import { gatoMatematicoSrc } from '../../lib/asset-urls.js'
import { el } from '../../lib/ui.js'
import { emblemaDeMolde, renderActivityWizard } from './atividade-wizard.js'
import { MISSION_STATUS_LABEL, firstName, formatLastSession, pickEmbedded } from './helpers.js'

// ── Painel: Atividades — acervo + assistente de criação ──────────────────────
// A aba aterrissa num ACERVO (lista com filtros), não num formulário; criar/
// editar/duplicar abre um assistente de 3 passos (mesma casca visual das
// Sessões) com a prévia REAL do Modo Criança fixa à direita — o iframe roda a
// própria casca (?preview=1) e recebe o contrato ao vivo via postMessage.
// O que salva é a instância child_activities (docs/supabase-fase-4b). O motor
// (moldes declarativos em MOLDES_REGISTRO, buildContractFromParts) não mudou.
// "Últimas execuções" saiu daqui — essa informação vive no Resumo (timeline)
// e em Sessões (aguardando registro); cada aba com um trabalho só.

// Menu contextual "⋯" — concentra Duplicar/Editar/Arquivar num lugar só,
// em vez de uma fileira de botões por item do acervo.
function kebabMenu(items) {
  const wrap = el('div', 'kebab')
  const btn = el('button', 'btn btn-ghost btn-sm kebab-btn', '⋯')
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Mais ações')
  btn.setAttribute('aria-haspopup', 'true')
  btn.setAttribute('aria-expanded', 'false')
  const menu = el('div', 'kebab-menu')
  menu.hidden = true

  function close() {
    menu.hidden = true
    btn.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', onDoc)
    document.removeEventListener('keydown', onKey)
  }
  function onDoc(ev) { if (!wrap.contains(ev.target)) close() }
  function onKey(ev) { if (ev.key === 'Escape') close() }

  items.forEach(({ label, run, tone }) => {
    const it = el('button', `kebab-item${tone ? ` kebab-item--${tone}` : ''}`, label)
    it.type = 'button'
    it.addEventListener('click', () => { close(); run() })
    menu.append(it)
  })

  btn.addEventListener('click', () => {
    if (menu.hidden) {
      menu.hidden = false
      btn.setAttribute('aria-expanded', 'true')
      setTimeout(() => {
        document.addEventListener('click', onDoc)
        document.addEventListener('keydown', onKey)
      }, 0)
    } else close()
  })

  wrap.append(btn, menu)
  return wrap
}

// ── Painel: Atividades (acervo) ─────────────────────────────────────────────

export function buildActivitiesPanel(cycle, state, onSaved) {
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
    wizard = renderActivityWizard(cycle, onSaved)
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
