// Harness temporário só pra visualizar as telas do mapa sem precisar de
// sessão/pareamento reais. NÃO faz parte do app — apagar depois do teste.
import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import './styles/trail.css'
import './styles/modules.css'
import { renderModules } from './screens/modules.js'
import { renderJourney } from './screens/journey.js'
import { getModuleVisual } from './config/module-visuals.js'

const modules = [
  { id: 'm1', status: 'concluido', trail_modules: { position: 1, title: 'Números de 1 a 5' } },
  { id: 'm2', status: 'concluido', trail_modules: { position: 2, title: 'Contagem até 5' } },
  { id: 'm3', status: 'liberado', trail_modules: { position: 3, title: 'Contagem até 10' } },
  { id: 'm4', status: 'bloqueado', trail_modules: { position: 4, title: 'Comparar quantidades' } },
  { id: 'm5', status: 'bloqueado', trail_modules: { position: 5, title: 'Revisão do capítulo' } },
]

const missions = [
  { status: 'concluida', mission_templates: { title: 'Contar até 5' }, child_activities: [] },
  { status: 'disponivel', mission_templates: { title: 'Identificar números de 1 a 5' }, child_activities: [{ id: 'demo' }] },
  { status: 'bloqueada', mission_templates: { title: 'Somar até 10' }, child_activities: [] },
]

const root = document.querySelector('#app')

function showModules() {
  renderModules(root, {
    childName: 'Weligtom',
    modules,
    onOpenModule(module) {
      const idx = modules.findIndex((m) => m.id === module.id)
      renderJourney(root, {
        childName: 'Weligtom',
        trail: { status: 'ativa' },
        currentModule: module,
        missions,
        moduleVisual: getModuleVisual(idx),
        onBack: showModules,
        onOpenMission: () => {},
        onRefresh: () => {},
      })
    },
  })
}

showModules()
