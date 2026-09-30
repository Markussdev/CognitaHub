import { renderModules } from '../screens/modules.js'
import { renderJourney } from '../screens/journey.js'
import { renderMission } from '../screens/mission.js'

import { getChildAvatar } from '../config/child-avatars.js'
import { getLandmarkPreset } from '../config/module-visuals.js'

import {
  DEMO_CHILD,
  DEMO_TRAIL,
  DEMO_MODULES,
  DEMO_MISSIONS,
  DEMO_ACTIVITIES,
  DEMO_ACTIVITY_ID_BY_MOLDE,
} from './school-demo-data.js'

// Mini orquestrador só pra Cognita Escola (Shipaton) — mesmas telas e o
// mesmo activity-runner do fluxo conectado, mas sem Supabase, sem
// pareamento e sem gravar nada. Ver school-license.js: só entra aqui quando
// VITE_SHIPATON_CHILD_DEMO='1'; o build normal continua indo pro app.js real.
export function renderDemoChildExperience(root, { onExit } = {}) {
  const modules = structuredClone(DEMO_MODULES)
  const missions = structuredClone(DEMO_MISSIONS)

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
    const activity = DEMO_ACTIVITIES[activityId]
    if (!activity) return

    renderMission(root, {
      activity,

      onExit() {
        showJourney(module)
      },

      async onComplete() {
        // Demo local: não grava execução nem chama createActivityExecution.
        const list = missions[module.id] ?? []
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

        showJourney(module)
      },
    })
  }

  showModules()
}
