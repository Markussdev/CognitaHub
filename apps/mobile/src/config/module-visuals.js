// Identidade visual das estações do Cap 1 ("Céu dos Números").
//
// O pareamento com os módulos do banco é por índice ordenado (position) —
// módulo 1 = launch, módulo 2 = abacus, e assim por diante. Quando o
// catálogo ganhar um visual_key próprio, a chave `key` daqui vira o elo;
// até lá, índice resolve sem migration.
//
// Posição/tamanho do mascote-guia são dados, não CSS por imagem — cada
// estação tem uma silhueta diferente (foguete alto, ábaco largo...), e
// isso fica aqui pra não virar regra solta espalhada pelo modules.css.

import launchImg from '../assets/space/module-launch.webp'
import abacusImg from '../assets/space/module-abacus.webp'
import observatoryImg from '../assets/space/module-observatory.webp'
import crystalLabImg from '../assets/space/module-crystal-lab.webp'
import portalImg from '../assets/space/module-number-portal.webp'

// Só "explore" existe por enquanto — "guide" e "celebrate" reaproveitam o
// mesmo arquivo até alguém gerar os outros dois poses.
import astronautExplore from '../assets/mascot/astronaut-explore.webp'

const astronautGuide = astronautExplore
const astronautCelebrate = astronautExplore

export const SPACE_CHAPTER_TITLE = 'Céu dos Números'

export const SPACE_MODULE_VISUALS = [
  {
    key: 'launch',
    title: 'Base de Lançamento',
    image: launchImg,
    accent: '#ffbf56',
    stationWidth: '350px',
    mascot: astronautGuide,
    mascotX: '5%',
    mascotY: '10%',
    mascotWidth: '88px',
    mascotFlip: false,
  },
  {
    key: 'abacus',
    title: 'Estação do Ábaco',
    image: abacusImg,
    accent: '#ee9fc9',
    stationWidth: '330px',
    mascot: astronautExplore,
    mascotX: '74%',
    mascotY: '8%',
    mascotWidth: '82px',
    mascotFlip: true,
  },
  {
    key: 'observatory',
    title: 'Observatório da Contagem',
    image: observatoryImg,
    accent: '#79cfff',
    stationWidth: '340px',
    mascot: astronautExplore,
    mascotX: '6%',
    mascotY: '12%',
    mascotWidth: '84px',
    mascotFlip: false,
  },
  {
    key: 'crystal-lab',
    title: 'Laboratório dos Cristais',
    image: crystalLabImg,
    accent: '#8dded9',
    stationWidth: '330px',
    mascot: astronautExplore,
    mascotX: '73%',
    mascotY: '9%',
    mascotWidth: '80px',
    mascotFlip: true,
  },
  {
    key: 'number-portal',
    title: 'Portal dos Números',
    image: portalImg,
    accent: '#ffd76d',
    stationWidth: '335px',
    mascot: astronautCelebrate,
    mascotX: '4%',
    mascotY: '9%',
    mascotWidth: '88px',
    mascotFlip: false,
  },
]

// Trilhas com mais módulos que assets reaproveitam a última estação em vez
// de quebrar — melhor um visual repetido que um mapa sem imagem.
export function getModuleVisual(moduleIndex) {
  return SPACE_MODULE_VISUALS[moduleIndex] ?? SPACE_MODULE_VISUALS[SPACE_MODULE_VISUALS.length - 1]
}
