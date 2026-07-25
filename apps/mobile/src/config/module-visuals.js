// Identidade visual das estações do Cap 1 ("Céu dos Números").
//
// O pareamento com os módulos do banco é por índice ordenado (position) —
// módulo 1 = launch, módulo 2 = abacus, e assim por diante. Quando o
// catálogo ganhar um visual_key próprio, a chave `key` daqui vira o elo;
// até lá, índice resolve sem migration.

import launchImg from '../assets/space/module-launch.webp'
import abacusImg from '../assets/space/module-abacus.webp'
import observatoryImg from '../assets/space/module-observatory.webp'
import crystalLabImg from '../assets/space/module-crystal-lab.webp'
import portalImg from '../assets/space/module-number-portal.webp'

export const SPACE_CHAPTER_TITLE = 'Céu dos Números'

export const SPACE_MODULE_VISUALS = [
  {
    key: 'launch',
    title: 'Base de Lançamento',
    image: launchImg,
    accent: '#ffbf56',
  },
  {
    key: 'abacus',
    title: 'Estação do Ábaco',
    image: abacusImg,
    accent: '#ee9fc9',
  },
  {
    key: 'observatory',
    title: 'Observatório da Contagem',
    image: observatoryImg,
    accent: '#79cfff',
  },
  {
    key: 'crystal-lab',
    title: 'Laboratório dos Cristais',
    image: crystalLabImg,
    accent: '#8dded9',
  },
  {
    key: 'number-portal',
    title: 'Portal dos Números',
    image: portalImg,
    accent: '#ffd76d',
  },
]

// Trilhas com mais módulos que assets reaproveitam a última estação em vez
// de quebrar — melhor um visual repetido que um mapa sem imagem.
export function getModuleVisual(moduleIndex) {
  return SPACE_MODULE_VISUALS[moduleIndex] ?? SPACE_MODULE_VISUALS[SPACE_MODULE_VISUALS.length - 1]
}
