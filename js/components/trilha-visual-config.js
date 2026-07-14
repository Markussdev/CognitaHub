// Config visual compartilhada entre o mapa do tutor (trilha-plano.js) e o
// mapa da criança (trilha-crianca.js). Extraído de trilha-plano.js de
// propósito: aquele arquivo importa STATUS_ETAPA de
// js/data/planos-registro.js (o currículo hardcoded antigo) pro mapa do
// tutor — se trilha-crianca.js importasse essas constantes dali, o bundle
// do app infantil carregaria PLANOS_REGISTRO transitivamente, mesmo sem
// usar nenhum dado dele. Vivendo aqui, nenhum dos dois mapas puxa o outro.

export const NODE_POSICOES = [
  { x: 50, y: 8 },
  { x: 68, y: 27 },
  { x: 32, y: 46 },
  { x: 68, y: 64 },
  { x: 50, y: 80 },
]

// 4 segmentos (não um path único) pra poder colorir cada trecho por estado
// — concluído / atual / futuro — em vez de um caminho de cor única.
export const SEGMENTOS_D = [
  'M200,80 C100,170 320,220 272,290',
  'M272,290 C220,380 60,420 128,500',
  'M128,500 C200,580 340,640 272,710',
  'M272,710 C220,800 120,860 200,920',
]

// Decoração espacial — composição hierárquica, não 9 stickers uniformes:
// 1 planeta grande cortado no topo, elementos médios/pequenos no meio,
// 1 planeta médio-grande cortado perto do fim.
export const DECORACAO_ESPACIAL = [
  { src: 'planeta-roxo', x: '-10%', y: '-5%', size: 210, opacity: 0.3 },
  { src: 'estrelas-2', x: '80%', y: '10%', size: 34, opacity: 0.55 },
  { src: 'lua', x: '88%', y: '34%', size: 58, opacity: 0.4 },
  { src: 'cometa', x: '2%', y: '42%', size: 74, opacity: 0.4 },
  { src: 'estrelas-3', x: '8%', y: '62%', size: 30, opacity: 0.5 },
  { src: 'planeta-amarelo', x: '82%', y: '88%', size: 170, opacity: 0.35 },
]
