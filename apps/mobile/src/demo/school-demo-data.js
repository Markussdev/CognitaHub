// Dados fabricados no mesmo formato das linhas que services/trails.js e
// services/activities.js leem do Supabase (ver child_trails, child_trail_modules,
// child_trail_missions) — assim renderModules/renderJourney/renderMission
// (screens/) e mountActivity (activities/activity-runner.js) rodam sem saber
// que a fonte não é o banco. Só existe pra demo-child.js; não é lido em
// nenhum fluxo conectado.

export const DEMO_CHILD = {
  name: 'Mateus',
  avatarKey: 'astronauta',
}

export const DEMO_TRAIL = {
  id: 'demo-trail',
  status: 'ativa',
  trail_templates: {
    title: 'Descobrindo os números',
    description: 'Experiência demonstrativa',
  },
}

export const DEMO_MODULES = [
  {
    id: 'demo-module-1',
    status: 'liberado',
    trail_modules: {
      id: 'demo-template-1',
      position: 1,
      title: 'Reconhecer',
      objective: 'Reconhecer números e quantidades',
      visual_key: 'dinossauro',
    },
  },
  {
    id: 'demo-module-2',
    status: 'bloqueado',
    trail_modules: {
      id: 'demo-template-2',
      position: 2,
      title: 'Contar',
      objective: 'Contar pequenos grupos',
      visual_key: 'abaco',
    },
  },
]

export const DEMO_MISSIONS = {
  'demo-module-1': [
    {
      id: 'demo-mission-1',
      status: 'concluida',
      mission_templates: {
        id: 'mt-1',
        position: 1,
        title: 'Reconhecer números até 3',
        molde: 'identificar',
        emblema: null,
      },
      child_activities: [],
    },
    {
      id: 'demo-mission-2',
      status: 'disponivel',
      mission_templates: {
        id: 'mt-2',
        position: 2,
        title: 'Contar dinossauros',
        molde: 'contar',
        emblema: null,
      },
      child_activities: [{ id: 'demo-activity-counting' }],
    },
    {
      id: 'demo-mission-3',
      status: 'bloqueada',
      mission_templates: {
        id: 'mt-3',
        position: 3,
        title: 'Encontrar a quantidade',
        molde: 'identificar',
        emblema: null,
      },
      child_activities: [],
    },
  ],
}

export const DEMO_ACTIVITIES = {
  'demo-activity-counting': {
    id: 'demo-activity-counting',
    child_id: 'demo-mateus',
    molde: 'contar',
    tema: 'dinossauros',
    titulo: 'Vamos contar?',
    instrucao: 'Conte os dinossauros e escolha a quantidade correta.',
    config: {
      rodadas: 3,
      quantidade: 4,
    },
  },
  'demo-activity-identifying': {
    id: 'demo-activity-identifying',
    child_id: 'demo-mateus',
    molde: 'identificar',
    titulo: 'Encontre o número',
    instrucao: 'Toque no número que aparecer certo pra você.',
    config: {
      rodadas: 3,
      maiorNumero: 5,
    },
  },
}

// demo-child.js usa isto pra liberar a próxima missão com uma atividade do
// molde certo (mission_templates.molde), em vez de reaproveitar o id da
// atividade que acabou de rodar — sem isso, uma missão "identificar" abriria
// o jogo de contar por engano.
export const DEMO_ACTIVITY_ID_BY_MOLDE = {
  contar: 'demo-activity-counting',
  identificar: 'demo-activity-identifying',
}
