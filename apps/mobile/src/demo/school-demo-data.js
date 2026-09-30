// Dados fabricados no mesmo formato das linhas que services/trails.js e
// services/activities.js leem do Supabase (ver child_trails, child_trail_modules,
// child_trail_missions) — assim renderModules/renderJourney/renderMission
// (screens/) e mountActivity (activities/activity-runner.js) rodam sem saber
// que a fonte não é o banco. Só existe pra demo da Cognita Escola
// (demo-child.js, demo-tutor.js, demo-family.js); não é lido em nenhum fluxo
// conectado.

export const DEMO_CHILD = {
  name: 'Mateus',
  age: 7,
  avatarKey: 'astronauta',
}

// A missão "disponível" do módulo 1 é a que o mediador libera em
// demo-tutor.js: molde, título e configuração dela vêm de school-demo-store.js
// em vez do que está escrito abaixo (ver demo-child.js).
export const DEMO_RELEASED_MODULE_ID = 'demo-module-1'
export const DEMO_RELEASED_MISSION_ID = 'demo-mission-2'
export const DEMO_RELEASED_ACTIVITY_ID = 'demo-activity-released'

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
      id: DEMO_RELEASED_MISSION_ID,
      status: 'disponivel',
      mission_templates: {
        id: 'mt-2',
        position: 2,
        title: 'Contar dinossauros',
        molde: 'contar',
        emblema: null,
      },
      child_activities: [{ id: DEMO_RELEASED_ACTIVITY_ID }],
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

// Título da missão liberada conforme o molde que o mediador escolheu.
export const DEMO_MISSION_TITLE_BY_MOLDE = {
  contar: 'Contar dinossauros',
  identificar: 'Encontrar o número',
}

// Como a família lê o molde ("uma experiência de ...").
export const DEMO_MOLDE_LABEL = {
  contar: 'contagem',
  identificar: 'identificação de números',
}

// Configuração inicial da atividade liberada — a que o mediador vê ao abrir
// o preparo e a que a criança recebe se ninguém mexer em nada. Guarda os
// parâmetros dos dois moldes pra trocar de molde não perder o valor do outro.
export const DEMO_ACTIVITY_DEFAULTS = {
  molde: 'contar',
  quantidade: 4,
  maiorNumero: 5,
  rodadas: 3,
}

// Monta a atividade no formato que renderMission/mountActivity esperam
// (mesmas chaves de child_activities no banco).
export function buildDemoActivity({ molde, quantidade, maiorNumero, rodadas }, id) {
  const base = { id, child_id: 'demo-mateus', molde }

  if (molde === 'identificar') {
    return {
      ...base,
      titulo: 'Encontre o número',
      instrucao: 'Toque no número que aparecer certo pra você.',
      config: { rodadas, maiorNumero },
    }
  }

  return {
    ...base,
    tema: 'dinossauros',
    titulo: 'Vamos contar?',
    instrucao: 'Toque em cada dinossauro para contar.',
    config: { rodadas, quantidade },
  }
}

// Atividades das missões que o mediador não mexe (hoje só a 3ª, identificar).
export const DEMO_ACTIVITIES = {
  'demo-activity-counting': buildDemoActivity(
    { ...DEMO_ACTIVITY_DEFAULTS, molde: 'contar' },
    'demo-activity-counting',
  ),
  'demo-activity-identifying': buildDemoActivity(
    { ...DEMO_ACTIVITY_DEFAULTS, molde: 'identificar' },
    'demo-activity-identifying',
  ),
}

// demo-child.js usa isto pra liberar a próxima missão com uma atividade do
// molde certo (mission_templates.molde), em vez de reaproveitar o id da
// atividade que acabou de rodar — sem isso, uma missão "identificar" abriria
// o jogo de contar por engano.
export const DEMO_ACTIVITY_ID_BY_MOLDE = {
  contar: 'demo-activity-counting',
  identificar: 'demo-activity-identifying',
}

// Conteúdo fictício do painel da família (demo-family.js).
export const DEMO_FAMILY = {
  guardianName: 'Ana',
  cycle: {
    month: 3,
    months: 6,
    goal: 'Fortalecer contagem, comparação de quantidades e pequenas somas.',
  },
  feedback: {
    text: 'Mateus reconheceu pequenos grupos com mais segurança e respondeu melhor quando a instrução veio em uma frase curta.',
    author: 'Mariana Costa',
    initials: 'MC',
    when: 'há 2 dias',
    nextStep: 'Retomar a contagem com menos elementos e manter o tema dos dinossauros.',
  },
}
