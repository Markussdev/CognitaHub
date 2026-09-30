// Regras puras do percurso na demo da Cognita Escola — sem estado, sem DOM,
// sem imports. Uma jornada é { modules: [{ missions: [{ id }] }] }; o
// progresso é { completed: [ids de missão], releasedModule: índice do módulo
// que o mediador liberou pra criança }.
//
// O avanço de módulo é decisão do mediador: terminar a última missão de um
// módulo o deixa "aguardando revisão" e só um "Avançar" libera o seguinte.

export function createInitialProgress(journey) {
  return { completed: [...(journey.initiallyCompleted ?? [])], releasedModule: 0 }
}

export function isMissionDone(progress, missionId) {
  return progress.completed.includes(missionId)
}

export function isModuleDone(journey, progress, index) {
  const missions = journey.modules[index]?.missions ?? []
  return missions.length > 0 && missions.every((mission) => isMissionDone(progress, mission.id))
}

// Mesmos estados de child_trail_modules.status que renderModules entende.
export function moduleStatus(journey, progress, index) {
  const last = journey.modules.length - 1

  if (index < progress.releasedModule) return 'concluido'
  if (index > progress.releasedModule) return 'bloqueado'
  if (!isModuleDone(journey, progress, index)) return 'liberado'

  return index === last ? 'concluido' : 'aguardando_revisao'
}

export function isJourneyFinished(journey, progress) {
  const last = journey.modules.length - 1
  return progress.releasedModule === last && isModuleDone(journey, progress, last)
}

export function countMissions(journey) {
  return journey.modules.reduce((total, mod) => total + mod.missions.length, 0)
}

export function countCompleted(journey, progress) {
  return journey.modules.reduce(
    (total, mod) => total + mod.missions.filter((mission) => isMissionDone(progress, mission.id)).length,
    0,
  )
}
