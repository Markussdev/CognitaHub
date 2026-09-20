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
    ├── support.js
    ├── command-palette.js
    ├── navigation.js
    ├── pareamento.js
    ├── jornada.js
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

### Suporte (drawer global)

Movido para:

`js/pages/tutor/support.js`

Inclui:
- `buildSupportDrawerContent` (privada, não exportada — só uso interno);
- `openSupportDrawer`, `closeSupportDrawer`.

Autocontido: não dependia de `session`, `currentDerived` nem de outro estado
de `tutor.js` — só do DOM (`data-support-*`) e do `childName` recebido por
parâmetro. Por isso não precisou de nenhum contrato novo, só virou import.
Wiring dos botões fechar/backdrop preservada como efeito colateral do
import (mesmo padrão de `wireRailToggle()`).

Resultado:
aprox. 50 linhas removidas de `tutor.js`.

### Command palette

Movido para:

`js/pages/tutor/command-palette.js`

Inclui:
- `CMDK_ICONS`;
- `getCommandGroups`, `renderCommandResults`;
- `openCommandPalette`, `closeCommandPalette`.

Dependências implícitas tornadas explícitas via `wireCommandPalette({
getCycle, goRecord })`, chamado uma vez por `tutor.js` no bootstrap (onde
antes estavam as 3 linhas de wiring `data-cmdk-*`):
- `getCycle()` — substitui a leitura direta de
  `currentDerived`/`RECORD_STATES` (nenhum dos dois foi movido, ficam pra
  extração de navegação); `tutor.js` passa
  `() => (currentDerived && RECORD_STATES.includes(currentDerived.state) ? currentDerived.cycle : null)`;
- `goRecord` — passado por referência, a function declaration continua em
  `tutor.js` (não fazia parte desta missão);
- `recentSessionsCache` **virou estado próprio do módulo** (antes era `let`
  solto em `tutor.js`, escrito pelo Início e por Sessões, lido só pelo
  cmdk). `tutor.js` agora empurra atualizações via `setRecentSessions(rows)`
  — os dois pontos de escrita (`refreshSessions` em `renderRecord` e
  `onSessionsLoaded` no call site do Início) mudaram de
  `recentSessionsCache = rows` para `setRecentSessions(rows)`.

`ACTIVITY_LIBRARY`/`DEFAULT_ACTIVITY`/`pickSuggestedActivity` foram para
`shared.js`, não para `command-palette.js` — o call site do Início em
`tutor.js` (`renderCurrentView`) também usa `pickSuggestedActivity` pra
montar `suggestedActivity`. `buildLibraryHref` foi junto pro mesmo lugar
pelo mesmo motivo (rail, Início e cmdk usam os três).
`openSupportDrawer` é importado direto de `tutor/support.js` — módulo-irmão,
não interno de `tutor.js`.

Resultado combinado (suporte + cmdk):
aprox. 229 linhas removidas de `tutor.js` (1419 → 1190).

Validação:
- build passou;
- dev transform passou (curl em `/js/pages/tutor.js`, `/js/pages/tutor/support.js`,
  `/js/pages/tutor/command-palette.js` e `/js/pages/tutor/shared.js`, imports
  resolvidos);
- confirmado: nenhum import circular (`support.js`/`command-palette.js` não
  importam `tutor.js`);
- confirmado: `tutor.js` não contém mais `buildSupportDrawerContent`/
  `openSupportDrawer`/`closeSupportDrawer`/`CMDK_ICONS`/`getCommandGroups`/
  `renderCommandResults`/`openCommandPalette`/`closeCommandPalette`/
  `ACTIVITY_LIBRARY`/`pickSuggestedActivity`/`recentSessionsCache`;
- smoke test manual no navegador: **pendente**.

### UI de navegação (rail/breadcrumb/tabs)

Movido para:

`js/pages/tutor/navigation.js`

Inclui:
- `renderRail`, `setActiveNav`, `renderCrumb`;
- `switchTab`, `wireTabs`.

`fillIdentity` foi avaliada e **não** foi movida: preenche `data-account-*`/
`data-topbar-avatar` (identidade do tutor logado — nome/avatar/e-mail) a
partir de `session` direto. É uma região de DOM diferente da de rail/tabs/
crumb (que respondem "onde o usuário está"), não compartilha seletores nem
gatilhos com elas, e forçá-la pra `navigation.js` exigiria ensinar o módulo
sobre `session` só pra reduzir linhas de `tutor.js` — exatamente o que a
missão pediu pra não fazer.

Dependência implícita tornada explícita: `renderRail` chamava `goRecord()`
direto no clique do link da criança. Virou callback:
`renderRail(hasRecord, childName, activeCycle, { openRecord })`, com
`tutor.js` passando `{ openRecord: goRecord }` nos dois call sites (o de
`bootstrap()` antes do ciclo carregar, com `hasRecord=false`, e o de depois
de `deriveTutorState`).

`switchTab` continua exportado — outros módulos não o importam direto, mas
`resumo.js` recebe `openPlan`/`openSessions` que fecham sobre `switchTab` do
lado de `tutor.js`.

Resultado:
aprox. 69 linhas removidas de `tutor.js` (1190 → 1121).

Validação:
- build passou;
- dev transform passou (curl em `/js/pages/tutor.js` e
  `/js/pages/tutor/navigation.js`, imports resolvidos);
- confirmado: nenhum import circular (`navigation.js` não importa `tutor.js`);
- confirmado: `tutor.js` não contém mais `renderRail`/`setActiveNav`/
  `renderCrumb`/`switchTab`/`wireTabs`;
- confirmado: `fillIdentity` continua em `tutor.js`;
- smoke test manual no navegador: **pendente**.

### Pareamento

Movido para:

`js/pages/tutor/pareamento.js`

Inclui:
- `renderDeviceCard` → renomeada `buildPairingCard(childId)` (mesmo padrão
  `build*Card`/`build*Panel` dos outros módulos de `tutor/`; `childId`
  explícito no lugar do `cycle.child_id` capturado por closure).

Utilidade autocontida desde sempre — não precisou de contrato novo além de
virar parâmetro explícito. Não conhece Jornada, módulos, missões nem
`tutor.js`. Dependências próprias: `listPairedDevices`, `createPairingCode`
(`data/pareamento.js`).

Validada isoladamente antes da Etapa 2 (Jornada), conforme pedido.

### Jornada

Movido para:

`js/pages/tutor/jornada.js`

Inclui:
- `MODULE_STATUS_LABEL` (local, não exportada — só uso interno, igual
  estava);
- `appendChildAppLink`;
- `buildPlanPanel` e todas as funções internas exclusivas (`blockedNoteEl`,
  `renderStepper`, `renderErrorLine`, `renderAssign`,
  `renderRecommendedJourneyCard`, `renderCustomJourneyCard`, `renderTrail`,
  `abrirReopenPanel` aninhada, `load`).

Contrato externo **mantido tal como estava**, sem ajuste — este bloco nunca
teve dependência implícita de `session`/`currentDerived`/navegação, só de
`cycle`/`state` já recebidos por parâmetro:

```js
buildPlanPanel(cycle, state)
// → <section data-panel="plan" hidden> com panel.loadStatus = load
```

`tutor.js` continua só:

```js
const planPanel = buildPlanPanel(cycle, state)
...
planPanel.loadStatus?.()
```

O card de pareamento agora vem de `buildPairingCard(cycle.child_id)`
(import de `./pareamento.js`, módulo-irmão) no lugar do antigo
`renderDeviceCard()` interno.

`PLANOS_REGISTRO`/`pendingEtapaParams` (sistema paralelo e legado de
"etapas" vindo de `trilha.html`) **não migraram** — nunca pertenceram a
`buildPlanPanel`, são usados só em `renderRecord`, que fica em `tutor.js`.
Confirmado na auditoria prévia a esta missão.

Resultado combinado (Pareamento + Jornada):
aprox. 554 linhas removidas de `tutor.js` (1121 → 567).

Validação:
- build passou (as duas etapas, cada uma isoladamente);
- dev transform passou (curl em `/js/pages/tutor.js`,
  `/js/pages/tutor/pareamento.js` e `/js/pages/tutor/jornada.js`, imports
  resolvidos);
- confirmado: nenhum import circular (`pareamento.js`/`jornada.js` não
  importam `tutor.js`);
- confirmado: `tutor.js` não contém mais `renderDeviceCard`/
  `buildPlanPanel`/`appendChildAppLink`/`MODULE_STATUS_LABEL`;
- smoke test manual no navegador: **pendente**.

---

## Próximo alvo

Nenhum bloco grande de domínio resta represado — Plano/Jornada/Pareamento
era o último. `tutor.js` está em 567 linhas: orquestrador
(`bootstrap`/`renderCurrentView`/`goHome`/`goRecord`/`goProfile`/
`renderRecord`/`renderRecordHeader`/`renderTabs`), máquina de estados
(`deriveTutorState`/`RECORD_STATES`), estados sem record
(`renderNoRecord` e variantes), `fillIdentity` e o wiring de topo (detecção
de `?activity=`/`?preset=`/retorno do Modo Condução). Isso pertence ao
orquestrador principal por definição (decisão já registrada na extração de
navegação) — não é fila de próximas extrações.

Achado solto (não é desta fase, só registro): `formatList` e
`formatAttentionSpan`/`ATTENTION_SPAN_LABEL` (linhas ~128-142 de
`tutor.js`) estão definidos mas **não têm nenhum call site** — código morto
pré-existente, não introduzido por nenhuma extração. Não removido porque
não fazia parte de nenhuma missão até aqui; sinalizar se for pedida uma
limpeza.

A próxima tarefa nesta área provavelmente é: **smoke test manual completo**
no navegador (pendente desde a extração de Atividades) e/ou revisão de
todo o diff acumulado antes de considerar a jardinagem estrutural encerrada.

Ordem concluída:

1. ~~Atividades~~
2. ~~Resumo~~
3. ~~Início (Home)~~
4. ~~Suporte~~
5. ~~Command palette~~
6. ~~UI de navegação (rail/breadcrumb/tabs)~~
7. ~~Pareamento~~
8. ~~Jornada~~

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