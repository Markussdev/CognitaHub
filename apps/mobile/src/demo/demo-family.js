import '../styles/school-demo.css'

import { getChildAvatar } from '../config/child-avatars.js'
import { escapeHtml } from '../utils/html.js'
import { getSchoolDemoState } from './school-demo-store.js'
import { getDemoJourneyView } from './build-demo-journey.js'
import { DEMO_CHILD, DEMO_FAMILY, formatDemoQuando } from './school-demo-data.js'

// Painel da família (demo da Cognita Escola). Conteúdo fictício; nada é
// buscado no Supabase.
//
// Dois tipos de informação, de propósito:
//  - o que é fato operacional (Mateus concluiu a atividade → a jornada
//    avança) aparece assim que acontece;
//  - a interpretação do que aconteceu só chega depois que o mediador
//    registra a sessão: resumo (nível 2) e próximo passo. A nota interna do
//    mediador (nível 3, session.notes) NUNCA é lida aqui.
export function renderDemoFamilyExperience(root, { onExit } = {}) {
  const { session } = getSchoolDemoState()
  const avatar = getChildAvatar(DEMO_CHILD.avatarKey)
  const { cycle } = DEMO_FAMILY

  const feedback = session.exists
    ? {
        text: session.familySummary,
        author: DEMO_FAMILY.feedback.author,
        initials: DEMO_FAMILY.feedback.initials,
        when: formatDemoQuando(session.createdAt),
        nextStep: session.nextStep,
      }
    : DEMO_FAMILY.feedback

  // A jornada é a que o mediador atribuiu a Mateus (a inicial ou uma que
  // ele montou) — o mesmo estado que a criança está jogando. O progresso é
  // fato operacional e aparece na hora; o título da jornada só o mediador e a
  // família veem (a criança não).
  const { summary, missions: missionsByModule } = getDemoJourneyView()
  const missions = missionsByModule[summary.releasedModule.id]
  const completedMissions = missions.filter((mission) => mission.status === 'concluida').length

  const journeyDots = missions
    .map((mission, index) => {
      const state = mission.status === 'concluida' ? 'done' : mission.status === 'disponivel' ? 'current' : 'todo'
      return `<span class="demo-dots__dot demo-dots__dot--${state}" aria-hidden="true">${state === 'done' ? '✓' : index + 1}</span>`
    })
    .join('')

  const moduleLabel = `Module ${summary.releasedModule.position} · ${summary.releasedModule.title}`
  const journeyCaption = summary.finished
    ? 'Journey complete'
    : summary.releasedStatus === 'aguardando_revisao'
      ? `${moduleLabel} — complete; awaiting the tutor`
      : `${moduleLabel} — in progress`

  root.innerHTML = `
    <div class="demo-screen">
      <header class="demo-header">
        <button class="demo-back" type="button" data-demo-back aria-label="Back to Cognita for Schools">
          <span aria-hidden="true">‹</span> Cognita for Schools
        </button>
        <span class="demo-eyebrow">Family dashboard</span>
        <h1>Hi, ${escapeHtml(DEMO_FAMILY.guardianName)}.</h1>
        <p>Follow ${escapeHtml(DEMO_CHILD.name)}'s learning journey in Cognita.</p>
      </header>

      <section class="demo-child-card">
        <img src="${avatar.image}" alt="" />
        <div>
          <span class="demo-label">Following</span>
          <strong>${escapeHtml(DEMO_CHILD.name)} · ${DEMO_CHILD.age} years old</strong>
        </div>
      </section>

      <section class="demo-card demo-cycle">
        <span class="demo-pill"><span aria-hidden="true">●</span> Active cycle</span>
        <h2>${escapeHtml(DEMO_CHILD.name)}'s learning cycle is in progress.</h2>
        <p>Cycle goal: ${escapeHtml(cycle.goal)}</p>
        <div class="demo-progress-row">
          <div
            class="demo-progress"
            role="progressbar"
            aria-label="Month ${cycle.month} of ${cycle.months}"
            aria-valuemin="1"
            aria-valuemax="${cycle.months}"
            aria-valuenow="${cycle.month}"
          >
            <span style="width:${Math.round((cycle.month / cycle.months) * 100)}%"></span>
          </div>
          <strong>Month ${cycle.month} of ${cycle.months}</strong>
        </div>
      </section>

      <section class="demo-card demo-feedback">
        <span class="demo-label">Latest tutor feedback</span>
        <p class="demo-feedback__text">${escapeHtml(feedback.text)}</p>
        <div class="demo-author">
          <span class="demo-author__avatar" aria-hidden="true">${escapeHtml(feedback.initials)}</span>
          <span>${escapeHtml(feedback.author)} · ${escapeHtml(feedback.when)}</span>
        </div>
        ${
          feedback.nextStep
            ? `
        <div class="demo-next">
          <span class="demo-label">Next step</span>
          <p>${escapeHtml(feedback.nextStep)}</p>
        </div>`
            : ''
        }
      </section>

      <section class="demo-card">
        <span class="demo-label">${escapeHtml(DEMO_CHILD.name)}'s journey</span>
        <strong class="demo-journey-title">${escapeHtml(summary.title)}</strong>
        <div class="demo-dots" role="img" aria-label="${completedMissions} of ${missions.length} missions completed in this module">
          ${journeyDots}
        </div>
        <p class="demo-hint">${escapeHtml(journeyCaption)}</p>
      </section>

      <p class="demo-note">Demo data only.</p>
    </div>
  `

  root.querySelector('[data-demo-back]')?.addEventListener('click', () => onExit?.())
}
