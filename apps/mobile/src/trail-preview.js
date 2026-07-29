// Harness temporário só pra visualizar as telas do mapa sem precisar de
// sessão/pareamento reais. NÃO faz parte do app — apagar depois do teste.
//
// Reproduz o mesmo controle de tela/página do app.js real (showModules /
// showJourney / showSettings / rememberModulesPage) com dados falsos no
// lugar do Supabase, pra testar a restauração de página de verdade.
import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import './styles/trail.css'
import './styles/modules.css'
import './styles/settings.css'
import { renderModules } from './screens/modules.js'
import { renderJourney } from './screens/journey.js'
import { renderSettings } from './screens/settings.js'
import { renderProfileSettings } from './screens/profile-settings.js'
import { renderExperienceSettings } from './screens/experience-settings.js'
import { getLandmarkPreset } from './config/module-visuals.js'
import { getChildAvatar } from './config/child-avatars.js'

const modules = [
  { id: 'm1', status: 'concluido', trail_modules: { position: 1, title: 'Números de 1 a 5' } },
  { id: 'm2', status: 'concluido', trail_modules: { position: 2, title: 'Contagem até 5' } },
  { id: 'm3', status: 'liberado', trail_modules: { position: 3, title: 'Contagem até 10' } },
  { id: 'm4', status: 'bloqueado', trail_modules: { position: 4, title: 'Comparar quantidades' } },
  { id: 'm5', status: 'bloqueado', trail_modules: { position: 5, title: 'Leitura e livros' } },
  { id: 'm6', status: 'bloqueado', trail_modules: { position: 6, title: 'Dinossauros gigantes' } },
  { id: 'm7', status: 'bloqueado', trail_modules: { position: 7, title: 'Revisão do capítulo' } },
]

const missions = [
  { status: 'concluida', mission_templates: { title: 'Contar até 5' }, child_activities: [] },
  { status: 'disponivel', mission_templates: { title: 'Identificar números de 1 a 5' }, child_activities: [{ id: 'demo' }] },
  { status: 'bloqueada', mission_templates: { title: 'Somar até 10' }, child_activities: [] },
]

const root = document.querySelector('#app')
const appState = { modulesPageIndex: null, avatarKey: null }

function getIdentity() {
  const avatar = getChildAvatar(appState.avatarKey)
  return { name: 'Weligtom', avatarKey: avatar.key, avatarSrc: avatar.image }
}

function rememberModulesPage() {
  const scroller = root.querySelector('.modules-scenes')
  if (!scroller || !scroller.clientWidth) return
  appState.modulesPageIndex = Math.round(scroller.scrollLeft / scroller.clientWidth)
}

function showModules() {
  const identity = getIdentity()
  renderModules(root, {
    childName: identity.name,
    childAvatar: identity.avatarSrc,
    modules,
    initialPageIndex: appState.modulesPageIndex ?? undefined,
    onOpenModule: showJourney,
    onOpenSettings: showSettings,
  })
}

function showJourney(module) {
  rememberModulesPage()
  const idx = modules.findIndex((m) => m.id === module.id)
  const identity = getIdentity()
  renderJourney(root, {
    childName: identity.name,
    childAvatar: identity.avatarSrc,
    trail: { status: 'ativa' },
    currentModule: module,
    missions,
    moduleVisual: getLandmarkPreset(idx),
    onBack: showModules,
    onOpenMission: () => {},
    onRefresh: () => {},
  })
}

function showSettings() {
  rememberModulesPage()
  renderSettings(root, {
    onBack: showModules,
    onOpenProfile: showProfileSettings,
    onOpenExperience: showExperienceSettings,
  })
}

function showProfileSettings() {
  const identity = getIdentity()
  renderProfileSettings(root, {
    childId: 'preview-child-id',
    currentName: identity.name,
    currentAvatarKey: identity.avatarKey,
    onBack: showSettings,
    onSaved: ({ avatarKey }) => {
      appState.avatarKey = avatarKey
      showSettings()
    },
  })
}

function showExperienceSettings() {
  renderExperienceSettings(root, { onBack: showSettings })
}

showModules()
