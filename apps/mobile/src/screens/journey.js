import logoImg from '../assets/logo-icon-transparent.png'
import { missionNodeHtml } from '../components/mission-node.js'

// Dados fixos só para validar o layout visual (etapa 1). A leitura real da
// jornada/módulos/missões via Supabase entra na etapa 4.
const DEMO_CHILD_NAME = 'Mateus'
const DEMO_MISSIONS = [
  { title: 'Missão 1', state: 'completed' },
  { title: 'Missão 2', state: 'completed' },
  { title: 'Missão 3', state: 'review' },
  { title: 'Missão 4', state: 'available' },
  { title: 'Missão 5', state: 'locked' },
]

export function renderJourney(root, { childName = DEMO_CHILD_NAME } = {}) {
  root.innerHTML = `
    <div class="screen screen--journey">
      <div class="journey-header">
        <img src="${logoImg}" alt="" />
        <h1 class="title">Jornada de ${childName}</h1>
      </div>
      <div class="journey-map">
        ${DEMO_MISSIONS.map(missionNodeHtml).join('')}
      </div>
    </div>
  `
}
