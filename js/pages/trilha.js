import { requireRole } from '../lib/auth.js'
import { el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { PLANOS_REGISTRO, computeStatusEtapas } from '../data/planos-registro.js'
import { renderTrilhaPlano } from '../components/trilha-plano.js'

// Tela própria de exploração da trilha — separada do painel do tutor de
// propósito (ver docs/V2-DIRECAO.md): a aba Plano em tutor.html virou um
// resumo compacto; esta página é onde o mapa grande de verdade vive. Shell
// mínimo: sem rail, sem as 7 abas do painel, só voltar + título + progresso.

const session = await requireRole('tutor')
const root = document.querySelector('[data-trilha-root]')
const backLink = document.querySelector('[data-trilha-back]')
const backLabel = document.querySelector('[data-trilha-back-label]')
const titleEl = document.querySelector('[data-trilha-title]')
const progressEl = document.querySelector('[data-trilha-progress]')

function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || ''
}

function renderError(message) {
  root.replaceChildren()
  const card = el('div', 'trilha-error')
  card.innerHTML = `<strong>Não foi possível abrir a trilha</strong>`
  card.append(el('p', null, message))
  const back = el('a', 'btn btn-ghost', 'Voltar para o painel')
  back.href = 'tutor.html'
  card.append(back)
  root.append(card)
}

async function init() {
  if (!session) return

  const cycleId = new URLSearchParams(location.search).get('cycle_id')
  if (!cycleId) {
    renderError('Faltou identificar o ciclo — volte ao painel do tutor e abra a trilha por lá.')
    return
  }

  const { data: cycles, error } = await getTutorCycles(session.user.id)
  if (error) {
    renderError('Não conseguimos carregar seus ciclos agora. Tente de novo em instantes.')
    return
  }

  const cycle = (cycles ?? []).find((c) => c.id === cycleId)
  if (!cycle) {
    renderError('Este ciclo não existe ou não pertence a você.')
    return
  }

  const childName = cycle.children?.name || 'Criança'
  backLabel.textContent = `Voltar para ${firstName(childName)}`
  backLink.href = `tutor.html?view=record&tab=plan`

  const plano = PLANOS_REGISTRO.primeiros_numeros
  titleEl.textContent = plano.titulo
  document.title = `Trilha: ${plano.titulo} | Cognita Hub`

  const podePreparar = cycle.status === 'active'
  const bloqueadoMsg = {
    planned: 'Preparar atividades libera quando a equipe ativar o ciclo — a trilha abaixo já mostra o que vem a seguir.',
    paused: 'Preparar atividades fica bloqueado enquanto o ciclo estiver pausado.',
    completed: 'Este ciclo já foi concluído — a trilha abaixo fica só como histórico.',
  }[cycle.status]

  const onPrepararEtapa = (etapa) => {
    const params = new URLSearchParams({ view: 'record', tab: 'activities', plan: plano.id, step: etapa.id })
    window.location.href = `tutor.html?${params.toString()}`
  }

  root.replaceChildren()

  if (bloqueadoMsg) {
    const note = el('div', 'trilha-error')
    note.style.margin = '0 0 var(--sp-6)'
    note.style.textAlign = 'left'
    note.append(el('p', null, bloqueadoMsg))
    root.append(note)
  }

  const trilha = renderTrilhaPlano({ plano, statuses: null, podePreparar, onPrepararEtapa })
  root.append(trilha)

  function updateProgressLabel(statuses) {
    const total = plano.etapas.length
    const done = plano.etapas.reduce((n, _, i) => n + ((statuses?.[i] || (i === 0 ? 'em_andamento' : 'a_fazer')) === 'concluida' ? 1 : 0), 0)
    progressEl.textContent = `${done} de ${total}`
    progressEl.hidden = false
  }
  updateProgressLabel(null)

  const statusList = await computeStatusEtapas(plano, cycle.child_id, cycle.id)
  if (statusList) {
    trilha.updateStatuses(statusList)
    updateProgressLabel(statusList)
  }
}

init()
