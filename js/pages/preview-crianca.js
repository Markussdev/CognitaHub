import '../../apps/mobile/src/styles/tokens.css'
import '../../apps/mobile/src/styles/base.css'
import '../../apps/mobile/src/styles/screens.css'
import '../../apps/mobile/src/styles/modules.css'
import '../../apps/mobile/src/styles/trail.css'

import '../../css/preview-crianca.css'

import { requireRole } from '../lib/auth.js'
import { getTutorCycles } from '../data/tutor.js'

import {
  getLatestChildTrail,
  getChildTrailModules,
  getChildTrailMissionsWithActivity,
} from '../data/trilha-formal.js'

import { renderModules } from '../../apps/mobile/src/screens/modules.js'
import { renderJourney } from '../../apps/mobile/src/screens/journey.js'
import { getLandmarkPreset } from '../../apps/mobile/src/config/module-visuals.js'
import { getChildAvatar } from '../../apps/mobile/src/config/child-avatars.js'

// Prévia real do app da criança dentro do painel do tutor — mesmos
// componentes visuais do mobile (renderModules/renderJourney/registro de
// cenários), mas alimentados por dados e autenticação do site (sessão do
// tutor via requireRole, não a sessão anônima cognita-mobile-child-auth-v1
// do app real). Nenhuma execução é gravada: onOpenMission só avisa.

const root = document.querySelector('#app')
const params = new URLSearchParams(location.search)
const cycleId = params.get('cycle_id')

let cycle
let trail
let modules = []
let modulesPageIndex = null

const session = await requireRole('tutor')

if (session) {
  await boot()
}

async function boot() {
  if (!cycleId) {
    return renderError('Não foi possível identificar o ciclo.')
  }

  const { data: cycles, error: cyclesError } = await getTutorCycles(session.user.id)

  if (cyclesError) {
    return renderError('Não foi possível carregar a criança.')
  }

  cycle = (cycles ?? []).find((item) => item.id === cycleId)

  if (!cycle) {
    return renderError('Este ciclo não pertence a você.')
  }

  const { data: childTrail, error: trailError } = await getLatestChildTrail(cycle.child_id, cycle.id)

  if (trailError || !childTrail) {
    return renderError('A jornada ainda não foi atribuída.')
  }

  trail = childTrail

  const { data: moduleRows, error: modulesError } = await getChildTrailModules(trail.id)

  if (modulesError) {
    return renderError('Não foi possível carregar os módulos.')
  }

  modules = moduleRows ?? []

  showModules()
}

function getIdentity() {
  const child = cycle.children ?? {}

  const name = child.preferred_name?.trim()
    || child.name?.trim().split(/\s+/)[0]
    || 'Explorador'

  const avatar = getChildAvatar(child.avatar_key)

  return {
    name,
    avatarSrc: avatar.image,
  }
}

function rememberPage() {
  const scroller = root.querySelector('.modules-scenes')
  if (!scroller?.clientWidth) return
  modulesPageIndex = Math.round(scroller.scrollLeft / scroller.clientWidth)
}

function showModules() {
  const identity = getIdentity()

  renderModules(root, {
    childName: identity.name,
    childAvatar: identity.avatarSrc,
    modules,
    initialPageIndex: modulesPageIndex ?? undefined,
    onOpenModule: showJourney,
    // Configurações pertencem ao aparelho da criança, não à prévia do tutor.
    onOpenSettings: () => {},
  })
}

async function showJourney(module) {
  rememberPage()

  const { data: missions, error } = await getChildTrailMissionsWithActivity(module.id)

  if (error) {
    return renderError('Não foi possível carregar as missões.')
  }

  const identity = getIdentity()
  const moduleIndex = modules.findIndex((item) => item.id === module.id)

  renderJourney(root, {
    childName: identity.name,
    childAvatar: identity.avatarSrc,
    trail,
    currentModule: module,
    missions: missions ?? [],
    moduleVisual: getLandmarkPreset(module.trail_modules?.visual_key, moduleIndex),
    onBack: showModules,
    // Primeira versão: navegação visual completa, mas nenhuma atividade é executada.
    onOpenMission: () => {
      window.alert('Esta é uma prévia visual. Nenhum progresso será alterado.')
    },
    onRefresh: boot,
  })
}

function renderError(message) {
  root.innerHTML = `
    <main class="preview-error">
      <h1>Não foi possível abrir a prévia</h1>
      <p>${message}</p>
      <a href="tutor.html?view=record&tab=plan">
        Voltar ao painel
      </a>
    </main>
  `
}
