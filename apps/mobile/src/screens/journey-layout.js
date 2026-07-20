// Geometria pura do mapa (mundo Cap 1). Sem DOM, sem Supabase — só números,
// pra dar pra testar/ajustar sem precisar do resto do app.
//
// Ordem visual: missão 0 embaixo (onde a criança começa), missões seguintes
// subindo, ábaco/observatório no topo. Índice do array = ordem cronológica
// (igual ao position do banco); y menor = mais alto na tela.

const XS = [50, 28, 72]
const NODE_GAP = 240
const TOP_PAD = 420
const BOTTOM_PAD = 320
const VIEWBOX_WIDTH = 400

export function computeLayout(missionCount) {
  const n = Math.max(missionCount, 0)
  const height = TOP_PAD + Math.max(0, n - 1) * NODE_GAP + BOTTOM_PAD

  const nodes = Array.from({ length: n }, (_, i) => ({
    x: XS[i % XS.length],
    y: height - BOTTOM_PAD - i * NODE_GAP,
  }))

  const topY = n > 0 ? nodes[n - 1].y : height - BOTTOM_PAD
  const abacusY = topY - 190
  const finalY = topY - 380
  const startPlatformY = height - 110

  return { height, nodes, abacusY, finalY, startPlatformY, viewBoxWidth: VIEWBOX_WIDTH }
}

// Curva suave entre dois nós consecutivos — mesma técnica do mapa do site
// (js/components/trilha-crianca.js): bezier cúbica passando pelo meio do Y,
// pontos de controle na própria coluna X de cada ponta.
export function segmentPath(a, b) {
  const x1 = a.x * (VIEWBOX_WIDTH / 100)
  const x2 = b.x * (VIEWBOX_WIDTH / 100)
  const midY = (a.y + b.y) / 2
  return `M${x1},${a.y} C${x1},${midY} ${x2},${midY} ${x2},${b.y}`
}
