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
    ├── atividades.js
    ├── resumo.js
    ├── home.js
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

### Resumo (mesa de trabalho)

Movido para:

`js/pages/tutor/resumo.js`

Inclui:
- `decisaoDe`, `renderDecisao` ("Próxima decisão" por estado);
- `renderPulso`;
- `renderTimeline` (+ `renderFeedItems`, exclusivo daqui);
- `renderContexto`;
- `renderErro`;
- `reload` (recarrega sessions/trail/módulos/missões/execuções pendentes e
  deriva o estado via `derivarEstadoResumo`).

Contrato com `tutor.js`/`renderRecord`: `buildResumoPanel(cycle, { openForm,
openPlan, openSessions })` devolve `<section>` com `.reload()`.
`openPlan`/`openSessions` substituem as chamadas diretas a
`switchTab('plan')`/`switchTab('sessions')` que o painel fazia quando vivia
em `tutor.js` — `switchTab` não foi movido nem importado por `resumo.js`;
`tutor.js` passa `openPlan: () => switchTab('plan')` e
`openSessions: () => switchTab('sessions')` no call site.

`toList` foi para `shared.js` (não é exclusivo do Resumo — `tutor.js` ainda
usa em `buildLibraryHref` e na atividade sugerida do Início/`buildHomeView`).
`getCycleSessions`, `getLatestChildTrail`, `getChildTrailModules`,
`getChildTrailMissions` e `listPendingExecucoes` são importados direto da
camada de dados tanto por `resumo.js` quanto (os 3 do meio) por `tutor.js`
(Plano) — import de dado duplicado entre módulos é esperado, não é acoplamento.

Resultado:
aprox. 280 linhas removidas de `tutor.js` (1836 → 1557).

Validação:
- build passou;
- dev transform passou (curl em `/js/pages/tutor.js` e
  `/js/pages/tutor/resumo.js`, imports resolvidos);
- confirmado: nenhum import circular (`resumo.js`/`shared.js` não importam
  `tutor.js`);
- confirmado: `tutor.js` não contém mais `buildResumoPanel`/`decisaoDe`/
  `renderDecisao`/`renderPulso`/`renderTimeline`/`renderContexto`/
  `renderErro`/`renderFeedItems`;
- smoke test manual no navegador: **pendente**.

### Início (Home)

Movido para:

`js/pages/tutor/home.js`

Inclui:
- `buildHomeView`, `HOME_SUMMARY`, `NEXT_ACTION_LABEL`, `CYCLE_LABEL`;
- `logoIconSrc` (só era usado aqui).

Contrato com `tutor.js`/`renderCurrentView`: `buildHomeView(state, cycle, {
tutorName, openRecord, openSupport, libraryHref, suggestedActivity,
onSessionsLoaded })` devolve uma Promise de `<section>` — mesmo formato
sugerido na missão, sem ajuste.

Dependências implícitas tornadas explícitas:
- `tutorName` = `session.profile.name || 'tutor'` — `home.js` não conhece
  `session`;
- `openSupport()` — `tutor.js` fecha sobre
  `openSupportDrawer(firstName(child.name))`; `home.js` não importa
  `openSupportDrawer` nem `firstName` (não sobrou nenhum uso de `firstName`
  dentro do módulo depois dessa mudança);
- `libraryHref` — `tutor.js` calcula `buildLibraryHref(cycle)` e passa a
  string (ou `null`) pronta; `home.js` não sabe montar a URL da Biblioteca
  e por isso também não precisa de `hasActiveTutorCycle` (o `if (libraryHref)`
  substitui o antigo `if (hasActiveTutorCycle(cycle))` — mesmo resultado,
  porque `buildLibraryHref` já retorna `null` nesse caso);
- `suggestedActivity` — já chega como a *string* do título, não o objeto
  atividade inteiro (só `.title` era usado). `ACTIVITY_LIBRARY` e
  `pickSuggestedActivity` **não foram movidos**: a command palette
  (`getCommandGroups`, ainda em `tutor.js`) também os usa hoje — mover os
  dois é decisão da futura extração do cmdk, não desta;
- `onSessionsLoaded(rows)` — `home.js` carrega as sessões do ciclo (pra
  "Última sessão") e chama o callback; `tutor.js` grava em
  `recentSessionsCache` (lida pela command palette) dentro do callback.
  `home.js` não conhece `recentSessionsCache`.

`monthsBetween`/`currentCycleMonth` foram para `shared.js` — usados tanto
pelo card Acompanhamentos do Início quanto pelo chip de status do cabeçalho
do Record (`renderRecordHeader`, ainda em `tutor.js`).

Resultado:
aprox. 138 linhas removidas de `tutor.js` (1557 → 1419).

Validação:
- build passou;
- dev transform passou (curl em `/js/pages/tutor.js`, `/js/pages/tutor/home.js`
  e `/js/pages/tutor/shared.js`, imports resolvidos);
- confirmado: nenhum import circular (`home.js` não importa `tutor.js`);
- confirmado: `tutor.js` não contém mais `buildHomeView`/`HOME_SUMMARY`/
  `NEXT_ACTION_LABEL`/`CYCLE_LABEL`/`monthsBetween`/`currentCycleMonth`;
- confirmado: `home.js` não importa nem referencia a command palette;
- smoke test manual no navegador: **pendente**.

---

## Próximo alvo

Suporte + command palette + navegação (`openSupportDrawer`,
`buildSupportDrawerContent`, `getCommandGroups`/`renderCommandResults`/
`openCommandPalette`/`closeCommandPalette`, `switchTab`/`wireTabs`,
`ACTIVITY_LIBRARY`/`pickSuggestedActivity`, `recentSessionsCache`).

Esta é a extração que finalmente decide o destino de `ACTIVITY_LIBRARY`/
`pickSuggestedActivity` (hoje represado em `tutor.js` porque cmdk e Início
os compartilhavam) e de `recentSessionsCache` (hoje escrito por Início e
Sessões, lido pelo cmdk).

Ordem aproximada depois deste:

1. ~~Atividades~~ (concluído)
2. ~~Resumo~~ (concluído)
3. ~~Início (Home)~~ (concluído)
4. suporte + command palette + navegação
5. Plano/Jornada/Pareamento por último

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