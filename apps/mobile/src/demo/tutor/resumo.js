import { escapeHtml } from '../../utils/html.js'
import { getSchoolDemoState, hasPendingExecution, isDemoActivityDone } from '../school-demo-store.js'
import { DEMO_CHILD, DEMO_MODULES, describeDemoActivity, formatDemoQuando } from '../school-demo-data.js'

// Aba Resumo do mediador (demo da Cognita Escola). Um estado dominante, no
// máximo uma ação — a mesma cascata de js/pages/resumo-estado.js, só com os
// estados que a demo alcança: 1. execução da criança sem sessão (prioridade
// máxima: já fez algo que ainda não virou devolutiva) e 6. missão disponível.
// O texto de cada estado vem de decisaoDe() em js/pages/tutor.js.
export function renderResumoTab(panel, { goTab, onOpenChild }) {
  const { activity, execution, session } = getSchoolDemoState()
  const nome = DEMO_CHILD.name
  const modulo = DEMO_MODULES[0].trail_modules

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
  } else {
    title = `Tudo preparado. ${nome} tem uma missão disponível no aparelho.`
    description = 'Nada esperando decisão sua agora — é a vez da criança.'
    action = onOpenChild
      ? `<button class="demo-link" type="button" data-open-child>Abrir experiência da criança →</button>`
      : ''
  }

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
          <dt>Jornada</dt>
          <dd>Módulo ${modulo.position} · ${escapeHtml(modulo.title)} — em andamento</dd>
        </div>
        <div>
          <dt>Atividade preparada</dt>
          <dd>
            ${escapeHtml(describeDemoActivity(activity))}
            <span class="demo-status">${isDemoActivityDone() ? `Concluída por ${escapeHtml(nome)}` : `Aguardando ${escapeHtml(nome)}`}</span>
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
  panel.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
}
