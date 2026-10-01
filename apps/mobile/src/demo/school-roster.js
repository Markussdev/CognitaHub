import { getSchoolDemoState, hasPendingExecution } from './school-demo-store.js'
import { getDemoJourneyView } from './build-demo-journey.js'
import { DEMO_CHILD, DEMO_FAMILY, DEMO_SCHOOL } from './school-demo-data.js'

// Visão institucional da demo (demo-school.js, demo-learner.js). Sem DOM e sem
// estado próprio: só lê. O cartão do Mateus é derivado do mesmo store que o
// painel do mediador, a criança e a família usam — então a escola nunca
// discorda deles (concluiu uma missão → "Session to review"; o mediador
// registrou a sessão → volta a "Up to date"). Os outros alunos são fixos.

function mateusRow() {
  const { execution } = getSchoolDemoState()
  const { summary } = getDemoJourneyView()

  return {
    id: 'mateus',
    name: DEMO_CHILD.name,
    age: DEMO_CHILD.age,
    journey: summary.title,
    tutor: DEMO_FAMILY.feedback.author,
    completed: summary.completedCount,
    total: summary.missionCount,
    awaitingReview: hasPendingExecution() ? execution.total : 0,
    lastActivity: execution.completed ? execution.titulo : null,
    interactive: true,
  }
}

export function getDemoInteractiveStudent() {
  return mateusRow()
}

export function getDemoRoster() {
  const students = DEMO_SCHOOL.students.map((student) =>
    student.id === 'mateus' ? mateusRow() : { ...student, interactive: false },
  )

  return {
    school: DEMO_SCHOOL.name,
    students,
    metrics: {
      ...DEMO_SCHOOL.metrics,
      // Alunos com algo a revisar (não atividades): bate com a lista.
      awaitingReview: students.filter((student) => student.awaitingReview > 0).length,
    },
  }
}

// Só estado operacional — "tem sessão a revisar ou não". Nada que julgue o
// ritmo da criança ("no caminho", "atrasado"): isso seria interpretação
// pedagógica, que é do mediador.
export function studentStatus(student) {
  return student.awaitingReview > 0
    ? { key: 'review', icon: '●', label: 'Session to review' }
    : { key: 'ok', icon: '✓', label: 'Up to date' }
}

export function reviewDetail(student) {
  const count = student.awaitingReview
  return `${count} completed ${count === 1 ? 'activity' : 'activities'} awaiting tutor review`
}

// Contagem de missões, nunca porcentagem: um número por criança numa lista
// convida a comparar e ranquear.
export function missionsLabel(student) {
  return `${student.completed} of ${student.total} ${student.total === 1 ? 'mission' : 'missions'}`
}
