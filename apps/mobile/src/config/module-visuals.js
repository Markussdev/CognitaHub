// Identidade visual das estações do Cap 1 ("Céu dos Números").
//
// O pareamento com os módulos do banco é por índice ordenado (position) —
// módulo 1 = launch, módulo 2 = abacus, e assim por diante. Quando o
// catálogo ganhar um visual_key próprio, a chave `key` daqui vira o elo;
// até lá, índice resolve sem migration.
//
// `selection` e `journey` separam como a MESMA estação aparece em cada
// tela — protagonista na seleção de módulos, coadjuvante (landmark) dentro
// da trilha. Nunca é o mesmo tamanho nas duas.

import launchImg from '../assets/space/module-launch.webp'
import abacusImg from '../assets/space/module-abacus.webp'
import observatoryImg from '../assets/space/module-observatory.webp'
import crystalLabImg from '../assets/space/module-crystal-lab.webp'
import portalImg from '../assets/space/module-number-portal.webp'

// Só "explore" existe por enquanto — "guide" reaproveita o mesmo arquivo
// até alguém gerar uma pose de verdade apontando (a criação original pediu
// só essa, espelhada em CSS pro lado esquerdo/direito).
import astronautExplore from '../assets/mascot/astronaut-explore.webp'

const astronautGuide = astronautExplore

export const SPACE_CHAPTER_TITLE = 'Céu dos Números'

export const SPACE_MODULE_VISUALS = [
  {
    key: 'launch',
    title: 'Base de Lançamento',
    image: launchImg,
    accent: '#ffcf7a',
    mascot: astronautGuide,
    selection: { stationWidth: '300px', mascotX: '3%', mascotY: '1%', mascotWidth: '60px', mascotFlip: false },
    journey: { landmarkWidth: '118px' },
  },
  {
    key: 'abacus',
    title: 'Estação do Ábaco',
    image: abacusImg,
    accent: '#b9c8f5',
    mascot: astronautGuide,
    selection: { stationWidth: '292px', mascotX: '79%', mascotY: '1%', mascotWidth: '58px', mascotFlip: true },
    journey: { landmarkWidth: '112px' },
  },
  {
    key: 'observatory',
    title: 'Observatório da Contagem',
    image: observatoryImg,
    accent: '#6fa0d8',
    mascot: astronautGuide,
    selection: { stationWidth: '300px', mascotX: '4%', mascotY: '1%', mascotWidth: '58px', mascotFlip: false },
    journey: { landmarkWidth: '118px' },
  },
  {
    key: 'crystal-lab',
    title: 'Laboratório dos Cristais',
    image: crystalLabImg,
    accent: '#a8e0e8',
    mascot: astronautGuide,
    selection: { stationWidth: '292px', mascotX: '78%', mascotY: '1%', mascotWidth: '56px', mascotFlip: true },
    journey: { landmarkWidth: '112px' },
  },
  {
    key: 'number-portal',
    title: 'Portal dos Números',
    image: portalImg,
    accent: '#ffd76d',
    mascot: astronautGuide,
    selection: { stationWidth: '278px', mascotX: '3%', mascotY: '1%', mascotWidth: '60px', mascotFlip: false },
    journey: { landmarkWidth: '108px' },
  },
]

// Trilhas com mais módulos que assets reaproveitam a última estação em vez
// de quebrar — melhor um visual repetido que um mapa sem imagem.
export function getModuleVisual(moduleIndex) {
  return SPACE_MODULE_VISUALS[moduleIndex] ?? SPACE_MODULE_VISUALS[SPACE_MODULE_VISUALS.length - 1]
}
