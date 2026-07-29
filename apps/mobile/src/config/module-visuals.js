// Registro de landmarks (prédios-cenário) — um por tema, não por posição
// de capítulo. O tutor escolhe o tema por módulo (trail_modules.visual_key,
// coluna que já existe no banco desde a fase 5, só nunca foi usada); até
// essa ligação existir (etapa 3), resolvemos por índice de posição.
//
// `environment` é o "céu" inteiro daquele tema — quase tudo desenhado em
// CSS (gradiente, sol/lua, estrelas, nuvens, glow). Nenhum
// prédio precisa de um fundo pintado só pra ele.
//
// `ground` prolonga o cenário até o rodapé e ancora o landmark. Temas
// ainda sem terreno próprio recebem um fallback baseado no horizonte.
//
// `selection` é como o landmark aparece na seleção de módulos (grande,
// protagonista). O tamanho dele dentro da trilha (pequeno, coadjuvante)
// ainda não foi redesenhado pra esse registro novo — ver journey.js.

import abacoImg from '../assets/landmarks/abaco.png'
import baseImg from '../assets/landmarks/base.png'
import biblioImg from '../assets/landmarks/biblio.png'
import cinemaImg from '../assets/landmarks/cinema.png'
import dinossauroImg from '../assets/landmarks/dinossauro.png'
import observationImg from '../assets/landmarks/observation.png'
import parqueImg from '../assets/landmarks/parque.png'
import libraryTreesBack from '../assets/landmarks/library-trees-back.png'
import libraryPages from '../assets/landmarks/library-pages.png'
import dinoFoliageBack from '../assets/landmarks/dino-foliage-back.png'
import dinoFootprints from '../assets/landmarks/dino-footprints.png'

export const LANDMARK_PRESETS = [
  {
    key: 'base',
    label: 'Base Espacial',
    image: baseImg,
    environment: {
      period: 'dawn', // madrugada azulada
      skyTop: '#0d1b4d',
      skyBottom: '#3a4f9e',
      horizon: '#7f94d1',
      celestial: 'moon',
      stars: 0.6,
      clouds: 0,
      glow: '#7ac9ff',
    },
    ground: {
      type: 'lunar',
      top: '#a7b8df',
      bottom: '#7188bb',
      detail: '#6176ad',
      start: '67%',
      startSmall: '64%',
    },
    selection: {
      landmarkWidth: '300px',
      landmarkY: '57.6dvh',
      contactBottom: '18%',
      contactWidth: '46%',
      contactOpacity: '0.14',
    },
    // Tamanho dentro da trilha interna (pequeno, ao lado dos nós) — ~10-12%
    // maior que a primeira versão: com os nós menores e o resto mais leve,
    // o landmark ficava pequeno demais perto da qualidade da arte externa.
    journey: { landmarkWidth: '174px' },
  },
  {
    key: 'abaco',
    label: 'Escola do Ábaco',
    image: abacoImg,
    environment: {
      period: 'morning', // manhã clara
      skyTop: '#5ba3d9',
      skyBottom: '#bfe3f5',
      horizon: '#eaf6ff',
      celestial: 'sun',
      stars: 0,
      clouds: 0,
      glow: '#fff3b0',
    },
    ground: {
      type: 'schoolyard',
      top: '#91c978',
      bottom: '#5c9257',
      detail: '#e2e5e9',
      start: '67%',
      startSmall: '64%',
    },
    selection: {
      landmarkWidth: '300px',
      landmarkY: '58.6dvh',
      contactBottom: '14%',
      contactWidth: '52%',
      contactOpacity: '0.12',
    },
    journey: { landmarkWidth: '166px' },
  },
  {
    key: 'observation',
    label: 'Observatório',
    image: observationImg,
    environment: {
      period: 'night', // noite estrelada
      skyTop: '#0a0e2e',
      skyBottom: '#484d8f',
      horizon: '#7076b8',
      celestial: 'moon',
      stars: 1,
      clouds: 0.1,
      glow: '#a384ff',
    },
    ground: {
      type: 'rocky',
      top: '#454873',
      bottom: '#262a52',
      detail: '#34386a',
      start: '66%',
      startSmall: '63%',
    },
    selection: {
      landmarkWidth: '300px',
      landmarkY: '55dvh',
      contactBottom: '16%',
      contactWidth: '50%',
      contactOpacity: '0.16',
    },
    journey: { landmarkWidth: '164px' },
  },
  {
    key: 'biblio',
    label: 'Biblioteca',
    image: biblioImg,
    environment: {
      period: 'afternoon', // fim de tarde calmo, sem disco solar — o
      // aconchego vem da luz quente do gradiente, não de uma aventura
      // espacial com bola gigante no céu.
      skyTop: '#5c6f9e',
      skyBottom: '#e8b98d',
      horizon: '#f3d9b8',
      celestial: 'none',
      stars: 0,
      clouds: 0.4,
      glow: '#ffcf8a',
    },
    ground: {
      type: 'plaza',
      top: '#f0dcb8',
      bottom: '#c9a06e',
      detail: '#fbead0',
      start: '67%',
      startSmall: '64%',
    },
    selection: {
      landmarkWidth: '286px',
      landmarkY: '57.6dvh',
      contactBottom: '13%',
      contactWidth: '52%',
      contactOpacity: '0.11',
    },
    journey: { landmarkWidth: '164px' },
    // Camada de árvores distante atrás do prédio + páginas soltas
    // flutuando — só pra tirar a sensação de "planeta bege vazio". Árvores
    // menores e páginas mais perto do livro no telhado, pra apoiar a
    // composição em vez de competir com o prédio.
    scenery: [
      {
        src: libraryTreesBack,
        bottom: '25%',
        width: '84%',
        opacity: '0.72',
        className: 'module-scene__scenery--backdrop',
      },
      {
        src: libraryPages,
        top: '25%',
        right: '9%',
        width: '78px',
        opacity: '0.78',
        className: 'module-scene__scenery--float',
      },
    ],
  },
  {
    key: 'cinema',
    label: 'Cinema',
    image: cinemaImg,
    environment: {
      period: 'night', // fundo urbano noturno — sem lua rosa, a
      // personalidade vem dos holofotes de estreia (ver .module-scene--theme-cinema no CSS).
      skyTop: '#141233',
      skyBottom: '#3c3570',
      horizon: '#6a5a9e',
      celestial: 'none',
      stars: 0.4,
      clouds: 0,
      glow: '#ff6fae',
    },
    ground: {
      type: 'carpet',
      top: '#2a2440',
      bottom: '#161227',
      detail: '#c31432',
      start: '67%',
      startSmall: '64%',
    },
    selection: {
      landmarkWidth: '292px',
      landmarkY: '55dvh',
      contactBottom: '15%',
      contactWidth: '48%',
      contactOpacity: '0.16',
    },
    journey: { landmarkWidth: '170px' },
  },
  {
    key: 'dinossauro',
    label: 'Museu dos Dinossauros',
    image: dinossauroImg,
    environment: {
      period: 'day', // dia, verde e quente
      skyTop: '#4f8fd9',
      skyBottom: '#d7edb8',
      horizon: '#eef7cf',
      // O crânio já é a silhueta grande do topo — não precisa disputar
      // atenção com um sol gigante, o céu claro já comunica o dia.
      celestial: 'none',
      stars: 0,
      clouds: 0.3,
      glow: '#ffe08a',
    },
    ground: {
      type: 'wild',
      top: '#8fb56a',
      bottom: '#4f7a3d',
      detail: '#c9a066',
      start: '66%',
      startSmall: '63%',
    },
    selection: {
      landmarkWidth: '294px',
      landmarkY: '58dvh',
      contactBottom: '13%',
      contactWidth: '54%',
      contactOpacity: '0.12',
    },
    journey: { landmarkWidth: '176px' },
    // Vegetação atrás do museu + trilha de pegadas na frente — o museu
    // vira parte de um parque paleontológico, não um prédio sozinho num
    // planeta verde-claro. Folhagem mais baixa/discreta e pegadas mais
    // pra cima, começando na saída do museu, sem chegar perto do título.
    scenery: [
      {
        src: dinoFoliageBack,
        bottom: '26%',
        width: '90%',
        opacity: '0.78',
        className: 'module-scene__scenery--backdrop',
      },
      {
        src: dinoFootprints,
        bottom: '23%',
        left: '38%',
        width: '100px',
        opacity: '0.38',
        rotate: '2deg',
      },
    ],
  },
  {
    key: 'parque',
    label: 'Parque de Diversões',
    image: parqueImg,
    environment: {
      period: 'sunset',
      skyTop: '#6175ca',
      skyBottom: '#ffc58d',
      horizon: '#a5b9dc',
      celestial: 'sun',
      stars: 0,
      clouds: 0.7,
      glow: '#ffd36f',
    },
    ground: {
      type: 'carnival',
      top: '#d8c7e8',
      bottom: '#8ca8cf',
      detail: '#f4d36d',
      start: '67%',
      startSmall: '64%',
    },
    selection: {
      landmarkWidth: '286px',
      landmarkY: '58.4dvh',
      contactBottom: '13%',
      contactWidth: '60%',
      contactOpacity: '0.13',
    },
    journey: { landmarkWidth: '170px' },
  },
]

// Trilhas com mais módulos que presets reaproveitam o último em vez de
// quebrar — melhor um visual repetido que um mapa sem imagem. Quando
// visual_key existir de verdade (etapa 3), isso vira uma busca por key
// com o índice só como fallback.
export function getLandmarkPreset(moduleIndex) {
  const preset = LANDMARK_PRESETS[moduleIndex] ?? LANDMARK_PRESETS[LANDMARK_PRESETS.length - 1]

  // journey.js (etapa 4, ainda não mexida) lê `.title` — mantém como
  // alias de `.label` só pra não regredir silenciosamente o cabeçalho da
  // trilha interna enquanto essa tela não é redesenhada pro registro novo.
  return { ...preset, title: preset.label }
}
