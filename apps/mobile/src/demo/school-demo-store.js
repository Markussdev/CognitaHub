import { DEMO_ACTIVITY_DEFAULTS, demoMoldeLabel } from './school-demo-data.js'

// Estado local compartilhado pelas três superfícies da demo Cognita Escola.
// Vive só em memória — não persiste, não sincroniza e não fala com Supabase.
// Sair da Cognita Escola zera tudo (resetSchoolDemo, chamado em
// school-license.js). Não é um modelo de dados do produto; só existe pra
// demonstração.
//
// Três coisas diferentes, de propósito:
//   activity  = o que o mediador deixou preparado agora;
//   execution = o que Mateus já fez e aguarda registro (uma pendência só —
//               a demo não guarda histórico);
//   session   = o que o mediador transformou em devolutiva pra família.
// Preparar outra atividade troca `activity`; nunca apaga uma execução pendente.

const INITIAL_EXECUTION = {
  completed: false,
  registered: false,
  releaseId: null, // qual atividade preparada foi feita
  molde: null,
  titulo: null,
  durationSeconds: null,
  completedAt: null,
  total: 0, // execuções que ainda não viraram sessão
}

const INITIAL_SESSION = {
  exists: false,
  participacao: null,
  apoio: null,
  resultado: null,
  activityTitle: null,
  familySummary: null, // nível 2: o que a família recebe
  notes: null, // nível 3: nota interna — a família NUNCA lê isto
  nextStep: null,
  createdAt: null,
}

const state = {
  // releaseId muda a cada "Liberar" — é o que diferencia "a atividade que a
  // criança já fez" de "uma atividade nova preparada depois".
  activity: { ...DEMO_ACTIVITY_DEFAULTS, releaseId: 1 },
  execution: { ...INITIAL_EXECUTION },
  session: { ...INITIAL_SESSION },
}

// Mesmo objeto sempre — o conteúdo é trocado no lugar, então uma tela que
// guardou a referência continua vendo o estado atual.
export function getSchoolDemoState() {
  return state
}

// "Liberar para Mateus". Só troca a atividade preparada.
export function updateDemoActivity(patch) {
  state.activity = { ...state.activity, ...patch, releaseId: state.activity.releaseId + 1 }
}

export function markDemoActivityCompleted({ durationSeconds }) {
  const alreadyPending = hasPendingExecution()

  state.execution = {
    completed: true,
    registered: false,
    releaseId: state.activity.releaseId,
    molde: state.activity.molde,
    titulo: demoMoldeLabel(state.activity.molde),
    durationSeconds,
    completedAt: Date.now(),
    total: alreadyPending ? state.execution.total + 1 : 1,
  }
}

// Há algo que o mediador ainda não transformou em sessão?
export function hasPendingExecution() {
  return state.execution.completed && !state.execution.registered
}

// A atividade preparada agora já foi feita por Mateus? (governa o mapa da
// criança e os pontos da jornada — independe de a sessão já ter sido registrada.)
export function isDemoActivityDone() {
  return state.execution.completed && state.execution.releaseId === state.activity.releaseId
}

// O mediador consome a pendência: nasce a sessão que a família vai ler.
export function registerDemoSession({ participacao, apoio, resultado, familySummary, notes, nextStep }) {
  if (!hasPendingExecution()) return false

  state.session = {
    exists: true,
    participacao,
    apoio,
    resultado,
    activityTitle: state.execution.titulo,
    familySummary,
    notes: notes || null,
    nextStep: nextStep || null,
    createdAt: Date.now(),
  }
  state.execution = { ...state.execution, registered: true }

  return true
}

export function resetSchoolDemo() {
  state.activity = { ...DEMO_ACTIVITY_DEFAULTS, releaseId: 1 }
  state.execution = { ...INITIAL_EXECUTION }
  state.session = { ...INITIAL_SESSION }
}
