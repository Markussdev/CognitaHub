# 0001 — Camada Noite Maracajá nas páginas públicas

**Data:** 2026-11-04
**Status:** aceita (proposta pelo agente na véspera do Mundo SENAI 2026; confirmar na revisão do Marcus)

## Contexto

A homepage foi reformulada em novembro de 2026 na identidade "Noite Maracajá"
(roxo profundo, ameixa, dourado, grafismos espaciais e mascotes). As páginas
públicas e de entrada continuaram no layout claro antigo (fundo creme,
cabeçalho com marca quadrada e texto, rodapé azul-ameixa): `como-funciona`,
`para-familias`, `para-tutores`, `seguranca`, `login`, `cadastro`,
`cadastro-responsavel`, `cadastro-tutor`, `candidatura-tutor`,
`termos-de-uso` e `politica-de-privacidade`.

Essas páginas se dividem em três famílias de CSS: `public-shell.css` (mais as
folhas de cada página), blocos `<style>` inline duplicados (login, cadastro,
cadastro-responsavel) e `tutor-onboarding.css`. O mesmo conjunto de tokens
(`--ink`, `--ink-soft`, `--brand`, `--brand-deep`, `--accent`) aparece nas três.

Não havia como conferir o resultado olhando as telas antes do evento, então a
solução precisava ser verificável por medição (contraste, rolagem, assets) e
fácil de reverter por página.

## Alternativas consideradas

- **Reescrever o CSS de cada página:** descartada. São mais de 3.000 linhas
  entre sete folhas e três blocos inline, com risco alto de regressão em
  formulários e sem como validar visualmente a tempo.
- **Deixar o corpo claro e trocar só cabeçalho, hero e rodapé:** descartada.
  Mantém o creme antigo na maior parte da página, que é exatamente a
  inconsistência a eliminar.
- **Inverter os tokens globalmente em todas as páginas:** descartada para os
  formulários. O cartão claro e os estados de validação dependem das cores
  originais; inverter o token atingiria campos, erros e textos de ajuda.
- **Consolidar os `<style>` inline e criar um sistema novo:** descartada.
  O CLAUDE.md proíbe consolidar CSS como tarefa lateral e a entrega pedia
  explicitamente não criar um segundo design system.

## Decisão

Um único arquivo, `css/public-noite.css`, escopado por `body.pub-noite` (nenhum
seletor fora desse escopo), ligado por página com a classe no `<body>` e dois
`<link>` (`brand-surface.css` e ele, por último). Nas páginas de conteúdo ele
inverte os tokens para texto claro sobre o noite e devolve as cores originais
às telas do produto desenhadas em HTML; nas de formulário só muda a moldura
(fundo, cabeçalho, textos fora do cartão) e o cartão continua claro.

## Consequências

- **Reverter uma página:** tirar `pub-noite` do `<body>` e os dois `<link>`.
  Reverter tudo: apagar o arquivo e esses trechos. Nenhum CSS de página foi editado.
- **Facilita:** manter uma só fonte da identidade pública; telas internas,
  homepage e Mundo SENAI ficam intocadas (nenhuma as referencia).
- **Dificulta:** o CSS de cada página agora é lido em duas camadas (o original
  e o que a camada sobrescreve). Regra nova que use `--ink` ou `--brand` numa
  página de conteúdo precisa considerar que eles são claros ali.
- **Proibido:** carregar `public-noite.css` em tela interna (painéis, admin, app
  infantil) sem revisão própria, e escrever seletor nele fora de `body.pub-noite`.
- **A revisitar:** quando login e cadastros forem consolidados (hoje há quatro
  cópias do mesmo CSS), a camada pode virar a base única e o HTML antigo do
  cabeçalho pode sair. O Vite não garante a ordem entre folhas de mesma
  especificidade: por isso o rodapé repete o fundo com especificidade maior.
