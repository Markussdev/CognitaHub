// Aba Sessões: linha do tempo (pendências + CTA) e histórico de sessões.
// O assistente de registro mora em sessao-wizard.js.
import { MOLDES_REGISTRO } from '../../data/moldes-registro.js'
import { getCycleSessions } from '../../data/sessions.js'
import { gatoMatematicoSrc } from '../../lib/asset-urls.js'
import { el } from '../../lib/ui.js'
import { firstName, formatDate, formatExecucaoQuando, pickEmbedded } from './helpers.js'

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
