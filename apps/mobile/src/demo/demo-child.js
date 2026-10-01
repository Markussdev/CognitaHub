import { renderModules } from '../screens/modules.js'
import { renderJourney } from '../screens/journey.js'
import { renderMission } from '../screens/mission.js'

import { getChildAvatar } from '../config/child-avatars.js'
import { getLandmarkPreset } from '../config/module-visuals.js'

import { completeDemoMission } from './school-demo-store.js'
import { setSchoolBack } from './school-back.js'
import { getDemoJourneyView, getDemoMissionRun } from './build-demo-journey.js'
import { DEMO_CHILD } from './school-demo-data.js'

// Mini orquestrador só pra Cognita Escola (Shipaton) — mesmas telas e o
// mesmo activity-runner do fluxo conectado, mas sem Supabase, sem
// pareamento e sem gravar nada. O que a criança vê (jornada, módulos,
// cenários, missões) é sempre derivado do estado local que o mediador
// controla (school-demo-store.js): a jornada ativa e o progresso dela.
// Ver school-license.js: o card da criança só entra aqui com
// VITE_SHIPATON_CHILD_DEMO='1' (o preparo do mediador entra sempre); o
// build normal continua indo pro app.js real.
export function renderDemoChildExperience(root, { onExit } = {}) {
  const avatar = getChildAvatar(DEMO_CHILD.avatarKey)

  // Cada tela relê o estado: nada fica copiado aqui dentro.
  function showModules() {
    const { modules } = getDemoJourneyView()

    // Voltar do Android, como no app.js: missão → jornada → módulos → quem
    // abriu a criança.
    setSchoolBack(() => onExit?.())

    renderModules(root, {
      childName: DEMO_CHILD.name,
      childAvatar: avatar.image,
      modules,

      onOpenModule(module) {
        showJourney(module.id)
      },

      // Sem tela de configurações própria na demo — volta pra quem abriu a
      // criança em vez de deixar o botão de engrenagem sem efeito.
      onOpenSettings() {
        onExit?.()
      },
    })
  }

  function showJourney(moduleId) {
    const view = getDemoJourneyView()
    const index = view.modules.findIndex((item) => item.id === moduleId)
    const module = view.modules[index]

    // Jornada concluída: renderJourney só mostra uma mensagem sem saída. No
    // carrossel os módulos aparecem concluídos e a engrenagem leva de volta.
    if (!module || view.trail.status === 'concluida') return showModules()

    setSchoolBack(showModules)

    renderJourney(root, {
      childName: DEMO_CHILD.name,
      childAvatar: avatar.image,
      trail: view.trail,
      currentModule: module,
      missions: view.missions[module.id] ?? [],
      moduleVisual: getLandmarkPreset(module.trail_modules.visual_key, index),

      onBack: showModules,

      // "Atualizar jornada" (módulo concluído, esperando o mediador): relê
      // o estado — só muda depois que o mediador avança o módulo.
      onRefresh() {
        showJourney(moduleId)
      },

      onOpenMission(missionId) {
        showMission(moduleId, missionId)
      },
    })
  }

  function showMission(moduleId, missionId) {
    const run = getDemoMissionRun(missionId)
    if (!run) return

    setSchoolBack(() => showJourney(moduleId))

    renderMission(root, {
      activity: run.activity,

      onExit() {
        showJourney(moduleId)
      },

      async onComplete({ durationSeconds }) {
        // Demo local: não grava execução nem chama createActivityExecution.
        // A conclusão vai pro estado local; a execução fica "aguardando
        // registro" pro mediador.
        completeDemoMission({
          missionId,
          config: run.config,
          isSlot: run.isSlot,
          durationSeconds,
        })

        showJourney(moduleId)
      },
    })
  }

  showModules()
}
