import '../styles/school-demo.css'
import '../styles/school-overview.css'

import { escapeHtml } from '../utils/html.js'
import { setSchoolBack } from './school-back.js'
import { DEMO_CHILD } from './school-demo-data.js'
import { getDemoRoster, missionsLabel, reviewDetail, studentStatus } from './school-roster.js'

// Visão da escola (demo da Cognita Escola): quantos alunos, tutores, jornadas
// e o que espera revisão — estado operacional, sem nenhum conteúdo pedagógico.
// Tudo fictício e rotulado como tal; só o Mateus abre (onOpenStudent), os
// demais cartões não são botões pra não prometer o que a demo não faz. Não
// chama Supabase.
export function renderDemoSchoolOverview(root, { onExit, onOpenStudent } = {}) {
  setSchoolBack(() => onExit?.())

  const { school, metrics, students } = getDemoRoster()
  const interactiveName = students.find((student) => student.interactive)?.name ?? DEMO_CHILD.name

  root.innerHTML = `
    <div class="demo-screen school-overview">
      <header class="demo-header">
        <button class="demo-back" type="button" data-demo-back aria-label="Back to Cognita for Schools">
          <span aria-hidden="true">‹</span> Cognita for Schools
        </button>
        <span class="demo-eyebrow">Cognita for Schools</span>
        <h1>School overview</h1>
        <p>A connected view of learning across your institution.</p>
      </header>

      <div class="school-demo-banner" role="note">
        <strong>Demonstration data</strong>
        <span>${escapeHtml(school)}, its students and its tutors are fictional.</span>
      </div>

      <section class="demo-card school-metrics" aria-label="School metrics">
        <div class="school-metrics__head">
          <span class="demo-label">${escapeHtml(school)}</span>
          <span class="school-demo-chip">Demo</span>
        </div>
        <dl class="school-metrics__grid">
          <div><dt>Students</dt><dd>${metrics.students}</dd></div>
          <div><dt>Tutors</dt><dd>${metrics.tutors}</dd></div>
          <div><dt>Active journeys</dt><dd>${metrics.activeJourneys}</dd></div>
          <div><dt>Awaiting review</dt><dd>${metrics.awaitingReview}</dd></div>
        </dl>
      </section>

      <section class="school-roster" aria-label="Students">
        <div class="school-roster__head">
          <span class="demo-label">Students</span>
          <span class="demo-hint">Showing ${students.length} of ${metrics.students} students · ${escapeHtml(school)}</span>
        </div>
        <ul class="school-roster__list">
          ${students.map(studentHtml).join('')}
        </ul>
        <p class="demo-hint">Only ${escapeHtml(interactiveName)} is interactive in this demo. The other students are fictional examples.</p>
      </section>

      <p class="demo-note">Demonstration data</p>
    </div>
  `

  root.querySelector('[data-demo-back]')?.addEventListener('click', () => onExit?.())
  root.querySelectorAll('[data-open-student]').forEach((button) => {
    button.addEventListener('click', () => onOpenStudent?.(button.dataset.openStudent))
  })
}

function studentHtml(student) {
  const status = studentStatus(student)
  const percent = student.total > 0 ? Math.round((student.completed / student.total) * 100) : 0

  const body = `
    <span class="school-student__avatar" aria-hidden="true">${escapeHtml(student.name.charAt(0))}</span>
    <span class="school-student__body">
      <span class="school-student__name"><strong>${escapeHtml(student.name)}</strong> · ${student.age} years old</span>
      <span class="school-student__journey">${escapeHtml(student.journey)}</span>
      <span class="school-student__meta">Tutor · ${escapeHtml(student.tutor)}</span>
      <span class="school-student__progress">
        <span class="demo-progress" role="progressbar" aria-label="Missions completed" aria-valuemin="0" aria-valuemax="${student.total}" aria-valuenow="${student.completed}"><span style="width:${percent}%"></span></span>
        <span class="school-student__count">${escapeHtml(missionsLabel(student))}</span>
      </span>
      ${student.lastActivity ? `<span class="school-student__meta">Last activity · ${escapeHtml(student.lastActivity)}</span>` : ''}
      <span class="school-status school-status--${status.key}"><span aria-hidden="true">${status.icon}</span> ${status.label}</span>
      ${
        student.awaitingReview > 0
          ? `<span class="school-student__attention"><strong>Needs attention</strong> ${escapeHtml(reviewDetail(student))}</span>`
          : ''
      }
    </span>
    ${student.interactive ? '<span class="school-student__chevron" aria-hidden="true">›</span>' : ''}
  `

  return student.interactive
    ? `<li><button class="school-student school-student--interactive" type="button" data-open-student="${escapeHtml(student.id)}">${body}</button></li>`
    : `<li><div class="school-student">${body}</div></li>`
}
