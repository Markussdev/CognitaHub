import '../styles/school-demo.css'
import '../styles/school-overview.css'

import { getChildAvatar } from '../config/child-avatars.js'
import { escapeHtml } from '../utils/html.js'
import { setSchoolBack } from './school-back.js'
import { DEMO_CHILD, DEMO_SCHOOL } from './school-demo-data.js'
import { getDemoInteractiveStudent, missionsLabel, reviewDetail, studentStatus } from './school-roster.js'

// Ecossistema de um aluno da escola (demo da Cognita Escola): de onde a escola
// entra nas três superfícies que já existiam — mediador, criança e família —
// sempre para o Mateus, o único perfil real da demo. Quem abre cada uma decide
// pra onde ela volta (onOpen*), então sair de lá retorna a esta tela. Não chama
// Supabase.
export function renderDemoLearner(root, { onExit, onOpenTutor, onOpenChild, onOpenFamily } = {}) {
  setSchoolBack(() => onExit?.())

  const student = getDemoInteractiveStudent()
  const status = studentStatus(student)
  const avatar = getChildAvatar(DEMO_CHILD.avatarKey)
  const percent = student.total > 0 ? Math.round((student.completed / student.total) * 100) : 0
  const name = escapeHtml(student.name)

  root.innerHTML = `
    <div class="demo-screen school-overview">
      <header class="demo-header">
        <button class="demo-back" type="button" data-demo-back aria-label="Back to school overview">
          <span aria-hidden="true">‹</span> School overview
        </button>
        <span class="demo-eyebrow">Student ecosystem</span>
        <h1>${name}</h1>
        <p>${student.age} years old · ${escapeHtml(DEMO_SCHOOL.name)}</p>
      </header>

      <section class="demo-child-card">
        <img src="${avatar.image}" alt="" />
        <div>
          <span class="demo-label">${escapeHtml(student.journey)}</span>
          <strong>Tutor · ${escapeHtml(student.tutor)}</strong>
        </div>
      </section>

      <section class="demo-card school-learner-status">
        <span class="school-status school-status--${status.key}"><span aria-hidden="true">${status.icon}</span> ${status.label}</span>
        <div class="school-student__progress">
          <span class="demo-progress" role="progressbar" aria-label="Missions completed" aria-valuemin="0" aria-valuemax="${student.total}" aria-valuenow="${student.completed}"><span style="width:${percent}%"></span></span>
          <span class="school-student__count">${escapeHtml(missionsLabel(student))}</span>
        </div>
        ${student.lastActivity ? `<p class="demo-hint">Last activity · ${escapeHtml(student.lastActivity)}</p>` : ''}
        ${
          student.awaitingReview > 0
            ? `<p class="school-student__attention"><strong>Needs attention</strong> ${escapeHtml(reviewDetail(student))}</p>`
            : ''
        }
      </section>

      <section class="demo-card">
        <span class="demo-label">Open ${name}'s ecosystem</span>
        <ul class="school-ecosystem">
          <li>
            <button class="school-ecosystem__button" type="button" data-open-tutor>
              <span class="school-ecosystem__copy">
                <strong>Tutor</strong>
                <span>Build journeys, prepare activities, and record observations.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </li>
          <li>
            <button class="school-ecosystem__button" type="button" data-open-child>
              <span class="school-ecosystem__copy">
                <strong>Child</strong>
                <span>Completes math activities in visual journeys with individual settings.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </li>
          <li>
            <button class="school-ecosystem__button" type="button" data-open-family>
              <span class="school-ecosystem__copy">
                <strong>Family</strong>
                <span>Receives guided feedback — without the tutor's internal notes.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </li>
        </ul>
      </section>

      <p class="demo-note">Demonstration data</p>
    </div>
  `

  root.querySelector('[data-demo-back]')?.addEventListener('click', () => onExit?.())
  root.querySelector('[data-open-tutor]')?.addEventListener('click', () => onOpenTutor?.())
  root.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
  root.querySelector('[data-open-family]')?.addEventListener('click', () => onOpenFamily?.())
}
