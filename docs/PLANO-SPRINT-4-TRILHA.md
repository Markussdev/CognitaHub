# Sprint 4 — Trilha "Constelação dos Primeiros Números" (painel do tutor)

> **Pasta:** `docs/`
> **Depende de:** Sprint 1 (corrente E2E), Sprint 2 (casca), Sprint 3 (molde `identificar`)
> **Toca em:** `js/pages/tutor.js` (só o `buildPlanPanel`), arquivos NOVOS listados abaixo
> **NÃO toca em:** Supabase, RLS, `sessions`, `child_activities`, `atividade_execucao`, Modo Criança
> **Status:** implementado em 2026-07-11 (ver `docs/V2-DIRECAO.md` §15) — uma fase por commit

---

## 0. Decisões desta sprint (cravadas)

1. **Superfície: painel do TUTOR.** O mapa da criança no Modo Criança é a
   próxima sprint. Esta entrega transforma a aba Plano em trilha visual.
2. **Sem cadeados.** A trilha orienta o tutor, não manda nele. Todos os nós
   são clicáveis; o destaque diferencia, não bloqueia.
3. **Status continua por inferência** (`etapaBateComAtividade` +
   `computeStatusEtapas`). Formalizar `plano_etapa` na tabela fica registrado
   em Pendências — não muda Supabase hoje.
4. **Caminho fixo para 5 etapas.** SVG desenhado à mão, posições em CSS.
   Algoritmo dinâmico só quando existir plano de tamanho variável.
5. **Estética:** "espacial calmo" — decoração estática, baixa saturação,
   `prefers-reduced-motion` zera microinterações. Âmbar só como preenchimento,
   nunca como cor de texto.

---

## 1. Arquitetura de arquivos

```
js/data/planos-registro.js      → NOVO: dado pedagógico (PRIMEIROS_NUMEROS sai do tutor.js)
js/components/trilha-plano.js   → NOVO: componente visual puro (recebe dados, devolve DOM)
css/trilha-plano.css            → NOVO: só mapa/nós/caminho/painel da etapa
assets/trilha/mascote/*.webp    → NOVO: poses redimensionadas (ver §5)
```

`tutor.js` continua dono de: buscar status (`computeStatusEtapas`), estado do
ciclo (`podePreparar`/mensagens de bloqueio) e a ponte `prefillFromPlano`.
Ele passa tudo pro componente e não desenha mais nada da trilha.

### 1.1 `js/data/planos-registro.js`

```js
export const PLANOS_REGISTRO = {
  primeiros_numeros: {
    id: 'primeiros_numeros',
    titulo: 'Primeiros Números',
    descricao: 'Sequência guiada para reconhecimento e contagem dos números iniciais.',
    etapas: [
      {
        id: 'identificar-1-5',
        titulo: 'Identificar números de 1 a 5',
        resumo: 'Identificar 1–5',
        objetivo: 'Reconhecer e apontar números de 1 a 5.',
        molde: 'identificar',
        tema: 'numeros',
        emblema: 'identificar',
        config: { maiorNumero: 5, opcoes: 4, nivel: 1, rodadas: 3 },
        instrucao: 'Toque no número que eu disser.',
      },
      // ... as outras 4 etapas, copiadas 1:1 do PRIMEIROS_NUMEROS atual,
      // cada uma ganhando id, resumo e emblema ('contar' | 'identificar' | 'revisar')
    ],
  },
}
```

Migração: `PRIMEIROS_NUMEROS`, `STATUS_ETAPA`, `etapaBateComAtividade` e
`computeStatusEtapas` saem do `tutor.js`. Os dois últimos podem morar em
`planos-registro.js` também (são sobre o dado, não sobre a tela).
`computeStatusEtapas` passa a receber o plano como argumento.

### 1.2 `js/components/trilha-plano.js`

```js
// Componente puro: não importa supabase, não conhece ciclo, não navega.
export function renderTrilhaPlano({
  plano,            // objeto de PLANOS_REGISTRO
  statuses,         // ['concluida','em_andamento','a_fazer',...] ou null
  podePreparar,     // bool — esconde/mostra o CTA no painel da etapa
  onPrepararEtapa,  // (etapa) => void  → chama prefillFromPlano
}) => HTMLElement
```

Internas: `renderHeader()` (título, "X de Y etapas", barra de progresso
discreta), `renderTrailPath()` (o SVG), `renderTrailNode(etapa, status, i)`,
`renderStepDetails(etapa, status)` (painel lateral / folha inferior).

Estado interno único: `etapaSelecionadaId`. Clicar num nó seleciona; a etapa
`em_andamento` já nasce selecionada.

### 1.3 Fluxo (inalterado na essência)

```
buildPlanPanel
  → computeStatusEtapas(plano, childId, cycleId)
  → renderTrilhaPlano({...})
  → clique no nó → renderStepDetails
  → "Preparar atividade" → onPrepararEtapa(etapa) → prefillFromPlano (já existe)
```

---

## 2. O caminho (SVG fixo, 5 nós)

SVG absoluto atrás dos nós, `aria-hidden="true"`:

```html
<svg class="trail-path" viewBox="0 0 400 800" preserveAspectRatio="none" aria-hidden="true">
  <path d="M200 60 C90 150 310 230 200 320
           C90 410 310 490 200 580
           C110 650 200 720 200 770"
        fill="none"
        stroke="var(--trail-path, #d8cfe8)"
        stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="1 16"/>
</svg>
```

Nós posicionados por CSS custom property (alternância esquerda/direita):

```css
.trail-step { position: absolute; left: var(--trail-x); top: var(--trail-y); transform: translate(-50%, -50%); }
.trail-step:nth-child(1) { --trail-x: 50%; --trail-y: 8%;  }
.trail-step:nth-child(2) { --trail-x: 67%; --trail-y: 28%; }
.trail-step:nth-child(3) { --trail-x: 34%; --trail-y: 48%; }
.trail-step:nth-child(4) { --trail-x: 66%; --trail-y: 68%; }
.trail-step:nth-child(5) { --trail-x: 50%; --trail-y: 90%; }
```

Contêiner do mapa com `aspect-ratio: 400 / 800` (mobile) e altura fixa
`~640px` no desktop, pra o `preserveAspectRatio="none"` esticar o path junto
com os nós.

**Acessibilidade:** o mapa visual é decorativo por trás de botões reais.
Cada nó é um `<button>` com `aria-label` = "Etapa N: {titulo} — {status}".
Ordem no DOM = ordem pedagógica (1–5), então teclado navega na sequência
certa independente do zigue-zague visual.

---

## 3. Estados dos nós

| Estado | Visual | Interação |
|---|---|---|
| `concluida` | círculo preenchido (lavanda suave), check branco, opacidade levemente reduzida | clicável → detalhes (histórico) |
| `em_andamento` | anel âmbar `#ffa800` (fill/borda, nunca texto), leve glow **estático**, mascote-guia encostado no nó, badge "Em andamento" | clicável → detalhes já abertos por padrão, CTA primário |
| `a_fazer` | fundo card `#fffefc`, borda roxa fina, emblema da etapa no centro | clicável → detalhes + CTA ghost |

Nó: 72×72 px no desktop, mínimo 64×64 no mobile (alvo de toque). Emblema SVG
de ~32px centralizado; no estado `concluida` o emblema dá lugar ao check.

### 3.1 Painel da etapa (`renderStepDetails`)

Desktop: coluna direita fixa. Mobile: card abaixo do mapa (sem overlay novo —
reusa o padrão de card existente; folha inferior só se já existir componente
de sheet no hub adulto, senão não inventar).

Conteúdo: título da etapa, badge de status, objetivo, resumo da configuração
("Identificar · Números — 5 opções · 3 rodadas"), e o botão
**"Preparar atividade"** (primário se `em_andamento`, ghost nos demais;
escondido quando `podePreparar === false`, mantendo as mensagens de bloqueio
por estado de ciclo que já existem hoje).

---

## 4. Layout

**Desktop (duas colunas):**

```
┌──────────────────────────────────────────────────┐
│ Primeiros Números                        2/5     │
│ Sequência guiada para reconhecimento e contagem   │
├───────────────────────────────┬────────────────────┤
│                               │ Etapa selecionada  │
│      mapa (zigzag)            │ objetivo           │
│   decoração nas laterais      │ configuração       │
│                               │ [Preparar ativid.] │
└───────────────────────────────┴────────────────────┘
```

**Mobile (uma coluna):** cabeçalho → mapa vertical → card da etapa. Nunca
trilha horizontal.

---

## 5. Assets — mapeamento real (auditado no repo em 2026-07-11)

### 5.1 Mascote (PNGs existentes, todos RGBA)

| Pose | Arquivo de origem | Uso na trilha |
|---|---|---|
| **Planejar** (olhando mapa c/ prancheta) | `gat-map.png` | Cabeçalho do plano, ao lado do título |
| **Guia** (apresentando c/ pata aberta) | `mascot-hero-wave.png` | Encostado no nó `em_andamento` |
| **Comemorar** (substituto: acenando feliz) | `sticker.png` | Painel da etapa quando `concluida` |

Fora da trilha (fundo embutido): `cat-astronauta`, `cat-cientista`,
`cat-mago`, `cat-pintor`. Não usar flutuando sobre o mapa.

### 5.2 Preparo (1254px → 480px webp, exibição 96–240px)

```bash
npm i -D sharp
node -e "
const sharp=require('sharp');
const m={'gat-map.png':'planejar','mascot-hero-wave.png':'guia','sticker.png':'comemorar'};
for(const [src,out] of Object.entries(m))
  sharp('assets/'+src).resize(480,480,{fit:'inside'})
    .webp({quality:82}).toFile('assets/trilha/mascote/'+out+'.webp');
"
```

(criar `assets/trilha/mascote/` antes; commitar os webp, manter os PNG
originais como fonte)

### 5.3 Emblemas e decoração espacial

Marcus forneceu emblemas ilustrados prontos em `assets - emblemas/`
(`counter.png` → identificar, `dinossaur.png` → contar, `star.png` →
revisar) e decoração espacial em `assets - space/` (planetas, lua, cometa,
órbita, aglomerados de estrelas — nomes de arquivo nem sempre bateram com o
conteúdo real, ex.: `comet.png` é visualmente uma lua/asteroide e
`cometa.png` é o cometa de verdade; mapeamento final feito por inspeção
visual, documentado em `docs/V2-DIRECAO.md` §15). Todos processados via
`sharp` pra `assets/trilha/{emblemas,espaco}/*.webp`.

Regras: nunca texto dentro de imagem; fundo do mapa continua CSS
(gradiente suave sobre o canvas `#f7f4ee`), nada de PNG de fundo. Decoração
é `aria-hidden` + `pointer-events: none`, opacidade moderada, **zero
animação** (isso é Fase D, sob `prefers-reduced-motion`).

---

## 6. `css/trilha-plano.css` — escopo

Só: `.trail-*` (mapa, path, nós, estados, decoração, mascote) e
`.trail-details` (painel da etapa) + media queries. Tokens de cor entram como
`--trail-*` no topo do próprio arquivo, derivando dos tokens globais quando
existirem. Nada entra em `internal.css`. Importar o CSS só em `tutor.html`.

---

## 7. Ordem de implementação (uma fase = um commit)

**Fase A — Wireframe funcional** *(sem asset novo)*
- criar `planos-registro.js` e migrar dado + status pra fora do `tutor.js`
- criar `trilha-plano.js`: header, path SVG, 5 nós com estados, seleção,
  painel da etapa, CTA ligado ao `prefillFromPlano`
- `buildPlanPanel` vira orquestrador fino
- critério: aba Plano funciona igual ou melhor que hoje, já em formato mapa

**Fase B — Responsividade**
- desktop 2 colunas / mobile 1 coluna, nós ≥64px, textos sem sobreposição,
  path esticando junto, teclado na ordem 1–5

**Fase C — Assets**
- rodar o script §5.2, mascotes nas posições, emblemas nos nós,
  decoração espacial nas laterais

**Fase D — Microinterações** *(todas dentro de `@media (prefers-reduced-motion: no-preference)`)*
- hover sobe 2px no nó, anel de seleção, check com fade curto,
  entrada suave do mascote

**Fase E — QA**
- status com os dados reais do Mateus (2 sessões existentes devem pintar
  etapas como concluídas/em andamento coerentes)
- CTA das 5 etapas pré-preenchendo certo (conferir molde/tema/config no form)
- desktop + mobile, teclado, contraste, zero erro de console
- regressão da corrente E2E: preparar → fazer → salvar → registrar → acompanhar

---

## 8. Definition of Done

- [x] 5 etapas como caminho visual em zigue-zague
- [x] `concluida` / `em_andamento` / `a_fazer` distinguíveis sem depender só de cor
- [x] Nenhuma etapa bloqueada artificialmente
- [x] Clicar num nó mostra objetivo + configuração
- [x] "Preparar atividade" pré-preenche o form (ponte intacta)
- [x] Status vem de dado real (mesma inferência de hoje)
- [x] Mascote-guia marca a etapa atual; planejar no cabeçalho
- [x] Desktop e mobile ok; toque ≥64px; teclado na ordem pedagógica
- [x] `prefers-reduced-motion` zera tudo da Fase D
- [x] `tutor.js` ficou MENOR (dado e visual saíram dele)
- [x] Corrente E2E sem regressão

---

## 9. Pendências para lapidar (registrar, não fazer agora)

- **`plano_etapa` formal em `child_activities`**: a inferência quebra se o
  tutor editar o número-chave da config. Migração pequena, entra quando o
  mapa da criança precisar de status confiável.
- **Pose "comemorando" de verdade** (braços pra cima): gerar/encomendar;
  `sticker.png` é substituto temporário.
- **Mapa no Modo Criança**: combinado que fica pro **app mobile futuro**
  (ver `docs/V2-DIRECAO.md` §15), não pro site — mudança de direção em
  relação ao que esta spec assumia originalmente ("próxima sprint" no site).
- **Seletor de plano** no cabeçalho: só quando existir 2º plano em
  `PLANOS_REGISTRO`.
- **"1 vezes" → "1 vez"** no `encerramentoResumo` (nit antigo, aproveitar
  algum commit de copy).
