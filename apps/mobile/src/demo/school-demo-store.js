import { DEMO_ACTIVITY_DEFAULTS } from './school-demo-data.js'

// Estado local compartilhado pelas três superfícies da demo Cognita Escola:
// o mediador libera uma atividade, a criança recebe exatamente ela, e a
// família vê que houve uma execução. Vive só em memória — não persiste, não
// sincroniza e não fala com Supabase. Sair da Cognita Escola zera tudo
// (resetSchoolDemo, chamado em school-license.js). Não é um modelo de dados
// do produto; só existe pra demonstração.

const INITIAL_EXECUTION = { completed: false, durationSeconds: null, molde: null }

const state = {
  activity: { ...DEMO_ACTIVITY_DEFAULTS },
  execution: { ...INITIAL_EXECUTION },
}

// Mesmo objeto sempre — o conteúdo é trocado no lugar, então uma tela que
// guardou a referência continua vendo o estado atual.
export function getSchoolDemoState() {
  return state
}

// "Liberar para Mateus". Uma atividade nova é uma execução nova a fazer, então
// o resultado da anterior deixa de valer.
export function updateDemoActivity(patch) {
  state.activity = { ...state.activity, ...patch }
  state.execution = { ...INITIAL_EXECUTION }
}

export function markDemoActivityCompleted({ durationSeconds }) {
  state.execution = {
    completed: true,
    durationSeconds,
    molde: state.activity.molde,
  }
}

export function resetSchoolDemo() {
  state.activity = { ...DEMO_ACTIVITY_DEFAULTS }
  state.execution = { ...INITIAL_EXECUTION }
}
