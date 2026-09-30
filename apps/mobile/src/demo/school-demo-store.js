import {
  DEMO_ACTIVITY_DEFAULTS,
  DEFAULT_JOURNEY,
  DEFAULT_JOURNEY_ID,
  DEMO_LIBRARY_DEFAULTS,
  DEMO_SLOT_MISSION_ID,
  demoMoldeLabel,
  describeDemoActivity,
  describeDemoDetail,
} from './school-demo-data.js'
import { createInitialProgress, isMissionDone, moduleStatus } from './journey-logic.js'

// Estado local compartilhado pelas três superfícies da demo Cognita Escola.
// Vive só em memória — não persiste, não sincroniza e não fala com Supabase.
// Sair da Cognita Escola zera tudo (resetSchoolDemo, chamado em
// school-license.js). Não é um modelo de dados do produto; só existe pra
// demonstração.
//
// Coisas diferentes, de propósito:
//   activity  = o que o mediador deixou preparado agora ("Preparada agora");
//   execution = o que Mateus já fez e aguarda registro (uma pendência só —
//               a demo não guarda histórico);
//   session   = o que o mediador transformou em devolutiva pra família;
//   journeys  = as jornadas do mediador: a inicial (permanente) + as que
//               ele monta (rascunho ou publicada);
//   journeyProgress = o progresso de Mateus em CADA jornada. Atribuir outra
//               jornada só troca a ativa; nada é apagado.
// Preparar outra atividade troca `activity`; nunca apaga uma execução pendente.

const INITIAL_EXECUTION = {
  completed: false,
  registered: false,
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

function freshState() {
  return {
    // releaseId muda a cada "Liberar" — diferencia "a atividade que a
    // criança já fez" de "uma atividade nova preparada depois".
    activity: { ...DEMO_ACTIVITY_DEFAULTS, releaseId: 1 },
    // releaseId em que a missão "Preparada agora" foi concluída (ou null).
    slotCompletedRelease: null,
    execution: { ...INITIAL_EXECUTION },
    session: { ...INITIAL_SESSION },
    journeys: [structuredClone(DEFAULT_JOURNEY)],
    activeJourneyId: DEFAULT_JOURNEY_ID,
    journeyProgress: { [DEFAULT_JOURNEY_ID]: createInitialProgress(DEFAULT_JOURNEY) },
    // Atividades que o mediador preparou (mais recente primeiro) — o acervo
    // de onde o builder tira missões.
    preparedActivities: [],
    seq: 0,
  }
}

const state = freshState()

// Mesmo objeto sempre — o conteúdo é trocado no lugar, então uma tela que
// guardou a referência continua vendo o estado atual.
export function getSchoolDemoState() {
  return state
}

// ── atividade preparada + acervo ─────────────────────────────────────────

// "Liberar para Mateus". Troca a atividade preparada e a guarda no acervo.
export function updateDemoActivity(patch) {
  state.activity = { ...state.activity, ...patch, releaseId: state.activity.releaseId + 1 }

  const { molde, quantidade, maiorNumero, rodadas } = state.activity
  const config = { molde, quantidade, maiorNumero, rodadas }
  const latest = state.preparedActivities[0]

  if (!latest || describeDemoActivity(latest.config) !== describeDemoActivity(config)) {
    state.preparedActivities = [{ id: `prepared-${++state.seq}`, config }, ...state.preparedActivities].slice(0, 5)
  }
}

// Atividades que o builder oferece como missão: as que o mediador preparou
// e as que já vêm no acervo (sem repetir a mesma configuração).
export function getDemoActivityLibrary() {
  const seen = new Set()

  return [
    ...state.preparedActivities.map((item) => ({ ...item, source: 'prepared' })),
    ...DEMO_LIBRARY_DEFAULTS.map((item) => ({ ...item, source: 'default' })),
  ]
    .filter((item) => {
      const key = describeDemoActivity(item.config)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item) => ({
      id: item.id,
      source: item.source,
      config: { ...item.config },
      title: demoMoldeLabel(item.config.molde),
      meta: describeDemoDetail(item.config),
    }))
}

// A missão "Preparada agora" ainda espera a criança? Enquanto sim, "Liberar"
// muda o que ela vai receber; depois de concluída, a atividade nova só vai
// pro acervo.
export function isSlotMissionOpen() {
  return !isMissionDone(state.journeyProgress[DEFAULT_JOURNEY_ID], DEMO_SLOT_MISSION_ID)
}

// 'waiting' (a criança ainda vai receber) | 'done' (a preparada agora já foi
// feita) | 'library' (a missão já foi concluída antes; a nova está no acervo).
export function getDemoSlotState() {
  if (isSlotMissionOpen()) return 'waiting'
  return state.slotCompletedRelease === state.activity.releaseId ? 'done' : 'library'
}

// ── jornadas ─────────────────────────────────────────────────────────────

export function getDemoJourneys() {
  return state.journeys
}

export function getDemoJourney(id) {
  return state.journeys.find((journey) => journey.id === id) ?? null
}

export function getActiveJourney() {
  return getDemoJourney(state.activeJourneyId)
}

// null = essa jornada ainda não foi iniciada.
export function getJourneyProgress(id) {
  return state.journeyProgress[id] ?? null
}

function upsertJourney(draft, status) {
  const journey = {
    ...structuredClone(draft),
    id: draft.id ?? `custom-${++state.seq}`,
    origin: 'custom',
    status,
  }
  const index = state.journeys.findIndex((item) => item.id === journey.id)

  if (index >= 0) {
    // Publicada é somente leitura (como na web: pra mudar, cria outra).
    if (state.journeys[index].status === 'published') return null
    state.journeys[index] = journey
  } else {
    state.journeys.push(journey)
  }

  return journey.id
}

// Salvar rascunho / Publicar: só mexem na lista do mediador. A jornada que a
// criança está fazendo (activeJourneyId) não muda até "Atribuir".
export function saveDemoJourneyDraft(draft) {
  return upsertJourney(draft, 'draft')
}

export function publishDemoJourney(draft) {
  return upsertJourney(draft, 'published')
}

// "Atribuir para Mateus": só troca a jornada ativa. O progresso de cada
// jornada fica guardado; uma jornada nunca iniciada começa do zero.
export function assignDemoJourney(id) {
  const journey = getDemoJourney(id)
  if (!journey || journey.status !== 'published') return false

  state.activeJourneyId = id
  if (!state.journeyProgress[id]) state.journeyProgress[id] = createInitialProgress(journey)

  return true
}

// A criança concluiu uma missão da jornada ativa. Registra a execução
// pendente pro mediador (a interpretação só chega à família na sessão).
export function completeDemoMission({ missionId, config, isSlot, durationSeconds }) {
  const progress = state.journeyProgress[state.activeJourneyId]
  if (!progress || isMissionDone(progress, missionId)) return false

  progress.completed.push(missionId)
  if (isSlot) state.slotCompletedRelease = state.activity.releaseId

  const alreadyPending = hasPendingExecution()

  state.execution = {
    completed: true,
    registered: false,
    molde: config.molde,
    titulo: demoMoldeLabel(config.molde),
    durationSeconds,
    completedAt: Date.now(),
    total: alreadyPending ? state.execution.total + 1 : 1,
  }

  return true
}

// Decisão do mediador: libera o módulo seguinte quando o atual terminou.
export function advanceDemoModule() {
  const journey = getActiveJourney()
  const progress = state.journeyProgress[state.activeJourneyId]

  if (moduleStatus(journey, progress, progress.releasedModule) !== 'aguardando_revisao') return false

  progress.releasedModule += 1
  return true
}

// ── execução pendente e sessão ───────────────────────────────────────────

// Há algo que o mediador ainda não transformou em sessão?
export function hasPendingExecution() {
  return state.execution.completed && !state.execution.registered
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
  Object.assign(state, freshState())
}
