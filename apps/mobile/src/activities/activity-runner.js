import { mountCounting } from './counting.js'

const ACTIVITY_TYPES = {
  contar: mountCounting,
}

// null quando o molde não existe neste app — quem chama mostra o aviso
// de "atividade ainda não disponível", nunca um palco vazio.
export function mountActivity(activity, { stageEl, onSuccess }) {
  const mount = ACTIVITY_TYPES[activity.molde]
  if (!mount) return null

  return mount(stageEl, { tema: activity.tema, config: activity.config, onSuccess }) ?? true
}
