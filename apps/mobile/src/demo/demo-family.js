import '../styles/school-demo.css'

import { getChildAvatar } from '../config/child-avatars.js'
import { escapeHtml } from '../utils/html.js'
import { getSchoolDemoState, isDemoActivityDone } from './school-demo-store.js'
import {
  DEMO_CHILD,
  DEMO_FAMILY,
  DEMO_MODULES,
  DEMO_MISSIONS,
  DEMO_RELEASED_MODULE_ID,
  formatDemoQuando,
} from './school-demo-data.js'

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

  const module = DEMO_MODULES.find((item) => item.id === DEMO_RELEASED_MODULE_ID)
  const missions = DEMO_MISSIONS[DEMO_RELEASED_MODULE_ID]
  const completedMissions =
    missions.filter((mission) => mission.status === 'concluida').length + (isDemoActivityDone() ? 1 : 0)

  const journeyDots = missions
    .map((_, index) => {
      const state = index < completedMissions ? 'done' : index === completedMissions ? 'current' : 'todo'
      return `<span class="demo-dots__dot demo-dots__dot--${state}" aria-hidden="true">${state === 'done' ? '✓' : index + 1}</span>`
    })
    .join('')

  root.innerHTML = `
    <div class="demo-screen">
      <header class="demo-header">
        <button class="demo-back" type="button" data-demo-back aria-label="Voltar ao Cognita Escola">
          <span aria-hidden="true">‹</span> Cognita Escola
        </button>
        <span class="demo-eyebrow">Painel da família</span>
        <h1>Olá, ${escapeHtml(DEMO_FAMILY.guardianName)}.</h1>
        <p>Acompanhe aqui o caminho de ${escapeHtml(DEMO_CHILD.name)} no Cognita.</p>
      </header>

      <section class="demo-child-card">
        <img src="${avatar.image}" alt="" />
        <div>
          <span class="demo-label">Acompanhando</span>
          <strong>${escapeHtml(DEMO_CHILD.name)} · ${DEMO_CHILD.age} anos</strong>
        </div>
      </section>

      <section class="demo-card demo-cycle">
        <span class="demo-pill"><span aria-hidden="true">●</span> Ciclo ativo</span>
        <h2>O acompanhamento de ${escapeHtml(DEMO_CHILD.name)} está em andamento.</h2>
        <p>Objetivo do ciclo: ${escapeHtml(cycle.goal)}</p>
        <div class="demo-progress-row">
          <div
            class="demo-progress"
            role="progressbar"
            aria-label="Mês ${cycle.month} de ${cycle.months}"
            aria-valuemin="1"
            aria-valuemax="${cycle.months}"
            aria-valuenow="${cycle.month}"
          >
            <span style="width:${Math.round((cycle.month / cycle.months) * 100)}%"></span>
          </div>
          <strong>Mês ${cycle.month} de ${cycle.months}</strong>
        </div>
      </section>

      <section class="demo-card demo-feedback">
        <span class="demo-label">Última devolutiva do tutor</span>
        <p class="demo-feedback__text">${escapeHtml(feedback.text)}</p>
        <div class="demo-author">
          <span class="demo-author__avatar" aria-hidden="true">${escapeHtml(feedback.initials)}</span>
          <span>${escapeHtml(feedback.author)} · ${escapeHtml(feedback.when)}</span>
        </div>
        ${
          feedback.nextStep
            ? `
        <div class="demo-next">
          <span class="demo-label">O que vem agora</span>
          <p>${escapeHtml(feedback.nextStep)}</p>
        </div>`
            : ''
        }
      </section>

      <section class="demo-card">
        <span class="demo-label">Jornada de ${escapeHtml(DEMO_CHILD.name)}</span>
        <div class="demo-dots" role="img" aria-label="${completedMissions} de ${missions.length} missões concluídas">
          ${journeyDots}
        </div>
        <p class="demo-hint">Módulo ${module.trail_modules.position} · ${escapeHtml(module.trail_modules.title)} — em andamento</p>
      </section>

      <p class="demo-note">Demonstração com dados fictícios.</p>
    </div>
  `

  root.querySelector('[data-demo-back]')?.addEventListener('click', () => onExit?.())
}
