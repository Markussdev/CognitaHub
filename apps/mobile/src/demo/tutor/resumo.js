import { escapeHtml } from '../../utils/html.js'
import { advanceDemoModule, getDemoSlotState, getSchoolDemoState, hasPendingExecution } from '../school-demo-store.js'
import { getDemoJourneyView } from '../build-demo-journey.js'
import { DEMO_CHILD, describeDemoActivity, formatDemoQuando } from '../school-demo-data.js'

const SLOT_STATUS = {
  waiting: (nome) => `Waiting for ${nome}`,
  done: (nome) => `Completed by ${nome}`,
  library: () => 'In your library — use it in a journey',
}

// Aba Resumo do mediador (demo da Cognita Escola). Um estado dominante, no
// máximo uma ação — a mesma cascata de js/pages/resumo-estado.js, só com os
// estados que a demo alcança: 1. execução da criança sem sessão (prioridade
// máxima: já fez algo que ainda não virou devolutiva), 2. módulo terminado
// (quem decide o avanço é o mediador), 4. jornada concluída e 6. missão
// disponível. O texto de cada estado vem de decisaoDe() em js/pages/tutor.js.
export function renderResumoTab(panel, { goTab, onOpenChild }) {
  const { activity, execution, session } = getSchoolDemoState()
  const { summary } = getDemoJourneyView()
  const nome = DEMO_CHILD.name

  let title
  let description
  let action

  if (hasPendingExecution()) {
    const quando = formatDemoQuando(execution.completedAt)

    title =
      execution.total > 1
        ? `${nome} completed ${execution.total} activities that haven't been logged yet — the most recent was "${execution.titulo}" ${quando}.`
        : `${nome} completed "${execution.titulo}" ${quando} and it hasn't been logged yet.`
    description = 'Turn what the child did into a session for the family to follow.'
    action = `<button class="demo-primary" type="button" data-review>Review what ${escapeHtml(nome)} did</button>`
  } else if (summary.releasedStatus === 'aguardando_revisao') {
    title = `Module ${summary.releasedModule.position} is complete. Time to decide how ${nome} continues.`
    description = 'Moving on to the next module is your call.'
    action = `<button class="demo-primary" type="button" data-advance>Advance to module ${summary.releasedModule.position + 1} · ${escapeHtml(summary.nextModuleTitle)}</button>`
  } else if (summary.finished) {
    title = `${nome} finished the journey "${summary.title}". 🎉 The history is saved.`
    description = 'Choose the next journey when it makes sense — nothing is lost.'
    action = `<button class="demo-primary" type="button" data-journeys>Assign next journey</button>`
  } else {
    title = `Everything is ready. ${nome} has a mission ready on the device.`
    description = "Nothing needs your decision right now — it's the child's turn."
    action = onOpenChild
      ? `<button class="demo-link" type="button" data-open-child>Open child experience →</button>`
      : ''
  }

  const moduleState = summary.finished
    ? 'complete'
    : summary.releasedStatus === 'aguardando_revisao'
      ? 'complete, awaiting your decision'
      : 'in progress'

  panel.innerHTML = `
    <section class="demo-card demo-decision">
      <span class="demo-label">Next decision</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      ${action ? `<div class="demo-actions">${action}</div>` : ''}
    </section>

    <section class="demo-card">
      <span class="demo-label">Status</span>
      <dl class="demo-facts">
        <div>
          <dt>Active journey</dt>
          <dd>
            ${escapeHtml(summary.title)}
            <span class="demo-hint">${summary.finished ? 'Journey' : `Module ${summary.releasedModule.position} · ${escapeHtml(summary.releasedModule.title)}`} — ${escapeHtml(moduleState)} · ${summary.completedCount} of ${summary.missionCount} missions</span>
          </dd>
        </div>
        <div>
          <dt>Prepared activity</dt>
          <dd>
            ${escapeHtml(describeDemoActivity(activity))}
            <span class="demo-status">${escapeHtml(SLOT_STATUS[getDemoSlotState()](nome))}</span>
          </dd>
        </div>
        ${
          session.exists
            ? `
        <div>
          <dt>Latest feedback</dt>
          <dd>Sent to the family · ${escapeHtml(formatDemoQuando(session.createdAt))}</dd>
        </div>`
            : ''
        }
      </dl>
    </section>
  `

  panel.querySelector('[data-review]')?.addEventListener('click', () => goTab('sessoes', { openWizard: true }))
  panel.querySelector('[data-journeys]')?.addEventListener('click', () => goTab('jornada'))
  panel.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
  panel.querySelector('[data-advance]')?.addEventListener('click', () => {
    advanceDemoModule()
    goTab('resumo')
  })
}
