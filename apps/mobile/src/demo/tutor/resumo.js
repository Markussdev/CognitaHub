import { escapeHtml } from '../../utils/html.js'
import { advanceDemoModule, getDemoSlotState, getSchoolDemoState, hasPendingExecution } from '../school-demo-store.js'
import { getDemoJourneyView } from '../build-demo-journey.js'
import { DEMO_CHILD, describeDemoActivity, formatDemoQuando } from '../school-demo-data.js'

const SLOT_STATUS = {
  waiting: (nome) => `Aguardando ${nome}`,
  done: (nome) => `Concluída por ${nome}`,
  library: () => 'No acervo — use em uma jornada',
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
        ? `${nome} concluiu ${execution.total} atividades que ainda não viraram registro — a mais recente foi "${execution.titulo}" ${quando}.`
        : `${nome} completou "${execution.titulo}" ${quando} e a execução ainda não virou registro.`
    description = 'Transforme o que a criança fez numa sessão para a família acompanhar.'
    action = `<button class="demo-primary" type="button" data-review>Revisar o que ${escapeHtml(nome)} fez</button>`
  } else if (summary.releasedStatus === 'aguardando_revisao') {
    title = `O módulo ${summary.releasedModule.position} terminou. Hora de decidir como ${nome} segue.`
    description = 'Avançar para o próximo módulo é uma decisão sua.'
    action = `<button class="demo-primary" type="button" data-advance>Avançar para o módulo ${summary.releasedModule.position + 1} · ${escapeHtml(summary.nextModuleTitle)}</button>`
  } else if (summary.finished) {
    title = `${nome} concluiu a jornada "${summary.title}". 🎉 O histórico está guardado.`
    description = 'Escolha a próxima jornada quando fizer sentido — nada se perde.'
    action = `<button class="demo-primary" type="button" data-journeys>Atribuir próxima jornada</button>`
  } else {
    title = `Tudo preparado. ${nome} tem uma missão disponível no aparelho.`
    description = 'Nada esperando decisão sua agora — é a vez da criança.'
    action = onOpenChild
      ? `<button class="demo-link" type="button" data-open-child>Abrir experiência da criança →</button>`
      : ''
  }

  const moduleState = summary.finished
    ? 'concluída'
    : summary.releasedStatus === 'aguardando_revisao'
      ? 'concluído, aguardando sua decisão'
      : 'em andamento'

  panel.innerHTML = `
    <section class="demo-card demo-decision">
      <span class="demo-label">Próxima decisão</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      ${action ? `<div class="demo-actions">${action}</div>` : ''}
    </section>

    <section class="demo-card">
      <span class="demo-label">Situação</span>
      <dl class="demo-facts">
        <div>
          <dt>Jornada ativa</dt>
          <dd>
            ${escapeHtml(summary.title)}
            <span class="demo-hint">${summary.finished ? 'Jornada' : `Módulo ${summary.releasedModule.position} · ${escapeHtml(summary.releasedModule.title)}`} ${escapeHtml(moduleState)} · ${summary.completedCount} de ${summary.missionCount} missões</span>
          </dd>
        </div>
        <div>
          <dt>Preparada agora</dt>
          <dd>
            ${escapeHtml(describeDemoActivity(activity))}
            <span class="demo-status">${escapeHtml(SLOT_STATUS[getDemoSlotState()](nome))}</span>
          </dd>
        </div>
        ${
          session.exists
            ? `
        <div>
          <dt>Última devolutiva</dt>
          <dd>Enviada à família · ${escapeHtml(formatDemoQuando(session.createdAt))}</dd>
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
