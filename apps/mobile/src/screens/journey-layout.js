// Geometria pura do mapa (mundo Cap 1). Sem DOM, sem Supabase.
//
// Ordem visual: missão 0 embaixo (onde a criança começa), missões seguintes
// subindo, um landmark só no topo. Índice do array = ordem cronológica
// (igual ao position do banco); y menor = mais alto na tela.
//
// Espaçamento enxuto de propósito — a versão anterior dava espaço de sobra
// pra decoração pesada que não existe mais (um fundo só, sem camadas
// empilhadas), então o mapa fica mais compacto e o caminho lê mais rápido.

const XS = [50, 39, 61]
const NODE_GAP = 160
const TOP_PAD = 245
const BOTTOM_PAD = 135
const VIEWBOX_WIDTH = 400

export function computeLayout(missionCount) {
  const n = Math.max(missionCount, 0)
  const height = TOP_PAD + Math.max(0, n - 1) * NODE_GAP + BOTTOM_PAD

  const nodes = Array.from({ length: n }, (_, i) => ({
    x: XS[i % XS.length],
    y: height - BOTTOM_PAD - i * NODE_GAP,
  }))

  const topY = n > 0 ? nodes[n - 1].y : height - BOTTOM_PAD
  const landmarkY = topY - 170

  return { height, nodes, landmarkY, viewBoxWidth: VIEWBOX_WIDTH }
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
