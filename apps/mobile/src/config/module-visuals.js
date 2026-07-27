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
  },
  {
    key: 'observation',
    label: 'Observatório',
    image: observationImg,
    environment: {
      period: 'night', // noite estrelada
      skyTop: '#11183f',
      skyBottom: '#6068ad',
      horizon: '#9299d4',
      celestial: 'moon',
      stars: 1,
      clouds: 0.1,
      glow: '#a384ff',
    },
    selection: { landmarkWidth: '300px', landmarkY: '55dvh' },
  },
  {
    key: 'biblio',
    label: 'Biblioteca',
    image: biblioImg,
    environment: {
      period: 'afternoon', // fim de tarde calmo
      skyTop: '#5c6f9e',
      skyBottom: '#e8b98d',
      horizon: '#f3d9b8',
      celestial: 'sun',
      stars: 0,
      clouds: 0.4,
      glow: '#ffcf8a',
    },
    selection: { landmarkWidth: '292px', landmarkY: '55dvh' },
  },
  {
    key: 'cinema',
    label: 'Cinema',
    image: cinemaImg,
    environment: {
      period: 'night',
      skyTop: '#141233',
      skyBottom: '#3c3570',
      horizon: '#6a5a9e',
      celestial: 'moon',
      stars: 1,
      clouds: 0.1,
      glow: '#ff6fae',
    },
    selection: { landmarkWidth: '292px', landmarkY: '55dvh' },
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
      celestial: 'sun',
      stars: 0,
      clouds: 0.3,
      glow: '#ffe08a',
    },
    selection: { landmarkWidth: '300px', landmarkY: '56dvh' },
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
    selection: { landmarkWidth: '278px', landmarkY: '54dvh' },
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
