import sharp from 'sharp'
import { mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

const CAP1 = 'Assets - Cap 1/'
const CAP1_OUT = 'apps/mobile/src/assets/cap1/'
const SPACE_OUT = 'apps/mobile/src/assets/space/'
const MASCOT_OUT = 'apps/mobile/src/assets/mascot/'

const MANIFEST = [
  // ---- Cap 1: fundo único (decoração já vem só nas bordas, centro vazio) ----
  { src: 'assets/backgro.png', out: CAP1_OUT + 'space-clean-bg.webp', width: 900 },

  { src: CAP1 + 'fundo-base.png', out: CAP1_OUT + 'space-bg.webp', width: 900 },
  { src: CAP1 + 'chãozinho.png', out: CAP1_OUT + 'space-city.webp', width: 900 },
  { src: CAP1 + 'lua.png', out: CAP1_OUT + 'space-left-moon.webp', width: 900 },
  { src: CAP1 + 'lupa.png', out: CAP1_OUT + 'space-right-observatory.webp', width: 900 },

  // ---- Cap 1: plataformas e landmarks (posicionados por x/y, trim ok) ----
  { src: CAP1 + 'chaozinho.png', out: CAP1_OUT + 'platform-wide.webp', width: 750, trim: true },
  { src: CAP1 + 'chão.png', out: CAP1_OUT + 'platform-start.webp', width: 750, trim: true },
  { src: CAP1 + 'chão-direita.png', out: CAP1_OUT + 'platform-right.webp', width: 750, trim: true },
  { src: CAP1 + 'chão-grand.png', out: CAP1_OUT + 'platform-milestone.webp', width: 850, trim: true },
  { src: CAP1 + 'chão-pequeno.png', out: CAP1_OUT + 'platform-node-a.webp', width: 400, trim: true },
  { src: CAP1 + 'chão-pequeno2.png', out: CAP1_OUT + 'platform-node-b.webp', width: 400, trim: true },
  { src: CAP1 + 'abaco.png', out: CAP1_OUT + 'landmark-abacus.webp', width: 500, trim: true },
  { src: CAP1 + 'final.png', out: CAP1_OUT + 'landmark-final.webp', width: 500, trim: true },
  { src: CAP1 + 'gato-peça.png', out: CAP1_OUT + 'mascot-map.webp', width: 260, trim: true },

  // ---- Cap 1: estações da tela de seleção de módulos (assets - space/).
  // Ordem cronológica: launch é o módulo 1 (embaixo do mapa), portal o 5. ----
  { src: 'assets - space/module-launch-base.png', out: SPACE_OUT + 'module-launch.webp', width: 600, trim: true },
  { src: 'assets - space/module-abacus-station.png', out: SPACE_OUT + 'module-abacus.webp', width: 600, trim: true },
  { src: 'assets - space/module-counting-observatory.png', out: SPACE_OUT + 'module-observatory.webp', width: 600, trim: true },
  { src: 'assets - space/module-crystal-lab.png', out: SPACE_OUT + 'module-crystal-lab.webp', width: 600, trim: true },
  { src: 'assets - space/module-number-portal.png', out: SPACE_OUT + 'module-number-portal.webp', width: 600, trim: true },

  // ---- Mascote-guia por módulo (só "explore" existe por enquanto — os
  // outros dois nomes em module-visuals.js reaproveitam esse mesmo arquivo
  // até "guide"/"celebrate" serem gerados). ----
  { src: 'assets - space/mascot-astronaut-explore.png', out: MASCOT_OUT + 'astronaut-explore.webp', width: 300, trim: true },

  // ---- Atividade "contar": dinossauros já usados em counting.js ----
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    src: `assets - Atividades/dinossauro${i === 0 ? '' : i}.png`,
    out: `apps/mobile/src/assets/activities/dinosaurs/dinossauro${i === 0 ? '' : i}.webp`,
    width: 220,
  })),

  // ---- Já embutidos no app (hoje são os PNG originais de 1254px) ----
  { src: 'assets/logo-icon-transparent.png', out: 'apps/mobile/src/assets/logo-icon-transparent.webp', width: 160, quality: 85 },
  { src: 'assets/mascot-hero-wave.png', out: 'apps/mobile/src/assets/mascot-hero-wave.webp', width: 320 },
]

async function run() {
  let totalBefore = 0
  let totalAfter = 0

  for (const { src, out, width, trim, quality = 82 } of MANIFEST) {
    await mkdir(dirname(out), { recursive: true })

    const image = sharp(src)
    if (trim) image.trim()
    image.resize({ width, withoutEnlargement: true })

    const beforeStat = await stat(src)
    await image.webp({ quality }).toFile(out)
    const afterStat = await stat(out)

    totalBefore += beforeStat.size
    totalAfter += afterStat.size

    console.log(
      `${src}  ${(beforeStat.size / 1024).toFixed(0)}KB -> ${out}  ${(afterStat.size / 1024).toFixed(0)}KB`,
    )
  }

  console.log(
    `\nTotal: ${(totalBefore / 1024 / 1024).toFixed(2)}MB -> ${(totalAfter / 1024 / 1024).toFixed(2)}MB`,
  )
}

run()
