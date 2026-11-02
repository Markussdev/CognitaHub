// Aparar as margens transparentes dos PNGs da marca e gerar versões leves para a web.
// Os originais em public/assets/brand/ não são alterados.
// Uso (na raiz do projeto): node scripts/brand/aparar-marcas.cjs
const path = require('path')
const sharp = require('sharp')

const DIR = path.join(__dirname, '..', '..', 'public', 'assets', 'brand')
const RUIDO = 12   // alfa abaixo disso é resíduo da remoção de fundo (invisível, mas infla o recorte)
const MARGEM = 6   // px de respiro ao redor do conteúdo, antes de redimensionar

const JOBS = [
  { src: 'cognita-logo-horizontal.png', out: 'cognita-logo-horizontal-trim.png', width: 720 },
  { src: 'cforce-emblema.png', out: 'cforce-emblema-trim.png', height: 288 },
]

async function aparar({ src, out, width, height }) {
  const { data, info } = await sharp(path.join(DIR, src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3
      if (data[i] < RUIDO) { data[i] = 0; continue }
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const left = Math.max(0, minX - MARGEM)
  const top = Math.max(0, minY - MARGEM)
  const box = { left, top, width: Math.min(w, maxX + MARGEM + 1) - left, height: Math.min(h, maxY + MARGEM + 1) - top }
  const file = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract(box)
    .resize({ width, height, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(DIR, out))
  console.log(`${out}: ${file.width}x${file.height}, ${(file.size / 1024).toFixed(0)} KB (recorte ${box.width}x${box.height} de ${w}x${h})`)
}

;(async () => { for (const job of JOBS) await aparar(job) })()
