import { getSchoolDemoState, getActiveJourney, getDemoJourney, getJourneyProgress } from './school-demo-store.js'
import { DEMO_MISSION_TITLE_BY_MOLDE, buildDemoActivity } from './school-demo-data.js'
import {
  createInitialProgress,
  countCompleted,
  countMissions,
  isJourneyFinished,
  isMissionDone,
  moduleStatus,
} from './journey-logic.js'

// O que a missão executa: a configuração da atividade e o título que a
// criança vê. A missão "Preparada agora" (slot) segue a atividade que o
// mediador preparou; as demais são cópias fixas feitas quando entraram na
// jornada (na web também: o snapshot é copiado ao salvar).
export function resolveMissionActivity(mission) {
  if (mission.slot) {
    const { activity } = getSchoolDemoState()
    return { config: activity, title: DEMO_MISSION_TITLE_BY_MOLDE[activity.molde], isSlot: true }
  }

  return { config: mission.config, title: mission.title, isSlot: false }
}

// Visão de uma jornada no formato que renderModules/renderJourney esperam
// (linhas de child_trails / child_trail_modules / child_trail_missions),
// mais um resumo pro Resumo do mediador e pro painel da família. Um só lugar
// deriva tudo isso do store: criança, mediador e família nunca discordam.
export function getDemoJourneyView(journeyId) {
  const journey = journeyId ? getDemoJourney(journeyId) : getActiveJourney()
  const progress = getJourneyProgress(journey.id) ?? createInitialProgress(journey)
  const finished = isJourneyFinished(journey, progress)

  const modules = journey.modules.map((mod, index) => ({
    id: mod.id,
    status: moduleStatus(journey, progress, index),
    trail_modules: {
      id: `${mod.id}-template`,
      position: index + 1,
      title: mod.title,
      objective: mod.objective ?? '',
      visual_key: mod.visualKey,
    },
  }))

  const missions = {}

  journey.modules.forEach((mod, moduleIndex) => {
    const firstOpen = mod.missions.findIndex((mission) => !isMissionDone(progress, mission.id))

    missions[mod.id] = mod.missions.map((mission, missionIndex) => {
      let status = 'bloqueada'

      if (isMissionDone(progress, mission.id)) status = 'concluida'
      else if (moduleIndex === progress.releasedModule && missionIndex === firstOpen) status = 'disponivel'

      const { config, title } = resolveMissionActivity(mission)

      return {
        id: mission.id,
        status,
        mission_templates: {
          id: `${mission.id}-template`,
          position: missionIndex + 1,
          title,
          molde: config.molde,
          emblema: null,
        },
        child_activities: status === 'disponivel' ? [{ id: mission.id }] : [],
      }
    })
  })

  const releasedModule = journey.modules[progress.releasedModule]
  const releasedStatus = moduleStatus(journey, progress, progress.releasedModule)

  return {
    trail: {
      id: journey.id,
      status: finished ? 'concluida' : 'ativa',
      trail_templates: { title: journey.title, description: journey.objective ?? '' },
    },
    modules,
    missions,
    summary: {
      journeyId: journey.id,
      title: journey.title,
      origin: journey.origin,
      moduleCount: journey.modules.length,
      missionCount: countMissions(journey),
      completedCount: countCompleted(journey, progress),
      started: Boolean(getJourneyProgress(journey.id)),
      finished,
      // Módulo que o mediador liberou pra criança e em que pé ele está:
      // 'liberado' | 'aguardando_revisao' | 'concluido'.
      releasedIndex: progress.releasedModule,
      releasedModule: { id: releasedModule.id, position: progress.releasedModule + 1, title: releasedModule.title },
      releasedStatus,
      nextModuleTitle: journey.modules[progress.releasedModule + 1]?.title ?? null,
    },
  }
}

// Tudo que a criança precisa pra jogar uma missão da jornada ativa.
export function getDemoMissionRun(missionId) {
  const journey = getActiveJourney()

  for (const mod of journey.modules) {
    const mission = mod.missions.find((item) => item.id === missionId)
    if (!mission) continue

    const { config, isSlot } = resolveMissionActivity(mission)
    return { moduleId: mod.id, isSlot, config, activity: buildDemoActivity(config, mission.id) }
  }

  return null
}
