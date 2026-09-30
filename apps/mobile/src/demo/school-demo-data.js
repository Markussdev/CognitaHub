// Dados fabricados da demo da Cognita Escola (demo-child.js, demo-tutor.js,
// demo-family.js). O adaptador build-demo-journey.js os transforma no mesmo
// formato das linhas que services/trails.js e services/activities.js leem do
// Supabase (child_trails, child_trail_modules, child_trail_missions) — assim
// renderModules/renderJourney/renderMission (screens/) e mountActivity
// (activities/activity-runner.js) rodam sem saber que a fonte não é o banco.
// Não é lido em nenhum fluxo conectado.

export const DEMO_CHILD = {
  name: 'Mateus',
  age: 7,
  avatarKey: 'astronauta',
}

// A demo é uma vitrine, não um teste de estresse: o builder limita o tamanho.
// Não é limite do produto real.
export const DEMO_MAX_MODULES = 3
export const DEMO_MAX_MISSIONS = 4

// Cenários (landmarks) que o mediador pode escolher por módulo — chaves de
// config/module-visuals.js (trail_modules.visual_key).
export const DEMO_SCENES = ['dinossauro', 'abaco', 'cinema']

export const DEFAULT_JOURNEY_ID = 'default-journey'

// A missão "Preparada agora" da jornada inicial: em vez de uma atividade
// fixa, ela segue a atividade que o mediador prepara na aba Atividades — até
// ser concluída. Depois disso, atividades novas vão pro acervo (não reabrem a
// missão) e só chegam à criança dentro de uma jornada.
export const DEMO_SLOT_MISSION_ID = 'default-m1-2'

// Jornada inicial: ponto de partida pronto pra quem não quiser montar
// nada. É permanente — atribuir outra jornada só troca a ativa; o progresso
// de cada uma fica guardado. Só usa moldes que o app executa (contar e
// identificar).
export const DEFAULT_JOURNEY = {
  id: DEFAULT_JOURNEY_ID,
  origin: 'default',
  status: 'published',
  title: 'Discovering Numbers',
  objective: 'Strengthen number recognition and counting.',
  // Como a jornada inicial já estava em andamento quando o avaliador chegou.
  initiallyCompleted: ['default-m1-1'],
  modules: [
    {
      id: 'default-m1',
      title: 'Recognize',
      visualKey: 'dinossauro',
      missions: [
        {
          id: 'default-m1-1',
          title: 'Recognize numbers up to 3',
          config: { molde: 'identificar', maiorNumero: 3, rodadas: 3 },
        },
        { id: DEMO_SLOT_MISSION_ID, slot: true },
        {
          id: 'default-m1-3',
          title: 'Recognize numbers up to 5',
          config: { molde: 'identificar', maiorNumero: 5, rodadas: 3 },
        },
      ],
    },
    {
      id: 'default-m2',
      title: 'Count',
      visualKey: 'abaco',
      missions: [
        {
          id: 'default-m2-1',
          title: 'Counting dinosaurs',
          config: { molde: 'contar', quantidade: 4, rodadas: 3 },
        },
      ],
    },
  ],
}

// Título da missão "Preparada agora" conforme o molde que o mediador preparou.
export const DEMO_MISSION_TITLE_BY_MOLDE = {
  contar: 'Count the dinosaurs',
  identificar: 'Find the number',
}

// Experiências que o mediador pode preparar (nome e descrição do lado do adulto).
export const DEMO_MOLDES = [
  { key: 'contar', label: 'Visual counting', hint: 'The child taps each dinosaur to count.' },
  { key: 'identificar', label: 'Identify numbers', hint: 'The child taps the number requested by the activity.' },
]

export function demoMoldeLabel(molde) {
  return DEMO_MOLDES.find((item) => item.key === molde)?.label ?? molde
}

// "4 itens · 3 rodadas" — o detalhe, sem repetir o nome da experiência.
export function describeDemoDetail({ molde, quantidade, maiorNumero, rodadas }) {
  const detail = molde === 'identificar' ? `numbers up to ${maiorNumero}` : `${quantidade} items`
  return `${detail} · ${rodadas} ${rodadas === 1 ? 'round' : 'rounds'}`
}

// "Contagem visual · 4 itens · 3 rodadas" — a mesma linha no preparo, no
// Resumo, no acervo e nas jornadas.
export function describeDemoActivity(config) {
  return `${demoMoldeLabel(config.molde)} · ${describeDemoDetail(config)}`
}

// "hoje às 14:03" (mesmo formato de formatExecucaoQuando em js/pages/tutor.js);
// a demo nunca atravessa um dia.
export function formatDemoQuando(timestamp) {
  if (!timestamp) return 'just now'
  const hora = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
  return `today at ${hora}`
}

// Configuração inicial da atividade preparada — a que o mediador vê ao abrir
// o preparo e a que a criança recebe se ninguém mexer em nada. Guarda os
// parâmetros dos dois moldes pra trocar de molde não perder o valor do outro.
export const DEMO_ACTIVITY_DEFAULTS = {
  molde: 'contar',
  quantidade: 4,
  maiorNumero: 5,
  rodadas: 3,
}

// Atividades que já vêm no acervo (além das que o mediador prepara).
export const DEMO_LIBRARY_DEFAULTS = [
  { id: 'default-contar', config: { molde: 'contar', quantidade: 4, rodadas: 3 } },
  { id: 'default-identificar', config: { molde: 'identificar', maiorNumero: 5, rodadas: 3 } },
]

// Monta a atividade no formato que renderMission/mountActivity esperam
// (mesmas chaves de child_activities no banco).
export function buildDemoActivity({ molde, quantidade, maiorNumero, rodadas }, id) {
  const base = { id, child_id: 'demo-mateus', molde }

  if (molde === 'identificar') {
    return {
      ...base,
      titulo: 'Find the number',
      instrucao: "Tap the number you're asked to find.",
      config: { rodadas, maiorNumero },
    }
  }

  return {
    ...base,
    tema: 'dinossauros',
    titulo: "Let's count!",
    instrucao: 'Tap each dinosaur to count it.',
    config: { rodadas, quantidade },
  }
}

// Conteúdo fictício do painel da família (demo-family.js).
export const DEMO_FAMILY = {
  guardianName: 'Ana',
  cycle: {
    month: 3,
    months: 6,
    goal: 'Strengthen counting, quantity comparison, and simple addition.',
  },
  feedback: {
    text: 'Mateus recognized small groups with more confidence and responded better when the instruction was given in a short sentence.',
    author: 'Mariana Costa',
    initials: 'MC',
    when: '2 days ago',
    nextStep: 'Return to counting with fewer elements while keeping the dinosaur theme.',
  },
}
