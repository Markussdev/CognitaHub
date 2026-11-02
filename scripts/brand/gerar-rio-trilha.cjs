// Gerar o traçado do "rio-trilha" do hero da homepage (index.html, bloco .hero-trail).
// O rio é um polígono de largura variável (larga perto, fina longe) em volta de uma linha
// central suave, calculado a partir dos pontos de controle abaixo. Também confere a geometria
// (curvatura, limites, equilíbrio entre as margens, folgas), para poder ajustar sem abrir a página.
// Uso (na raiz do projeto): node scripts/brand/gerar-rio-trilha.cjs        (só as conferências)
//                          node scripts/brand/gerar-rio-trilha.cjs --svg  (bloco <svg> para o index.html)

// Com --svg, as conferências vão para o stderr e só o bloco SVG sai no stdout.
const log = process.argv.includes('--svg') ? console.error : console.log

// 560x580 casa com a coluna direita do hero (~576px a 1440px): o SVG ocupa a largura toda dela.
const VIEW = { w: 560, h: 580 }

// Linha central do rio, de baixo (fora do quadro) para cima: nasce no canto inferior esquerdo,
// faz uma curva larga para a direita e outra para a esquerda e sobe até o planeta, no alto à
// direita. A forma orgânica é a referência ao rio, sem texto nem marca. Amplitude de ~350px
// entre as curvas para a trilha ocupar a coluna inteira.
const PONTOS = [
  [101, 650], [112, 590], [174, 524], [278, 478], [383, 452],
  [448, 414], [473, 364], [441, 314], [367, 282], [269, 258],
  [177, 236], [125, 200], [146, 146], [226, 106], [336, 86],
  [428, 72], [488, 56],
]

// Largura do rio (total) no início visível e na ponta; e a margem translúcida em volta.
const LARGURA = { perto: 36, longe: 4 }
const MARGEM = { perto: 11, longe: 3 }

// Marcos: ponto aproximado onde o disco senta (vai para o ponto mais próximo da linha
// central) e raio. Um em cada curva e um na subida inicial, alternando esquerda, direita e
// esquerda, a ~150px um do outro. Os raios diminuem com a distância (perspectiva).
const MARCOS = [
  { nome: 'identificar', alvo: [179, 522], r: 38 },
  { nome: 'contar',      alvo: [473, 364], r: 33 },
  { nome: 'revisar',     alvo: [123, 196], r: 28 },
]

// Decoração espacial (assets de trilha/espaco/): caixa no SVG. Só três, discretos: o planeta
// no fim do rio (o destino) e duas estrelas nos vazios.
const DECOR = [
  { nome: 'planeta-roxo', x: 482, y: 14, size: 46, opacidade: 0.9 },
  { nome: 'estrelas-1', x: 54, y: 64, size: 44, opacidade: 0.7 },
  { nome: 'estrelas-3', x: 470, y: 496, size: 64, opacidade: 0.6 },
]

// ---------- geometria ----------
const bez = (p0, p1, p2, p3, t) => {
  const m = 1 - t
  return [
    m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
    m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
  ]
}

function catmullRom(pts, porTrecho) {
  const P = [pts[0], ...pts, pts[pts.length - 1]]
  const out = []
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    for (let k = 0; k < porTrecho; k++) out.push(bez(p1, c1, c2, p2, k / porTrecho))
  }
  out.push(pts[pts.length - 1])
  return out
}

function reamostrar(pts, n) {
  const acum = [0]
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = acum[acum.length - 1]
  const out = []
  let j = 0
  for (let k = 0; k <= n; k++) {
    const alvo = (total * k) / n
    while (j < acum.length - 2 && acum[j + 1] < alvo) j++
    const f = (alvo - acum[j]) / (acum[j + 1] - acum[j] || 1)
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f])
  }
  return out
}

const N = 160
const centro = reamostrar(catmullRom(PONTOS, 16), N)

// u: 0 no primeiro ponto visível (y <= VIEW.h), 1 na ponta
const iVisivel = centro.findIndex((p) => p[1] <= VIEW.h)
const u = (i) => Math.max(0, (i - iVisivel) / (N - iVisivel))
const lerp = (a, b, t) => a + (b - a) * t
const suave = (t) => Math.pow(t, 0.85)

const tangente = (i) => {
  const a = centro[Math.max(0, i - 1)], b = centro[Math.min(N, i + 1)]
  const d = Math.hypot(b[0] - a[0], b[1] - a[1])
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]
}

function poligono(extra) {
  const esq = [], dir = []
  centro.forEach((c, i) => {
    const t = tangente(i), nx = -t[1], ny = t[0]
    const uu = suave(u(i))
    const h = (lerp(LARGURA.perto, LARGURA.longe, uu) + 2 * lerp(MARGEM.perto, MARGEM.longe, uu) * extra) / 2
    esq.push([c[0] + nx * h, c[1] + ny * h])
    dir.push([c[0] - nx * h, c[1] - ny * h])
  })
  return [...esq, ...dir.reverse()]
}

const f1 = (n) => (Math.round(n * 10) / 10).toString()
const caminho = (pts, fechar) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') + (fechar ? 'Z' : '')

const rio = poligono(0)
const margem = poligono(1)
const pontaY = centro[N][1]

// ---------- conferências ----------
let ok = true
const falha = (msg) => { ok = false; log('  ✗', msg) }
const passa = (msg) => log('  ✓', msg)

log('Curvatura (raio mínimo da linha central menos a meia-largura da margem):')
let minR = Infinity, minRi = 0
for (let i = 1; i < N; i++) {
  const [a, b, c] = [centro[i - 1], centro[i], centro[i + 1]]
  const A = Math.hypot(b[0] - a[0], b[1] - a[1]), B = Math.hypot(c[0] - b[0], c[1] - b[1]), C = Math.hypot(c[0] - a[0], c[1] - a[1])
  const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  const R = area2 === 0 ? Infinity : (A * B * C) / (2 * area2)
  const hm = (lerp(LARGURA.perto, LARGURA.longe, suave(u(i))) / 2) + lerp(MARGEM.perto, MARGEM.longe, suave(u(i)))
  if (R - hm < minR) { minR = R - hm; minRi = i }
}
minR > 6 ? passa(`folga mínima ${f1(minR)}px (ponto ${minRi}): o contorno não dobra`) : falha(`contorno pode dobrar (folga ${f1(minR)}px no ponto ${minRi})`)

log('Marcos:')
const marcos = MARCOS.map((m) => {
  let i = 0
  centro.forEach((p, j) => { if (Math.hypot(p[0] - m.alvo[0], p[1] - m.alvo[1]) < Math.hypot(centro[i][0] - m.alvo[0], centro[i][1] - m.alvo[1])) i = j })
  const [x, y] = centro[i]
  return { ...m, x, y, i }
})
const ANEL = 7 // anel externo do marco
marcos.forEach((m) => {
  const dentro = m.x - m.r - ANEL >= 4 && m.x + m.r + ANEL <= VIEW.w - 4 && m.y - m.r - ANEL >= 4 && m.y + m.r + ANEL <= VIEW.h - 4
  const hm = (lerp(LARGURA.perto, LARGURA.longe, suave(u(m.i))) / 2) + lerp(MARGEM.perto, MARGEM.longe, suave(u(m.i)))
  log(`  ${m.nome}: centro (${f1(m.x)}, ${f1(m.y)}) r=${m.r}; rio ali tem meia-largura ${f1(hm)}`)
  dentro ? passa('dentro do quadro') : falha('marco sai do quadro')
  m.r >= hm + 6 ? passa('o disco cobre a largura do rio') : falha('o rio aparece nas bordas do disco')
})
for (let a = 0; a < marcos.length; a++) for (let b = a + 1; b < marcos.length; b++) {
  const d = Math.hypot(marcos[a].x - marcos[b].x, marcos[a].y - marcos[b].y) - marcos[a].r - marcos[b].r - 2 * ANEL
  d >= 60 ? passa(`${marcos[a].nome} / ${marcos[b].nome}: ${f1(d)}px livres`) : falha(`${marcos[a].nome} / ${marcos[b].nome} muito próximos (${f1(d)}px)`)
}
const dy = marcos.slice(1).map((m, k) => Math.abs(marcos[k].y - m.y))
const desigual = Math.max(...dy) - Math.min(...dy)
desigual <= 40 ? passa(`espaçamento vertical parecido (${dy.map(f1).join(' e ')}px)`) : falha(`espaçamento vertical desigual (${dy.map(f1).join(' e ')}px)`)

log('Decoração (' + DECOR.length + ' elementos):')
DECOR.length <= 3 ? passa('no máximo 3') : falha('mais de 3 elementos decorativos')
DECOR.forEach((d) => {
  const cxd = d.x + d.size / 2, cyd = d.y + d.size / 2, rd = d.size * 0.32
  const dRio = Math.min(...margem.map((p) => Math.hypot(p[0] - cxd, p[1] - cyd))) - rd
  const dMarcos = Math.min(...marcos.map((m) => Math.hypot(m.x - cxd, m.y - cyd) - m.r - ANEL - rd))
  const minimoRio = d.nome === 'planeta-roxo' ? 4 : 24 // o planeta fica no fim do rio, de propósito
  log(`  ${d.nome}: ${f1(dRio)}px do rio, ${f1(dMarcos)}px dos marcos`)
  dRio >= minimoRio && dMarcos >= 24 && d.x >= 0 && d.y >= 0 && d.x + d.size <= VIEW.w && d.y + d.size <= VIEW.h ? passa('livre e dentro do quadro') : falha(`${d.nome} colide ou sai do quadro`)
})

log('Equilíbrio (caixa de tudo o que aparece):')
const visiveis = margem.filter((p) => p[1] <= VIEW.h)
const xs = [...visiveis.map((p) => p[0]), ...marcos.flatMap((m) => [m.x - m.r - ANEL, m.x + m.r + ANEL]), ...DECOR.flatMap((d) => [d.x, d.x + d.size])]
const ys = [...visiveis.map((p) => p[1]), ...marcos.flatMap((m) => [m.y - m.r - ANEL, m.y + m.r + ANEL]), ...DECOR.flatMap((d) => [d.y, d.y + d.size])]
const [esq, dir, topo, base] = [Math.min(...xs), VIEW.w - Math.max(...xs), Math.min(...ys), VIEW.h - Math.max(...ys)]
log(`  margens: esquerda ${f1(esq)}, direita ${f1(dir)}, topo ${f1(topo)}, base ${f1(base)}`)
Math.min(esq, dir, topo) >= 4 ? passa('nada sai do quadro') : falha('algo sai do quadro')
Math.abs(esq - dir) <= 40 ? passa('esquerda e direita equilibradas') : falha('desequilíbrio entre esquerda e direita')

log(ok ? '\nTudo certo.\n' : '\nHÁ PROBLEMAS: ajuste os parâmetros acima.\n')

// ---------- bloco SVG ----------
// Cores: violeta e orquídea (cards do site), dourado (--gold-on-dark). Sem texto, sem filtros.
const degrade = (id, y1, y2, paradas) =>
  `    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">\n` +
  paradas.map(([o, c, a]) => `      <stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('\n') +
  '\n    </linearGradient>'

const topoGrad = Math.floor(pontaY)

const bloco = () => [
  `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" focusable="false" aria-hidden="true">`,
  '  <defs>',
  degrade('rt-agua', VIEW.h, topoGrad, [[0, '#8e5090', 0], [0.09, '#8e5090', 0.92], [0.52, '#d487cf', 0.92], [0.86, '#ffbd49', 0.96], [1, '#ffbd49', 0.5]]),
  degrade('rt-margem', VIEW.h, topoGrad, [[0, '#b058ce', 0], [0.09, '#b058ce', 0.2], [0.52, '#d487cf', 0.18], [0.86, '#ffbd49', 0.16], [1, '#ffbd49', 0.08]]),
  degrade('rt-pontos', VIEW.h, topoGrad, [[0, '#ffe3a3', 0], [0.12, '#ffe3a3', 0.8], [0.9, '#ffe3a3', 0.8], [1, '#ffe3a3', 0.4]]),
  '    <radialGradient id="rt-creme" cx="0.5" cy="0.35" r="0.8">',
  '      <stop offset="0" stop-color="#fffefc"/>',
  '      <stop offset="1" stop-color="#f1e6f6"/>',
  '    </radialGradient>',
  '  </defs>',
  '',
  '  <!-- rio: margem translúcida, corpo e pontilhado da trilha -->',
  `  <path d="${caminho(margem, true)}" fill="url(#rt-margem)"/>`,
  `  <path d="${caminho(rio, true)}" fill="url(#rt-agua)"/>`,
  `  <path d="${caminho(centro.filter((p) => p[1] <= VIEW.h + 4), false)}" fill="none" stroke="url(#rt-pontos)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 9"/>`,
  '',
  '  <!-- espaço: três elementos discretos (o planeta fica no fim do rio) -->',
  ...DECOR.map((d) => `  <image class="rt-deco" href="/assets/trilha/espaco/${d.nome}.webp" x="${d.x}" y="${d.y}" width="${d.size}" height="${d.size}" opacity="${d.opacidade}"/>`),
  '',
  '  <!-- marcos: os emblemas da trilha da criança, em nós circulares como no mapa do produto -->',
  ...marcos.flatMap((m) => {
    const e = Math.round(m.r * 1.36)
    return [
      `  <g transform="translate(${f1(m.x)} ${f1(m.y)})">`,
      `    <circle r="${m.r + ANEL}" fill="#ffbd49" fill-opacity="0.12"/>`,
      `    <circle cy="4" r="${m.r}" fill="#0a0009" fill-opacity="0.35"/>`,
      `    <circle r="${m.r}" fill="url(#rt-creme)" stroke="#ffbd49" stroke-width="2.5"/>`,
      `    <image href="/assets/trilha/emblemas/${m.nome}.webp" x="${-e / 2}" y="${-e / 2}" width="${e}" height="${e}"/>`,
      '  </g>',
    ]
  }),
  '</svg>',
].join('\n')

if (process.argv.includes('--svg')) {
  if (!ok) process.exitCode = 1
  console.log(bloco())
} else {
  log('Use --svg para imprimir o bloco <svg> pronto para o index.html.')
}
