# Current Work — Cognita Hub

## Objetivo atual

Refatoração estrutural do painel do tutor sem mudança de produto.

Objetivo:
reduzir `js/pages/tutor.js`, separar domínios e diminuir contexto necessário
para manutenção humana e por agentes.

Nenhuma mudança de schema ou comportamento pedagógico faz parte desta fase.

---

## Estado atual

Extrações concluídas:

### Sessões

Movido para:

`js/pages/tutor/sessoes.js`

Inclui:
- formulário de registro em 3 passos;
- timeline;
- histórico;
- integração com execuções pendentes;
- eventos e contrato antigos preservados.

Resultado:
aprox. 806 linhas removidas de `tutor.js`.

Validação:
- build passou;
- Vite dev transform passou;
- smoke test manual no navegador passou.

### Perfil do tutor

Movido para:

`js/pages/tutor/perfil.js`

Persistência movida para:

`js/data/tutor.js`

Inclui:
- renderização;
- preview;
- edição;
- avatar;
- upload;
- update do perfil.

Resultado:
aprox. 308 linhas removidas de `tutor.js`.

Validação:
- build passou;
- dev transform passou;
- smoke test manual passou;
- alteração e persistência de dados do perfil confirmadas.

---

## Estrutura nova relevante

js/pages/
├── tutor.js
└── tutor/
    ├── sessoes.js
    ├── perfil.js
    └── shared.js

`shared.js` deve continuar pequeno e conter apenas helpers realmente
compartilhados e sem domínio próprio.

### Atividades

Movido para:

`js/pages/tutor/atividades.js`

Inclui:
- acervo (lista + filtros avulsas/Jornada/arquivadas);
- assistente de criação/edição/duplicação (3 passos + prévia real do Modo
  Criança via iframe/postMessage);
- arquivar/restaurar;
- ponte `?preset=<slug>` da Biblioteca (`openPreset`);
- `emblemaDeMolde`, `MOLDE_DESCRICAO`, `FRASE_REVISAO`;
- `makeSlider`/`makePillSelector` (não estavam na lista prevista — eram
  usados só pelo passo 2 do assistente, nenhum outro painel os consome).

Contrato com `tutor.js`/`renderRecord`: `buildActivitiesPanel(cycle, state,
{ onSaved, tutorId })` devolve `<section>` com `.loadTable()` e
`.openPreset(preset)`. `tutorId` (= `session.user.id`) é passado explícito —
o módulo não conhece a sessão do tutor.

`kebabMenu`, `MISSION_STATUS_LABEL` e `formatLastSession` foram para
`shared.js`, não para `atividades.js` — são usados também por Plano
(`buildPlanPanel`, ainda em `tutor.js`) e por Resumo/Início/cmdk. Iam pra
`atividades.js` pela lista prevista, mas isso teria acoplado o painel de
Plano a um import de `atividades.js`.

Achado preservado como estava (não é bug desta fase): `renderRecord` chama
`activitiesPanel.prefillFromPlano?.(etapa)`, mas `prefillFromPlano` nunca
foi implementado em `buildActivitiesPanel` — já era (e continua sendo) um
no-op silencioso.

Resultado:
aprox. 730 linhas removidas de `tutor.js` (2571 → 1836).

Validação:
- build passou;
- dev transform passou (curl nos módulos `/js/pages/tutor.js` e
  `/js/pages/tutor/atividades.js`, sem erro de import);
- smoke test manual no navegador: **pendente** — não foi feito nesta sessão.

---

## Próximo alvo

Resumo/Home.

Ordem aproximada depois deste:

1. ~~Atividades~~ (concluído)
2. Resumo/Home
3. suporte + command palette + navegação
4. Plano/Jornada/Pareamento por último

`buildPlanPanel` é a região de maior risco e deve ficar para depois.

---

## Achados arquiteturais importantes

- `apps/mobile/src/` é parcialmente morto e parcialmente usado pela web.
  Não apagar ou reorganizar em bloco.
- O antigo bootstrap Capacitor está inativo.
- Alguns renderizadores visuais de `apps/mobile/src/` continuam ativos via
  `preview-crianca.js`.
- `planos-registro.js` e `trilha-formal.js` continuam vivos por motivos
  diferentes. Não unificar durante esta fase.
- Banco e produto pós-Ruaké estão fora do escopo desta jardinagem.

---

## Regra desta fase

Refactor estrutural:
SIM.

Mudança de comportamento:
NÃO.

Banco/schema/RLS/RPC:
NÃO.

Se uma extração exigir mudança de produto ou banco, parar e relatar.

---

## Como retomar

Antes da próxima tarefa:

1. leia `CLAUDE.md`;
2. leia este arquivo;
3. rode `git status`;
4. examine os últimos commits/diff;
5. leia apenas os módulos envolvidos na próxima extração;
6. não reaudite o repositório inteiro.

Depois continue a partir do próximo alvo.