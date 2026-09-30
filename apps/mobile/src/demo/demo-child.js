import { renderModules } from '../screens/modules.js'
import { renderJourney } from '../screens/journey.js'
import { renderMission } from '../screens/mission.js'

import { getChildAvatar } from '../config/child-avatars.js'
import { getLandmarkPreset } from '../config/module-visuals.js'

import { getSchoolDemoState, markDemoActivityCompleted } from './school-demo-store.js'

import {
  DEMO_CHILD,
  DEMO_TRAIL,
  DEMO_MODULES,
  DEMO_MISSIONS,
  DEMO_ACTIVITIES,
  DEMO_ACTIVITY_ID_BY_MOLDE,
  DEMO_MISSION_TITLE_BY_MOLDE,
  DEMO_RELEASED_MODULE_ID,
  DEMO_RELEASED_MISSION_ID,
  DEMO_RELEASED_ACTIVITY_ID,
  buildDemoActivity,
} from './school-demo-data.js'

// Marca a missão disponível como concluída e libera a seguinte com uma
// atividade do molde certo. Só mexe na cópia local das missões.
function completeCurrentMission(list) {
  const currentIndex = list.findIndex((mission) => mission.status === 'disponivel')

  if (currentIndex >= 0) {
    list[currentIndex].status = 'concluida'

    const next = list[currentIndex + 1]
    if (next) {
      next.status = 'disponivel'
      const nextActivityId = DEMO_ACTIVITY_ID_BY_MOLDE[next.mission_templates.molde]
      next.child_activities = nextActivityId ? [{ id: nextActivityId }] : []
    }
  }
}

// A missão disponível do módulo 1 é a atividade que o mediador liberou
// (school-demo-store.js): mesmo molde, mesmo título. Se a criança já concluiu
// essa atividade, entra com ela concluída e a seguinte liberada.
function buildMissions() {
  const { activity, execution } = getSchoolDemoState()
  const missions = structuredClone(DEMO_MISSIONS)
  const list = missions[DEMO_RELEASED_MODULE_ID]
  const released = list.find((mission) => mission.id === DEMO_RELEASED_MISSION_ID)

  released.mission_templates.molde = activity.molde
  released.mission_templates.title = DEMO_MISSION_TITLE_BY_MOLDE[activity.molde]

  if (execution.completed) completeCurrentMission(list)

  return missions
}

// Mini orquestrador só pra Cognita Escola (Shipaton) — mesmas telas e o
// mesmo activity-runner do fluxo conectado, mas sem Supabase, sem
// pareamento e sem gravar nada. Ver school-license.js: o card da criança só
// entra aqui com VITE_SHIPATON_CHILD_DEMO='1' (o preparo do mediador entra
// sempre); o build normal continua indo pro app.js real.
export function renderDemoChildExperience(root, { onExit } = {}) {
  const modules = structuredClone(DEMO_MODULES)
  const missions = buildMissions()

  const avatar = getChildAvatar(DEMO_CHILD.avatarKey)

  function showModules() {
    renderModules(root, {
      childName: DEMO_CHILD.name,
      childAvatar: avatar.image,
      modules,

      onOpenModule(module) {
        showJourney(module)
      },

      // Sem tela de configurações própria na demo — volta pro workspace da
      // Cognita Escola em vez de deixar o botão de engrenagem sem efeito.
      onOpenSettings() {
        onExit?.()
      },
    })
  }

  function showJourney(module) {
    const index = modules.findIndex((m) => m.id === module.id)

    renderJourney(root, {
      childName: DEMO_CHILD.name,
      childAvatar: avatar.image,
      trail: DEMO_TRAIL,
      currentModule: module,
      missions: missions[module.id] ?? [],
      moduleVisual: getLandmarkPreset(module.trail_modules.visual_key, index),

      onBack: showModules,

      onOpenMission(activityId) {
        showMission(module, activityId)
      },
    })
  }

  function showMission(module, activityId) {
    const isReleased = activityId === DEMO_RELEASED_ACTIVITY_ID
    const activity = isReleased
      ? buildDemoActivity(getSchoolDemoState().activity, DEMO_RELEASED_ACTIVITY_ID)
      : DEMO_ACTIVITIES[activityId]
    if (!activity) return

    renderMission(root, {
      activity,

      onExit() {
        showJourney(module)
      },

      async onComplete({ durationSeconds }) {
        // Demo local: não grava execução nem chama createActivityExecution.
        // Só a atividade que o mediador liberou conta pro painel da família.
        if (isReleased) markDemoActivityCompleted({ durationSeconds })

        completeCurrentMission(missions[module.id] ?? [])

        showJourney(module)
      },
    })
  }

  showModules()
}
