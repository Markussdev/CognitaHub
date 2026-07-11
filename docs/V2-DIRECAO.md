# Cognita Hub — Direção da V2 (Hub adulto + Modo Criança)

> **Status: V2 Core fechada — RC1 (2026-07-09); Sprint 5A (nav mobile),
> Sprint 5.2 (consolidação visual) e a trilha do Plano (§15+§16, 2026-07-11)
> já entregues.** O ciclo de aprendizagem guiada (Plano → preparar → Modo
> Criança → execução → sessão → família) está funcional de ponta a ponta e
> testado ao vivo. A trilha "Constelação dos Primeiros Números" passou por
> uma correção de rumo no mesmo dia: o mapa não cabia num card de dashboard
> (§15, versão descontinuada) e virou página própria, `pages/trilha.html`
> (§16) — a aba Plano no painel do tutor agora é só um resumo compacto que
> aponta pra lá. Ver §12 pro fechamento do RC1, §13 pra navegação mobile,
> §14 pra consolidação visual, §16 pro estado atual da trilha, e
> `docs/ROTEIRO-DEMO.md` pro roteiro de demo de 3 minutos. **Direção de
> produto mais ampla (ver §15):** a experiência de trilha navegável da
> criança (estilo Duolingo ABC) vai viver num app mobile futuro — este site
> é a ferramenta do tutor pra prever e ministrar essa trilha, não o lugar
> onde a criança navega sozinha. Sprint 5.3 (base visual do Modo Criança)
> segue não iniciada, aguardando escopo mais detalhado do Marcus.

Revisão feita em 2026-07-08. Este documento registra a decisão de produto da V2, o
estado real (verificado no código, não suposto) da jornada ponta a ponta que ela
prioriza, e o que ficou pendente para as próximas etapas.

**Atualização 2026-07-08 (mesmo dia):** a corrente inteira foi testada ao vivo
contra o Supabase real (tutor `tutor.teste@gmail.com` / responsável
`marcus.vwq.777@gmail.com`, criança "Mateus", ciclo ativo mês 2/6) — não só lida
no código. Ver §7. Todos os 6 elos da seção 4 estão confirmados funcionando de
ponta a ponta com dado real, não só no código.

---

## 1. Visão de produto

O Cognita Hub passa a ser pensado como **duas experiências**, não uma:

1. **Hub adulto** — o site que responsável, tutor e admin usam para cadastro,
   acompanhamento, match, sessões e progresso. É a maior parte do produto e
   continua exatamente como descrito no `CLAUDE.md`.
2. **Modo Criança** — uma experiência guiada, de tela cheia, aberta por um
   adulto (tutor ou responsável) para a criança executar **uma atividade
   específica que esse adulto já preparou**. Não é uma área autônoma da
   criança: ela não faz login, não escolhe o que fazer, não navega para fora
   da atividade.

**Não entra na V2** (reafirmando o limite, porque já existe uma tentação real
de expandir por aqui): gamificação avançada (pontos, streaks, níveis públicos),
loja, ranking, login infantil, mapa/trilha navegável por conta própria da
criança. O Modo Criança continua sendo "casca + molde", não um app.

## 2. A jornada que a V2 fecha

```
tutor prepara atividade
   → criança faz no Modo Criança
      → execução é salva (atividade_execucao)
         → tutor registra a sessão vinculando essa execução
            → responsável vê o resumo da sessão (sem notas internas)
```

Essa cadeia já existia em código antes desta revisão (commit `7c87dc9` e
trabalho de 29/06–05/07, ver memória de projeto). O que esta entrega fez foi
**auditar cada elo contra o código real** e fechar a única lacuna encontrada
(item 4 abaixo).

## 3. Mapeamento etapa → código

| Etapa | Onde vive | Tabela |
|---|---|---|
| Tutor prepara atividade | `js/pages/tutor.js` → `buildActivitiesPanel` (aba "Atividades preparadas"), grava via `js/data/child-activities.js#createChildActivity` | `child_activities` |
| Prévia ao vivo pro tutor | `modo-crianca.html?preview=1` num `<iframe>`, alimentado por `postMessage` a partir do mesmo form | — (não grava nada) |
| Molde + tema + contrato | `js/data/moldes-registro.js` (`MOLDES_REGISTRO`, `buildContractFromParts`) — fonte única usada tanto pela prévia quanto pela execução real | — |
| "Fazer com a criança" | Link em `renderChildActivityRow` (`tutor.js`) → `modo-crianca.html?activity=<id>&return=...` | — |
| Criança executa | `pages/modo-crianca.html` + `js/pages/modo-crianca.js` (máquina de estados: acolhimento → atividade → feedback → encerramento) + `js/pages/moldes/contar.js` (único molde implementado) | — |
| Execução é salva | `ModoCrianca.sair()` chama `js/data/atividade-execucao.js#createAtividadeExecucao` ao chegar em "encerramento" e o adulto tocar "Voltar" | `atividade_execucao` |
| Tutor registra a sessão | `js/pages/tutor.js` → `renderSessionForm`: lista execuções pendentes (`listPendingExecucoes`, `session_id is null`), botão "Usar esta execução" pré-preenche o Nível 1, tutor escreve Níveis 2 (resumo família) e 3 (nota interna) | `sessions` |
| Vincula execução ↔ sessão | Ao salvar, `js/data/sessions.js#linkExecucaoToSession` seta `atividade_execucao.session_id` | `atividade_execucao.session_id` |
| Responsável vê o resumo | `js/data/guardian.js` chama `js/data/sessions.js#getFamilySessions` (RPC `get_family_sessions`, security definer) → `js/pages/responsavel.js#applyRealCycle` usa só `family_summary`, nunca `notes` | leitura via função, não a tabela |

## 4. Estado verificado de cada item da "primeira entrega"

1. **Fluxo atual revisado** — feito nesta auditoria; mapeado na tabela acima.
2. **"Fazer com a criança" abre a activity correta** — ✅ confirmado.
   `modo-crianca.js` lê `?activity=<id>`, exige `requireRole('tutor', 'guardian')`,
   busca a linha real via `getChildActivityById` e monta o contrato com
   `buildContractFromParts`. Se a busca falhar, cai no stub de demonstração
   em vez de quebrar a tela.
3. **`atividade_execucao` é salva ao sair/concluir** — ✅ confirmado.
   `montarAtividadeExecucao()` monta o sinal (molde, tema, nível final, se
   precisou de "mais fácil", tempo aproximado, como encerrou) e `sair()` grava
   quando há `_childActivityId` + sessão autenticada.
   ⚠️ **Limite conhecido, não resolvido nesta entrega:** só grava se o adulto
   chegar à tela de encerramento e tocar "Voltar". Fechar a aba/navegador no
   meio da atividade não deixa rastro. Aceitável para a V2 (não é meta desta
   entrega criar um `beforeunload` ou autosave), mas vale saber que sessões
   "silenciosas" existem.
4. **Tutor registra a sessão vinculando a execução** — ✅ confirmado no código;
   **⚠️ uma lacuna de navegação foi corrigida nesta entrega.** Antes, o link
   "Fazer com a criança" voltava para `tutor.html` puro — o tutor caía na tela
   Início e precisava navegar manualmente até a aba Sessões para encontrar a
   execução pendente em "Usar esta execução". Agora o retorno é
   `tutor.html?view=record&tab=sessions`, e `bootstrap()` em `tutor.js`
   reconhece esses parâmetros e já abre a aba certa. O vínculo em si
   (`linkExecucaoToSession`) não mudou — já funcionava.
5. **Responsável vê um resumo seguro, sem notas internas** — ✅ confirmado.
   A família nunca consulta a tabela `sessions` direto: tudo passa pela função
   `get_family_sessions` (`docs/supabase-fase-4c-registro-sessao.sql`), que é
   `security definer` e **nunca seleciona `notes`** (Nível 3). O Passo C4 desse
   script já documenta a auditoria que confirma isso — vale rodar de novo se o
   schema de `sessions` mudar.
6. **Documentado** — este arquivo.

## 5. Pendências e riscos abertos (fora do escopo desta entrega, mas registrados)

- ~~Confirmação de que as migrations rodaram no Supabase real~~ — **resolvido
  em 2026-07-08.** Marcus rodou as 4 queries de auditoria; `child_activities`,
  `atividade_execucao`, `sessions.family_summary`/`child_activity_id` e a
  função `get_family_sessions` existem no projeto real, e a policy de
  `sessions` não expõe nenhuma leitura direta pro responsável (só
  `sessions_admin_all`/`sessions_tutor_*`). Ver §7 para a prova de ponta a
  ponta com dado real.
- **Decisão oficial (2026-07-09): na V2, o Modo Criança é aberto pelo tutor.**
  A abertura pelo responsável fica para uma fase posterior — não é mais uma
  pendência em aberto, é escopo decidido conscientemente. Motivo: deixar o
  responsável abrir exigiria decidir, antes de qualquer linha de código, se
  ele escolhe qualquer atividade ou só as liberadas pelo tutor, quem registra
  a sessão quando ele faz em casa, se isso vira sessão de verdade ou só
  prática doméstica, e se o tutor fica sabendo depois — é uma superfície de
  produto nova, não um botão a mais. As policies de RLS já permitem
  (`ca_guardian_select`, `ae_guardian_insert` em
  `supabase-fase-4b-corrente.sql`), então nada no banco bloqueia retomar isso
  quando fizer sentido — mas não antes do ciclo do tutor estar redondo.
- **Só um molde existe** (`contar` / tema `dinossauros`). `identificar`,
  `comparar` e `associar` estão registrados em `MOLDES_REGISTRO` com
  `disponivel: false`. Adicionar um molde novo é trabalho de produto (desenhar
  a interação, os feedbacks, o critério de acerto), não uma tarefa mecânica —
  não fazer sem pedido explícito.
- **`support_requests` (drawer "Falar com equipe") continua só local** — não é
  desta jornada, mas está com um `TODO(wiring:support_requests)` no mesmo
  arquivo (`tutor.js`) que foi tocado nesta entrega.

## 6. Roadmap combinado (decisão de 2026-07-08, ordem que Marcus definiu)

Decisão explícita: **nenhum trabalho visual até a corrente ponta a ponta estar
fechada e testada com dado real.** Essa entrega fechou a Sprint 1. As próximas,
em ordem, só começam quando a anterior estiver pronta:

- **Sprint 1 — Fechar corrente** *(concluída nesta entrega, ver §7)*: preparar
  → fazer → salvar → registrar → acompanhar, sem visual novo.
- **Sprint 2 — Melhorar o Modo Criança**: tela mais fofa, botões maiores,
  feedback mais bonito, mascote, fundo leve, animações pequenas, estado de
  pausa mais claro. Ainda dentro do `<style>` inline de `modo-crianca.html` —
  não entra no `internal.css`/`styles.css` do hub adulto.
- **Sprint 3 — Segundo molde**: `identificar` (ex.: "Toque no número 3").
  Reaproveita a mesma estrutura de `MOLDES_REGISTRO` + `buildContractFromParts`
  do molde `contar` — é o próximo a sair de `disponivel: false`. Vale mais que
  parece: a mesma mecânica de "identificar X entre distratores" serve depois
  para número, forma, cor, quantidade, símbolo e letra.
- **Sprint 4 — Trilha simples**: **não é navegação livre da criança.** É:
  1. **No painel do tutor**: uma trilha visual de progresso ("Primeiros
     Números: 1. Reconhecer números → 2. Contar objetos → 3. Associar número
     e quantidade → 4. Mais ou menos → 5. Revisão calma") — o tutor vê onde a
     criança está e escolhe/prepara a próxima atividade. A criança nunca
     escolhe a fase.
  2. **No Modo Criança**: a trilha aparece só como ambientação de uma linha
     ("Missão 2 de 5 — Contar dinossauros"), não como mapa navegável.

Pontos de encaixe que já existem no código pra quando a Sprint 4 chegar:

- `MOLDES_REGISTRO` já separa "o que o molde é" de "como a casca desenha" —
  a trilha consome a mesma lista de moldes/temas sem duplicar dado.
- A máquina de estados do `ModoCrianca` (`js/pages/modo-crianca.js`) isola o
  `mold-slot` como o único pedaço que um molde controla — a "Missão X de Y"
  entra como um texto extra no `stage-top` ou `stage-instruction`, sem
  reescrever o resto da casca.

## 7. Verificação ao vivo (2026-07-08) — prova de ponta a ponta

Rodada contra o projeto Supabase real (não um mock, não uma leitura de
código): tutor `tutor.teste@gmail.com` preparando atividade para "Mateus"
(ciclo ativo, mês 2/6), responsável `marcus.vwq.777@gmail.com` como
observador. Navegador dirigido via Playwright headless contra
`npm run dev` local. Cada passo abaixo foi observado acontecer, não inferido:

1. **Migrations** — as 4 queries de auditoria (tabelas, coluna-ponte, função
   `get_family_sessions`, policies de `sessions`) rodadas por Marcus no SQL
   Editor confirmaram que `docs/supabase-fase-4b-corrente.sql` e
   `docs/supabase-fase-4c-registro-sessao.sql` já estão aplicados, e que
   nenhuma policy de `sessions` expõe leitura direta ao responsável.
2. **Atividade preparada real** — criada "Contar dinossauros — teste E2E"
   (2 itens, nível 1, 1 rodada) pela aba Atividades preparadas; apareceu na
   tabela na hora, badge da aba foi de 1 para 2. Prévia ao vivo no iframe
   renderizou o contrato correto antes mesmo de salvar.
3. **"Fazer com a criança"** — o link levou para
   `modo-crianca.html?activity=<uuid-real>&return=tutor.html%3Fview%3Drecord%26tab%3Dsessions`;
   a tela carregou a atividade real (`getChildActivityById`), não o stub.
4. **Execução salva** — completada a rodada (clique nos itens do molde
   `contar`), feedback "Boa! O número está certo.", encerramento com o resumo
   "Vocês contaram até 2 dinossauros, 1 vezes." (nota: "1 vezes" devia ser
   "1 vez" — nit de copy no `encerramentoResumo` de `MOLDES_REGISTRO`, não
   corrigido nesta rodada por ser puramente cosmético). Ao clicar "Voltar",
   `atividade_execucao` foi gravada no Supabase.
5. **Retorno pra aba certa** — o navegador pousou direto em
   `tutor.html?view=record&tab=sessions` (a correção desta entrega),
   confirmando visualmente a aba "Sessões" já ativa.
6. **Vínculo execução↔sessão** — expandido "Registro guiado", a execução
   pendente apareceu ("Contar · Dinossauros · nível 1" + botão "Usar esta
   execução"); usada para preencher o Nível 1, preenchidos Nível 2 (resumo
   pra família) e Nível 3 (nota interna de teste), sessão salva. Histórico de
   sessões foi de 1 para 2 linhas. Reaberto o formulário depois: a execução
   já não aparece mais como pendente (`session_id` foi setado).
7. **Responsável vendo o resumo com segurança** — logado como
   `marcus.vwq.777@gmail.com`, a tela "Sessões de Mateus" mostrou o resumo
   exato escrito pelo tutor ("Mateus contou os dinossauros com bastante
   atenção e conseguiu sozinho, sem precisar de ajuda extra."). Busca por
   texto na página inteira confirmou que a nota interna de teste
   ("NOTA INTERNA CONFIDENCIAL…") **não aparece em lugar nenhum**.

**Nenhum erro de console/JS apareceu em nenhuma etapa.** Os dados de teste
("Contar dinossauros — teste E2E" e a sessão de 08/07/2026) ficaram no projeto
Supabase real — perguntar a Marcus se quer manter como exemplo vivo ou limpar.

## 8. Sprint 2 — Modo Criança bonito (2026-07-08/09)

Decisão de ordem confirmada por Marcus antes de começar: **nenhum trabalho
visual até a corrente ponta a ponta estar fechada e testada com dado real**
(§7 já cobria isso). Com a Sprint 1 fechada, esta rodada tocou **só**
`pages/modo-crianca.html`, `js/pages/modo-crianca.js`,
`js/data/moldes-registro.js`, `js/data/modo-crianca-stub.js` e
`js/pages/moldes/contar.js` — nada em Supabase/Auth/RLS/`sessions`/
`child_activities`/`atividade_execucao`, e nada no hub adulto além do que já
estava (o retorno pra aba Sessões é da Sprint 1).

**O que mudou:**

- **Acolhimento curto e genérico.** A saudação deixou de ser autorada por
  molde (`acolhimentoTitulo` foi removida de `MOLDES_REGISTRO`) e virou uma
  constante da casca: "Oi! Vamos fazer uma missão curtinha?". O que muda por
  atividade é só a etiqueta `missao` (novo campo no contrato, ex.: "Missão:
  Contar dinossauros"), derivada de `molde.tituloPadrao(temaLabel)`.
- **"Missão X de Y".** Um badge no topo do palco mostra a rodada atual contra
  o total configurado pelo tutor (`config.rodadas`) durante os estados
  `atividade`/`feedback`. É a mesma ideia visual da trilha futura (Sprint 4),
  mas usando um dado que já existe (rodadas de uma atividade), sem inventar
  estrutura de trilha nenhuma.
- **Encerramento.** Título trocou de "Atividade concluída!" para "Missão
  concluída!"; o botão final ficou "Voltar para o tutor" (ou "Voltar para o
  responsável", calculado por `authSession.profile.role` — hoje sempre
  tutor, já que o responsável ainda não tem entrada na UI, ver §5).
- **Confirmação antes de encerrar.** "Encerrar atividade" no menu do adulto
  não encerra mais na hora — abre uma segunda tela na mesma folha ("Essa
  parte é para o adulto. Deseja encerrar a atividade agora?" + Cancelar/Sim,
  encerrar), reduzindo saída acidental sem exigir senha. Cancelar/fechar a
  folha sempre volta pro estado normal (nunca reabre já em confirmação).
- **Visual "espacial calmo".** Fundo com glow sutil e **estático** (radial-
  gradient em roxo/dourado bem discreto), botões mais arredondados (pill),
  itens do molde `contar` maiores (92px) com uma micro-animação de "pop" ao
  marcar, ícone de feedback com entrada suave, título com `clamp()` pra
  mobile-first. Tudo dentro do `<style>` inline de `modo-crianca.html`
  (isolado do hub adulto, como já era).

**Decisão deliberada sobre o "clima espacial" (vale saber):** a referência
que o Marcus deu foi Duolingo (estrelas, planetas, movimento). O `CLAUDE.md`
§11 e os comentários de "trava sensorial" já no arquivo (`sempre claro, nunca
escuro de alto contraste`, `prefers-reduced-motion` zera toda animação) são
guia de acessibilidade cognitiva pro público autista — o usuário direto do
Modo Criança. Por isso a versão implementada é **sem** estrelas piscando,
sem gradiente animado, sem parallax: o "espacial" vira só um glow estático e
de baixa saturação. Se depois disso ainda parecer "sem graça" pertinho do
Duolingo de verdade, é uma conversa de produto (quanto de estímulo é
aceitável), não um ajuste técnico — sinalizar antes de adicionar movimento.

**Verificação ao vivo (2026-07-09):** dev server caiu junto com um desligamento
de PC no meio da Sprint 2 (arquivos já estavam salvos em disco, sobreviveram
normalmente — só o processo do `npm run dev` e a sessão logada no navegador
precisaram ser refeitos). Religado o servidor, testado de novo contra o
Supabase real com uma atividade nova ("Contar dinossauros — Sprint 2 visual",
2 itens, 2 rodadas):

- Acolhimento renderizou exatamente "Oi! Vamos fazer uma missão curtinha?" +
  "Missão: Contar dinossauros" + fala pequena, sobre o novo fundo.
- Badge mudou corretamente "Missão 1 de 2" → "Missão 2 de 2" entre as rodadas.
- Sheet do adulto → "Encerrar atividade" → tela de confirmação → "Cancelar"
  voltou ao normal sem encerrar nada (testado explicitamente).
- Encerramento mostrou "Missão concluída!", resumo com plural certo ("2
  vezes"), botão "Voltar para o tutor".
- Voltar navegou pra `tutor.html?view=record&tab=sessions` de novo, e a nova
  execução apareceu em "Usar esta execução" — a ponte com a Sprint 1 continua
  intacta.
- **Nenhum erro de console em nenhuma etapa.**

**Observação de higiene de dados (não é bug da Sprint 2):** a lista de
execuções pendentes de Mateus mostrou **2** itens idênticos na tela
("Contar · Dinossauros · nível 1") depois deste teste, quando o esperado era
1 (a nova). A UI não mostra id/timestamp pra diferenciar, e não há acesso
direto ao SQL Editor nesta sessão pra investigar a fundo — pode ser só
acúmulo de dado de teste das duas rodadas de teste (Sprint 1 + Sprint 2)
sobre a mesma criança fictícia. Vale conferir com uma query em
`atividade_execucao` (`where child_id = '<id do Mateus>' and session_id is
null`) na próxima vez que estiver no SQL Editor — não bloqueia a Sprint 2
(a lógica de gravação em si já está reprovada como correta desde a Sprint 1).

**Não fizemos (fora do escopo combinado):** segundo molde (`identificar`),
qualquer trilha navegável, login/ranking/pontos/loja pra criança, mudança em
`internal.css`/`styles.css` do hub adulto.

## 9. Sprint 2.5 — Fechar Atividades Preparadas (2026-07-09)

Antes de qualquer visual novo (Modo Criança bonito já fechou a Sprint 2; o
próximo molde ainda não começa), esta rodada fechou o **ciclo operacional**
de Atividades Preparadas: criar, revisar, executar, reutilizar e organizar
sem o tutor se perder. Só tocou `js/pages/tutor.js`,
`js/data/child-activities.js`, `js/data/atividade-execucao.js` e
`pages/tutor.html` — nada em Modo Criança, moldes, Supabase/Auth/RLS além de
duas colunas de update já previstas no schema (ver abaixo).

**Investigação da higiene de dados (pendência da Sprint 2, §8):** resolvida
sem precisar de SQL Editor — a tela enriquecida (item abaixo) já mostra
data/hora de cada execução, e revelou que as "2 execuções idênticas" eram na
verdade duas execuções **genuinamente diferentes** ("teste E2E" às 21:32,
registrada, e outra às 21:43, ainda pendente) — sobra de reexecuções
manuais durante o QA da Sprint 1, não um bug de gravação duplicada. Card
encerrado.

**O que mudou:**

- **"Usar esta execução" ganhou contexto de verdade.** Antes: só
  `"Contar · Dinossauros · nível 1"`. Agora: título da atividade, nível +
  itens + rodadas, e "Feita hoje às 14:32 · Concluída · 8s" — dá pra
  diferenciar duas execuções do mesmo molde/tema sem adivinhar. Isso exigiu
  uma mudança pequena na consulta (`listPendingExecucoes` em
  `atividade-execucao.js` agora embute `child_activities(titulo, config)`
  pelo FK `child_activity_id` — leitura a mais, nenhuma tabela/coluna nova).
- **Ações na tabela de atividades preparadas.** Cada linha ganhou, além de
  "Fazer com a criança": **Duplicar** (pré-preenche o form com "(cópia)" no
  título, foco automático nele, tutor decide o que muda e salva como
  atividade nova — não cria nada sozinho), **Editar** (mesmo form, vira
  "Salvar alterações", faz `UPDATE` na linha de origem via
  `updateChildActivity`) e **Arquivar** (confirmação nativa + `UPDATE
  status='archived'` via `archiveChildActivity` — o valor já existia no
  `check` constraint da Fase 4B, não precisou migração). Sem "Excluir", como
  combinado — uma atividade pode ter execução/sessão vinculada.
- **Três blocos com rótulo na aba Atividades preparadas:** "1 · Preparar
  atividade", "2 · Atividades salvas", "3 · Últimas execuções" — mesma
  estrutura de antes, só nomeada, pra deixar o ciclo visível sem redesenhar
  nada.
- **"Últimas execuções" (bloco novo, só leitura).** Mostra as últimas 5
  execuções do Modo Criança pra essa criança — pendentes ou já registradas —
  com um selo "Registrada"/"Aguardando registro". A ação "Usar esta
  execução" continua exclusiva da aba Sessões (é lá que o registro nasce);
  este bloco é só orientação, pra o tutor ver o que a criança andou fazendo
  sem trocar de aba.
- **Estados vazios e de erro.** "Nenhuma atividade preparada ainda" agora
  cita o nome da criança. "Execuções pendentes" e "Últimas execuções" nunca
  mais desaparecem silenciosamente quando vazios — mostram a frase que
  explica o que vai aparecer ali. A tabela de atividades preparadas agora
  distingue **erro** de carregamento (com botão "Tentar novamente") de
  **vazio de verdade** — antes os dois caíam no mesmo estado, escondendo uma
  falha real atrás de uma mensagem de "ainda não tem nada".

**Detalhe de implementação que vale registrar:** os seletores de
molde/tema/config (`makeChoiceButtons`, `makeSlider`, `makePillSelector` em
`tutor.js`) não tinham como ser preenchidos programaticamente — só reagiam a
clique. Duplicar/Editar precisavam disso pra pré-preencher o form, então os
três ganharam um `setValue()` que reusa o mesmo caminho do clique (mesmo
efeito colateral, incluindo disparar `onChange` pra reconstruir tema/config
em cascata). Testado que o clique manual (fluxo de criação normal) continua
funcionando idêntico depois da mudança.

**Verificação ao vivo (2026-07-09):** todas as ações testadas contra o
Supabase real (mesmo projeto de teste, criança "Mateus"): Editar mudou
rodadas de 3→4 e persistiu depois de recarregar a página; Duplicar criou uma
6ª atividade a partir de uma existente (badge da aba foi de 3 para 4);
Arquivar removeu a cópia da lista ativa (badge voltou pra 3) com o diálogo de
confirmação certo; Cancelar edição voltou o form pro estado de criação limpo;
o fluxo de criação normal (do zero, sem Duplicar/Editar) continuou
funcionando depois do refactor dos seletores. **Nenhum erro de console em
nenhum dos testes.**

**Pendência nova, não bloqueante:** o volume de dado de teste em Mateus
cresceu mais nesta rodada (mais uma atividade duplicada/arquivada, mais uma
"criação normal pós-refactor"). Segue a mesma pergunta em aberto desde a
Sprint 1 — perguntar a Marcus se quer um script de limpeza ou se mantém como
exemplo vivo.

**Não fizemos (fora do escopo combinado):** segundo molde, trilha, "ver
atividades arquivadas"/desarquivar (arquivar é só pra sair da lista ativa —
reverter isso não foi pedido), qualquer coisa em `internal.css`/`styles.css`
do hub adulto.

## 10. Sprint 3 — segundo molde: `identificar` (2026-07-09)

Prova que faltava: a arquitetura de "casca + molde" aguenta mais de uma
atividade sem tocar o resto do sistema. `identificar` saiu de
`disponivel: false` e roda de ponta a ponta no mesmo ciclo que `contar` —
mesmo tutor, mesma criança, mesma tela de registro, mesmo `get_family_sessions`.

**Nada de Supabase/RLS mudou.** `child_activities.molde` já tinha
`identificar` no `check` constraint desde a Fase 4B
(`check (molde in ('identificar', 'contar', 'comparar', 'associar'))`) —
zero migração necessária, só código.

**Arquivos tocados:** `js/data/moldes-registro.js` (registro do molde),
`js/pages/moldes/identificar.js` (novo — o molde em si), e duas linhas em
`js/pages/modo-crianca.js` (registrar o molde em `MOLDES`, e uma extensão de
contrato — ver abaixo). **`js/pages/tutor.js` não precisou de nenhuma
mudança** — o form de composição, a tabela de atividades preparadas, "Usar
esta execução" e "Últimas execuções" (Sprint 2.5) já eram genéricos o
suficiente pra funcionar com qualquer entrada de `MOLDES_REGISTRO`. Esse é o
payoff de ter feito a Sprint 2.5 antes: o segundo molde não teve que abrir
essas telas de novo.

**Interação:** "Toque no número 3." — a criança vê de 3 a 5 números grandes
(config `opcoes`, ajustado pelo `nível` genérico) e toca no que bate com a
instrução. Alvo e distratores são sorteados a cada rodada dentre 1 e
`maiorNumero`. Errar não avança nem encerra nada — só um tremor calmo de
300ms no botão errado, e a criança tenta de novo na mesma rodada (mesma
decisão pedagógica do `contar`: só acerto conta pra rodada).

**Extensão de contrato (pequena, aditiva, não quebra `contar`):** `mount()`
agora pode devolver `{ avaliar, instrucao }` em vez de só `{ avaliar }`. Isso
existe porque o `identificar` sorteia o alvo a cada rodada — a instrução que
a criança lê muda toda vez ("Toque no número 3" → "Toque no número 1"...),
então não dá pra ser um texto estático do `child_activities.instrucao` como
no `contar`. `render()` em `modo-crianca.js` agora prioriza
`activeMold?.instrucao` sobre `contract.instrucao` quando o molde devolve
algo; `contar` nunca devolve, então continua lendo do contrato exatamente
como sempre. O campo `instrucaoPadrao` do `identificar` no registro
(`"Toque no número que eu disser."`) é só o texto que aparece no form do
tutor pra revisar/editar — não é o que a criança vê de verdade.

**Verificação ao vivo (2026-07-09):** criada "Identificar números — teste
Sprint 3" (maior número 5, 4 opções, nível 1, 3 rodadas) contra o Supabase
real. Prévia no iframe já mostrou a instrução dinâmica certa antes mesmo de
salvar. No Modo Criança real: acolhimento com "Missão: Identificar números",
rodada 1 pedindo "Toque no número 2" — toquei errado (1) primeiro de
propósito e confirmei que o estado **não avançou** (`atividade` intacto,
sem perder a rodada), depois toquei certo e o feedback avançou normalmente
("Missão 2 de 3"). Completadas as 3 rodadas, "Missão concluída!", resumo
"Vocês encontraram os números certos, 3 vezes.", "Voltar para o tutor"
navegou de volta pra `tutor.html?view=record&tab=sessions`. A execução
apareceu em "Usar esta execução" com o mesmo formato rico da Sprint 2.5
("Identificar números — teste Sprint 3 · Nível 1 · 3 rodadas · Feita hoje às
17:46 · Concluída · 6s" — sem "itens", porque `identificar` não tem esse
campo de config, e a tela lida bem com isso sem hardcode). Registrei a
sessão vinculando essa execução; logado como responsável, "Sessões de
Mateus" mostrou "Última atividade: Identificar números" e o resumo exato
escrito — sem nota interna. **Nenhum erro de console em nenhuma etapa.**

**Não fizemos (fora do escopo combinado):** trilha, ranking/pontos/streak/
loja/login infantil, temas de `identificar` além de números (cores/formas/
letras ficam pra quando fizerem falta), qualquer coisa em
`internal.css`/`styles.css` do hub adulto.

Com `contar` e `identificar` funcionando lado a lado no mesmo ciclo, o
Cognita deixou de ser "uma demo de uma atividade só" — a arquitetura de
moldes está provada.

## 11. Sprint 4 — Plano do Tutor / trilha simples (2026-07-09)

Objetivo: a aba Plano deixa de ser um placeholder genérico ("Objetivo /
Etapa atual / Critério de avanço" com texto fixo e um botão "Sugerir ajuste"
que só revelava uma nota de "em breve") e passa a mostrar uma trilha real —
**do tutor, não da criança**. A criança nunca escolhe fase; no Modo Criança,
no máximo aparece "Missão X de Y" (Sprint 2), que já é rodada dentro de UMA
atividade, não navegação entre etapas do plano.

**Trilha fixa em JS, sem tabela nova ainda** (`PRIMEIROS_NUMEROS` em
`tutor.js`), 5 etapas usando só os dois moldes que já existem:

1. Identificar números de 1 a 5 (`identificar`)
2. Contar objetos até 5 (`contar`)
3. Identificar números de 1 a 10 (`identificar`)
4. Contar objetos até 10 (`contar`)
5. Revisão calma (`contar`, config mais leve)

Cada etapa carrega título + objetivo curto + molde/tema/config/instrução
sugeridos — os mesmos campos de uma `child_activity`.

**Status sem tabela nova.** Cruza dado que já existia: `listChildActivities`
(o que já foi preparado) com `getCycleSessions` (quais `child_activity_id`
já viraram sessão registrada). Bate por molde+tema+"número-chave" da config
(`maiorNumero` pro identificar, `quantidade` pro contar) — aproximado de
propósito, não é vínculo formal ainda. Resultado: **concluída** (preparada e
já com sessão), **em andamento** (preparada, aguardando sessão — ou a
primeira etapa ainda não concluída, mesmo sem nada preparado, pra sempre
haver um "próximo passo" visível), ou **a fazer**.

**"Preparar atividade desta etapa"** troca pra aba Atividades preparadas e
pré-preenche o form de composição com os dados da etapa — reaproveitando o
MESMO `prefillCompose` que já existia pra Duplicar/Editar (Sprint 2.5). Único
ajuste: `prefillCompose` ganhou um terceiro modo. Antes só distinguia
`asEdit` (Editar, atualiza a linha de origem) de "não-edit" (Duplicar,
sempre com "(cópia)" no título). Agora tem `asCopy` separado: Duplicar usa
`{ asCopy: true }` (mantém o sufixo), vindo do Plano usa `{}` (nem edit nem
cópia — título como veio, sem sufixo, porque não é cópia de nada). O tutor
sempre revisa e decide salvar; nada é criado sozinho.

**Ajuste necessário para a etapa "1 a 10":** o campo `maiorNumero` do
`identificar` (Sprint 3) tinha `max: 5` — escopo deliberado da Sprint 3 ("só
números de 1 a 5"). Subiu pra `max: 10` só no registro
(`js/data/moldes-registro.js`); `identificar.js` já era genérico o
suficiente (sorteia entre 1 e `maiorNumero`, o que quer que seja) e não
precisou de nenhuma mudança de lógica. Efeito colateral pequeno: o seletor de
pills passou a ter até 8 botões numa linha só, então `.pill-select-row`
ganhou `flex-wrap: wrap` (não tinha antes) — beneficia esse campo e qualquer
outro parecido no futuro.

**Verificação ao vivo (2026-07-09):** a trilha carregou contra o Supabase
real e o cálculo de status **acertou usando dado de teste que já existia**,
sem eu montar cenário nenhum pra isso: "Identificar números de 1 a 5"
apareceu **Concluída** (tinha uma atividade da Sprint 3 com `maiorNumero: 5`
já registrada em sessão) e "Contar objetos até 5" apareceu **Em andamento**
(tinha uma atividade com `quantidade: 5` preparada, mas sem sessão ainda) —
as outras três, sem match, "a fazer". Cliquei "Preparar atividade desta
etapa" em "Identificar números de 1 a 10": trocou pra aba Atividades
preparadas, pré-preencheu molde/tema/config/instrução/título certos (prévia
no iframe já mostrando "Maior número: 10" funcionando), salvei, badge foi de
5 pra 6. Abri a atividade recém-criada no Modo Criança de verdade: alvo
sorteado (7) e as 5 opções ([7,9,5,10,4]) todas dentro do intervalo 1–10,
confirmando que o range estendido funciona ponta a ponta. Não repeti o
resto do ciclo (execução → registro → responsável) pra essa atividade
específica porque é o mesmo mecanismo já provado nas Sprints 1 e 3, sem
nenhum caminho novo de código no meio. **Nenhum erro de console em nenhuma
etapa.**

**Não fizemos (fora do escopo combinado):** trilha navegável pela criança,
molde `comparar`/`associar`, abertura pelo responsável, IA adaptativa,
dashboard com gráficos, redesign geral, tabela nova de plano/progresso
(fica pra quando a inferência por molde+tema+config não bastar mais).

## 12. Fechamento — V2 Core RC1 (2026-07-09)

Com a Sprint 4, o Cognita fechou o que vale chamar de **ciclo de
aprendizagem guiada**, não só "atividade solta → criança faz → tutor
registra":

```
Plano do tutor → preparar atividade sugerida → Modo Criança → execução salva
→ sessão registrada → família acompanha
```

Antes desta fase o produto tinha ferramentas soltas (hub, Modo Criança,
atividades). Agora tem uma lógica que se sustenta sozinha: **tutor conduz,
criança executa, sistema registra, família entende.**

### Checklist de fechamento

- [x] Sprint 4 commitada (Marcus, `ee27006 Ajustando 4.0 fase`) — sem tag
  própria, incorporada na tag `v2-core-rc1` desta seção.
- [x] Fluxo completo re-testado do zero contra o Supabase real, reusando
  Mateus: Plano → "Revisão calma" (etapa até então intocada) → preparar →
  salvar → Modo Criança de verdade → concluir → voltar → registrar sessão →
  responsável vê o resumo. Todos os elos passaram.
- [x] Console sem erro confirmado em cada etapa — só um "Failed to fetch"
  transitório durante um refresh automático de token do Supabase no
  primeiro login do teste (rede, não código; as chamadas seguintes e o
  resto do fluxo rodaram limpos).
- [x] Mobile do Modo Criança conferido (emulação iPhone 13): acolhimento,
  badge de missão, molde `contar` — tudo bem proporcionado, sem estouro
  horizontal, botões grandes o bastante pro dedo.
- [x] Mobile das abas Atividades/Plano conferido — **achado real, registrado
  como limitação conhecida, não corrigido agora** (decisão consciente,
  Marcus escolheu adiar pra Sprint 5): em telas ≤940px o `.rail` (menu
  lateral) já tinha uma regra CSS pra sumir da tela
  (`position:fixed; left:-260px`), mas **nunca existiu um botão/hambúrguer
  nem JS pra reabri-lo**. Um usuário real no celular fica preso na tela
  "Início", sem conseguir alcançar o registro de uma criança, Atividades ou
  Plano pela interface — só reproduzi essas telas no teste porque acessei
  via URL direta (`?view=record&tab=plan`), o que um usuário real não faria.
  Essa lacuna é anterior a esta rodada (não foi introduzida pela Sprint 4);
  fica para a Sprint 5 resolver (um toggle simples já resolveria). O
  conteúdo em si, quando alcançado, se comporta razoavelmente em mobile
  (cards empilham, pills quebram linha) — o problema é só a navegação.
- [x] Decisão sobre dado de teste em Mateus: **mantido como está**, vira a
  base do roteiro de demo (§13) — histórico real com os dois moldes,
  sessões, e etapas do Plano em três status diferentes (concluída/em
  andamento/a fazer) ao vivo, sem precisar montar cenário nenhum.
- [x] `V2-DIRECAO.md` atualizado com este status (aqui) e a limitação
  consciente do Plano (abaixo).
- [x] Roteiro de demo criado — ver `docs/ROTEIRO-DEMO.md`.

### Limitação consciente registrada (Plano)

O progresso da trilha "Primeiros Números" ainda é **inferido** — cruza
`child_activities` (molde+tema+um número-chave da config) com
`sessions.child_activity_id`, sem nenhum vínculo formal entre etapa do
plano, atividade e sessão. Isso é aceitável pra um plano fixo e só dois
moldes. **Quando existir mais de um plano, personalização real de trilha por
criança, ou histórico longo o bastante pra a inferência ficar ambígua, vai
precisar de um vínculo formal** (provavelmente uma coluna
`plano_etapa_id`/tabela de progresso) — não é urgente agora, só registrado
pra não ser esquecido.

### O que fica pra depois do visual (Sprint 5) — sem exceção

`comparar`/`associar`, trilha navegável pela criança, responsável abrindo o
Modo Criança, IA adaptativa, dashboard com gráficos. A Sprint 5 é só
acabamento (consistência do hub, Plano/Atividades mais limpos, Modo Criança
mais encantador, responsividade, microcopy) — nenhuma feature nova entra no
meio dela. O toggle de menu mobile, listado aqui como pendência do RC1, virou
a Sprint 5A abaixo — a única peça de "acabamento" tratada como prioridade 1
por ser o único bloqueio real de uso, não só estética.

## 13. Sprint 5A — Navegação responsiva do Hub (2026-07-09)

Primeiro trabalho da fase visual, e o único tratado como "sem discussão": o
menu lateral (`.rail`) já tinha uma regra CSS pra sumir da tela em ≤940px
(achado do RC1, §12), mas não existia como reabri-lo — o tutor no celular
ficava preso na tela Início. Fechado com um drawer padrão: hambúrguer no
topbar, `.rail` desliza de `left:-280px` pra `left:0`, backdrop escurecido
atrás, fecha ao tocar fora, no Escape, ou ao escolher qualquer link/botão do
menu.

**Só tocou `pages/tutor.html`** (CSS do drawer + a marcação do botão e do
backdrop) **e `js/pages/tutor.js`** (abrir/fechar). Nada de Supabase, nada
de Modo Criança, nada nos outros paineis (Sessões/Atividades/Plano) — eles já
se comportavam bem em mobile, só não eram alcançáveis pela navegação.

**Decisões de implementação:**

- **Backdrop dedicado** (`.rail-backdrop`, não reusa o `.drawer-backdrop` do
  drawer de suporte "Falar com equipe") — são dois overlays independentes,
  cada um com seu próprio z-index, pra não acoplar o estado de um ao do
  outro.
- **`width` explícito no `.rail` em mobile** (`min(280px, 84vw)`) — antes,
  fora do fluxo do grid (`position:fixed`), o rail encolheria pro conteúdo em
  vez de manter uma largura de drawer consistente.
- **Fechar ao escolher uma página é um único listener delegado** no próprio
  `.rail` (`click` em qualquer `a`/`button` dentro dele fecha o drawer) — não
  precisou tocar nos handlers já existentes de Início/criança/Biblioteca/
  Sessões/equipe/perfil, cada um continua fazendo exatamente o que já fazia.
- **Foco:** abrir o drawer manda o foco pro primeiro link do menu; fechar por
  Escape/backdrop/toggle devolve o foco pro botão hambúrguer; fechar por ter
  escolhido um link não força o foco de volta (a navegação escolhida já leva
  o foco pra outro lugar sozinha).
- **Scroll travado atrás do drawer:** `body.rail-drawer-open #main-content {
  overflow: hidden }` — o body já era `overflow:hidden` por padrão (quem rola
  de verdade é `#main-content`), então travar o conteúdo era só isso.
- **Desktop:** o botão hambúrguer é `display:none` fora da media query de
  940px — em telas largas ele nem existe visualmente, `.rail` continua
  `position:static` dentro do grid, exatamente como antes.

**Verificação ao vivo (2026-07-09):** testado com emulação de iPhone 13.
Abrir o menu, entrar em Mateus (drawer fecha sozinho), navegar por Plano →
Atividades preparadas → Sessões (todas alcançáveis agora, antes só via URL
direta), Escape fecha o drawer, clique no backdrop fecha o drawer — tudo
confirmado via bounding box do rail (`x:0` aberto, `x:-280` fechado) e não só
por screenshot. Sem estouro horizontal (`body.scrollWidth === innerWidth`
em todos os casos). Testado também em 1440px: `aria-expanded`/toggle
`display:none`, `.rail` `position:static`, grid `212px 1fr` — desktop
bit-a-bit igual a antes.

**Não corrigido nesta rodada (ficaria pra depois — ver §14 sobre o que foi e
não foi coberto):** algumas fileiras horizontais (a barra de abas, a linha
de botões de ação do cabeçalho) continuam roláveis sem indicação visual de
que há mais conteúdo pro lado — não travam a página (cada uma rola só
dentro de si), mas não "convidam" o dedo a arrastar. É acabamento, não
bloqueio.

## 14. Sprint 5.2 — Consolidação visual do hub (2026-07-09/10)

Objetivo: "fazer tudo parecer parte do mesmo produto" sem criar um design
system novo — centralizar tokens que já existiam de fato (espalhados,
quase-iguais) e reduzir exceções, não inventar camada nova. **Escopo: só
`pages/tutor.html` + os pontos de `js/pages/tutor.js` que precisaram mudar
junto** (o `.btn-bad` novo). `responsavel.html`, `admin.html`,
`perfil-crianca.html`, `atividades.html` e o site público **não foram
tocados** — a conversa inteira desta fase girou em torno de `tutor.html`
(é onde viveram as Sprints 1-5A), então é onde a inconsistência acumulada
de verdade estava. Se a intenção era um escopo maior, sinalizar.

**Achado que valeu a pena procurar: um bug de verdade, não só estética.**
`.pending-execucao-item` estava definido **duas vezes** no CSS — a versão
nova (Sprint 2.5, `display:grid`, pensada pra empilhar título/detalhes/
rodapé/botão em linhas separadas) e uma versão **morta**, sobrevivente de
antes da Sprint 2.5 (`display:flex`), mais abaixo no arquivo. Como as duas
regras têm a mesma especificidade, a que vem depois no arquivo ganha —
então o card de execução pendente estava renderizando **em uma única linha
com `justify-content:space-between`**, não empilhado como o design pretendia
e como eu tinha reportado nas Sprints 2.5/3/4 (o texto cabia numa linha só
por coincidência de largura, então passou despercebido nos screenshots
anteriores). Removida a regra morta; conferido via `getComputedStyle` antes
e depois (`display: flex` → `display: grid`) e visualmente — agora empilha
título → detalhes → rodapé → botão, como sempre devia ter sido.

**Tokens novos em `:root`, todos aditivos (nada que já existia mudou de
nome):**

- `--sp-1` a `--sp-8` (4/8/12/16/24/32px) — escala de espaçamento. Aplicada
  nos contêineres estruturais de maior repetição (`.record`, `.panel`,
  `.tabs`, `.card-h`, `.card-b`, `.cols`, `.stack`, `.row`/`.row3`,
  `.form-body`). **Não reescrevi cada padding do arquivo** — paddings
  pequenos e pontuais em torno de ícones (7px, 9px, 11px) ficaram como
  estavam, porque são ajuste óptico fino, não "ritmo de layout"; forçar
  tudo pra escala aí só trocaria uma arbitrariedade por outra.
- `--label-sm-size` (.7rem) / `--label-sm-tracking` (.07em) — a tier
  "label pequena" que Marcus pediu. Existiam **7 variações** quase-iguais
  do mesmo papel visual (eyebrow/kicker/rótulo maiúsculo, peso 700): .62,
  .64, .66, .68, .69, .7, .71, .8rem espalhadas em `.rail-group`,
  `.home-head/.profile-head .kicker`, `.home-stat .lbl`, `.lvl`,
  `.status-kicker`, `.quote-eyebrow`, `.pending-execucoes-label`,
  `.internal-note-label`. Convergidas todas nos dois tokens (cor e
  `text-transform` continuam por conta de cada seletor — `.quote-eyebrow`
  continua com `--accent`, os outros com `--muted`).
  **Exceção deliberada:** `.internal-note-label` ganhou o tamanho mas
  **não** ganhou `uppercase` — o texto ali é a frase inteira "A família
  nunca tem acesso a esta nota", não um rótulo de 1-2 palavras, e maiúsculo
  numa frase inteira piora a leitura (label pequena ≠ frase em caixa alta).
- **`--muted` escurecido** de `#8a8391` para `#756c7d` — o original tinha
  contraste ~3.3:1 contra `--canvas`/`--card`, abaixo do mínimo de 4.5:1 do
  WCAG AA pra texto normal (e é usado em texto de .7-.86rem, bem abaixo do
  piso de "texto grande" que aceitaria 3:1). Novo valor: ~4.6:1. Um token
  só, corrige em todo canto que já usava `var(--muted)` — é exatamente o
  tipo de correção que só vale a pena fazer centralizada.

**Título de página unificado:** `.home-head h1` (era 1.55rem) e
`.profile-head h1` (era 1.35rem) — mesmo papel conceitual ("título da
página"), agora ambos 1.5rem. `.rec-name` (nome da criança no cabeçalho do
registro) **ficou intencionalmente maior** (1.7rem) — é tratado como
identidade/hero da tela, não só título, então não faz sentido igualar aos
outros dois. `.card-h h3` (título de card, .8rem maiúsculo) já era uma
única definição usada em todo canto via `card-h`/`simpleHead()` — não
precisou de ajuste, era o tier "título de card" já funcionando certo.

**Componente novo: `.btn-bad`.** Não existia uma variante de botão
destrutivo/atenção — "Arquivar" usava `.btn-ghost`, visualmente idêntico a
"Duplicar"/"Editar" na mesma linha, apesar de ser uma ação diferente
(tira a atividade da lista ativa). Adicionado `.btn-bad` (ghost tingido de
`--bad`/`--bad-soft`, não sólido — ainda é uma ação secundária na
hierarquia da linha, só sinaliza cuidado) e aplicado só em "Arquivar" —
"Fazer com a criança"/"Duplicar"/"Editar" continuam `.btn-ghost` neutro.

**O que foi auditado e considerado já correto (não mexido):**

- **Laranja (`--accent`):** só dois usos fora do botão primário — a "prévia
  pra família" no perfil do tutor (um card específico, não repetido) e seu
  eyebrow. Nenhum "5 cards iguais com laranja" pra corrigir.
- **Alturas de botão equivalente:** `.rail-toggle` e `.search` já eram os
  dois 34px (convivem lado a lado no topbar) — a leitura inicial de que
  `.rail-toggle` estava desalinhado era falsa, os dois já batiam.
  `.icon-btn` (32px) é usado só no fechar do drawer de suporte, um contexto
  isolado que não fica ao lado de nada em 34px — não é uma inconsistência
  visível, deixado como está.
- **Sombras:** já seguem um padrão implícito razoável (cor tingida de
  brand/ink pra a maioria, tingida de accent só no botão de accent) —
  proporcional ao tamanho do elemento flutuante (drawer > modal cmdk >
  botão). Não é uma "escala de elevação" formal, mas também não é caótico;
  formalizar isso agora seria começar a construir o tal design system
  grande que não era o objetivo.
- **Estado vazio (`.empty-state`) vs `.execucoes-msg`:** são dois
  tratamentos diferentes de propósito, não uma inconsistência — `.empty-
  state` (com mascote ilustrado) é pra área grande/principal vazia (ex.:
  nenhuma atividade preparada ainda); `.execucoes-msg` é texto simples pra
  dentro de uma lista já pequena (execuções pendentes/recentes), onde um
  estado ilustrado ficaria pesado demais pro espaço.
- **Input/textarea:** `.field input/textarea` é o padrão; `.internal-note
  textarea` não tem borda própria de propósito (já vive dentro do
  contêiner com borda de `.internal-note` — não é um campo "solto").

**Verificação visual (2026-07-10):** desktop (1440px) e mobile (iPhone 13)
conferidos em Início, Visão geral, Sessões (com a lista de pendentes já
empilhada corretamente), Atividades preparadas (com "Arquivar" agora visualmente
distinto), Plano e Meu perfil. `getComputedStyle` confirmou o fix do bug
(`display: grid`, `padding: 10px 12px`). Sem estouro horizontal no mobile,
sem erro de console em nenhuma tela.

**Não fizemos:** consolidação de `responsavel.html`/`admin.html`/
`perfil-crianca.html`/`atividades.html`/site público (fora do escopo desta
rodada), unificação exaustiva de todo texto "normal"/"auxiliar" do arquivo
(dezenas de tamanhos entre .74rem-.92rem — os piores casos de repetição
(label pequena) foram resolvidos; ir atrás de cada parágrafo individual
teria custo alto pra ganho marginal), e nenhuma escala de "elevação"/sombra
formal. Próxima: Sprint 5.3, base visual do Modo Criança — Marcus já sinalizou
que essa vai precisar de mais atenção.

---

## 15. Trilha visual do Plano — "Constelação dos Primeiros Números" (2026-07-11)

**Importante — isto NÃO é a Sprint 5.3.** Antes da 5.3 (base visual do Modo
Criança) começar, Marcus trouxe uma direção de produto mais ampla: a
experiência de trilha navegável da criança (estilo Duolingo ABC — mapa de
missões, mascote andando pelo caminho) vai viver num **app mobile futuro**,
ainda não construído. Este site continua sendo a ferramenta do tutor: prever
visualmente as atividades, ministrar a trilha e validar como ela funciona na
prática antes de existir no app. Ver nota de direção equivalente também fora
deste documento (memória de projeto). Esta sprint transforma a aba **Plano**
do painel do tutor — que desde a Sprint 4 já era uma trilha fixa de 5 etapas,
só que em formato de lista — num mapa visual real, seguindo
`docs/PLANO-SPRINT-4-TRILHA.md` (spec enviada por Marcus com arquitetura,
SVG do caminho, mapeamento de assets e ordem de fases). Escopo: só
`pages/tutor.html` (novo `<link>`), `js/pages/tutor.js` (só o
`buildPlanPanel`), e 3 arquivos novos.

**Arquitetura (fiel à spec):**

- `js/data/planos-registro.js` — dado pedagógico. `PRIMEIROS_NUMEROS`,
  `STATUS_ETAPA`, `etapaBateComAtividade` e `computeStatusEtapas` saíram do
  `tutor.js` pra cá; o plano agora é `PLANOS_REGISTRO.primeiros_numeros`
  (objeto com `id`/`titulo`/`descricao`/`etapas[]`, cada etapa com `id`,
  `resumo` e `emblema` novos, além dos campos que já existiam). Inferência de
  status **não mudou** — mesma aproximação por molde+tema+"número-chave" da
  Sprint 4, só que `computeStatusEtapas` agora recebe o `plano` como
  argumento em vez de ler uma constante fixa.
- `js/components/trilha-plano.js` — componente puro (`renderTrilhaPlano`):
  não importa Supabase, não conhece ciclo, não navega. Recebe
  `{ plano, statuses, podePreparar, onPrepararEtapa }`, devolve o elemento.
  Estado interno: etapa selecionada. `buildPlanPanel` virou orquestrador
  fino — busca status real e liga "Preparar atividade" na mesma ponte de
  sempre (`prefillCompose`, via `onPrepararEtapa`) — nada mudou no fluxo
  Plano → Atividades preparadas → Modo Criança → execução → sessão.
- `css/trilha-plano.css` — só `.trail-*`, tokens `--trail-*` próprios no
  topo (derivando de `--accent`/`--ok` etc. quando existem). Importado só
  em `tutor.html`, nada entra em `internal.css`.

**Achado real durante o teste ao vivo (não só estética):** a seleção do nó
ficava **presa na 1ª etapa** mesmo depois do status real do Supabase
chegar. Causa: antes do `computeStatusEtapas` responder, o componente já
fazia uma seleção automática de fallback (etapa 1, tratada como
"em_andamento" por padrão); quando o status real chegava e apontava outra
etapa como a verdadeira "em andamento", o código tratava a seleção antiga
como se fosse escolha do tutor e não a atualizava. Corrigido separando
"seleção automática" de "seleção manual" (`selecaoManual`, só vira `true`
num clique de verdade) — agora cada atualização de status pode reapontar
pra etapa certa até o tutor escolher outra com um clique. Verificado via
Playwright: antes do fix a etapa selecionada por padrão era sempre
"Identificar 1-5" (índice 0) mesmo com Mateus tendo "Contar até 5" como
verdadeira etapa em andamento; depois do fix, seleciona a certa.

**Assets reais (Fase C) — auditados visualmente antes de mapear, não só por
nome de arquivo:**

- **Mascote:** `assets/gat-map.png` (gato com mapa/prancheta, sentado) →
  `planejar`, no cabeçalho. `assets/mascot-hero-wave.png` (acenando, já
  usado como hero em outras telas) → `guia`, encostado em cada nó
  `em_andamento`. `assets/sticker.png` (acenando, versão sticker) →
  `comemorar`, no painel de detalhes quando a etapa está concluída —
  **substituto temporário** até existir uma pose "comemorando de verdade"
  (braços pra cima), registrado como pendência.
- **Emblemas:** `assets - emblemas/counter.png` ("123") → `identificar`;
  `dinossaur.png` (3 dinossauros coloridos 1/2/3) → `contar` (bate com o
  tema real do molde, dinossauros); `star.png` (estrela+coração+setas
  circulares) → `revisar`. Substituem os SVGs inline em bloco/pontos/estrela
  usados como placeholder na Fase A.
- **Decoração espacial:** `assets - space/` tinha nomes em português e
  inglês trocados na prática — `comet.png` é visualmente uma **lua/asteroide**
  (rocha cheia de crateras) e `cometa.png` é o cometa de verdade (esfera +
  cauda). Mapeado pelo conteúdo real, não pelo nome do arquivo:
  `planet.png`/`planet2.png`/`planet1.png` → planeta roxo/azul/amarelo,
  `circular.png` → órbita decorativa, `luz.png`/`luzes.png`/`stars.png` →
  3 aglomerados de estrelas em densidades diferentes. 9 imagens no total,
  posicionadas em posições fixas nas margens do mapa (longe da faixa
  32%-68% onde ficam os nós), `aria-hidden` + `pointer-events:none`.
- **Otimização:** originais são todos 1254×1254px RGBA, 100KB-1.3MB **cada**
  (~10MB só de mascote+emblema+espaço somados). Instalado `sharp` como
  devDependency (só usado no script de conversão, não roda no navegador) e
  gerado `assets/trilha/{mascote,emblemas,espaco}/*.webp` — mascotes em
  480px/~25KB, espaço em 240px/~7KB, emblemas em 160px/~9KB. Pasta final:
  168KB pros 15 arquivos.

**Microinterações (Fase D)** — tudo dentro de
`@media (prefers-reduced-motion: no-preference)`: hover levanta o nó 2px,
seleção ganha um anel sutil (`box-shadow`, esse não é animado — aparece
instantâneo mesmo sob redução de movimento, só a transição é que se
desliga), check e mascotes (`guia`/`comemorar`) entram com fade+scale curto.
Verificado emulando as duas preferências via Playwright
(`page.emulateMedia`): sob `reduce`, o hover não desloca (`translateY`
ausente do `transform` computado) e `animationName` do mascote guia vira
`none`.

**QA (Fase E):**

- Prefill das 5 etapas conferido uma a uma via `.compose-summary` — cada
  uma joga molde/tema/config exatos no form (inclusive a etapa 5, que reusa
  molde `contar`+tema `dinossauros` das etapas 2/4 mas com config diferente
  — não houve confusão entre elas).
- Contraste: achado e corrigido — `.trail-status-pill--a_fazer` usava
  `--muted` sobre `--rail` (~4.44:1, abaixo do mínimo de 4.5:1 do WCAG AA).
  Trocado por `--ink-soft` (~7.27:1).
- Regressão: "Fazer com a criança" (link, não botão — `renderChildActivityRow`
  não foi tocado) continua abrindo `modo-crianca.html` com a atividade certa,
  zero erro de console em qualquer aba testada, desktop e mobile.

**Pendências registradas (não resolvidas agora):**

- Pose "comemorando" de verdade (braços pra cima) — `sticker.png` é
  substituto temporário, mesmo apontado já na spec original.
- `plano_etapa` formal em `child_activities` — a inferência de status ainda
  quebra se o tutor editar o número-chave da config depois de preparar a
  etapa (mesma limitação documentada desde a Sprint 4, não nova).
- Mapa navegável da criança — combinado que fica pro **app mobile futuro**,
  não pro site. O que existe aqui é só a versão do tutor.

**Commits:** wireframe funcional (Fase A), assets reais (Fase C),
microinterações (Fase D), fix de contraste (Fase E) — um commit por fase,
seguindo a spec ("uma fase por commit").

---

## 16. Correção — a trilha virou página própria, não card de dashboard (2026-07-11)

**O §15 acima descreve uma versão que não sobreviveu ao primeiro olhar real.**
Marcus testou a entrega da Sprint (mapa dentro da aba Plano, `.trail-map`
com `min-height: 420px`, nós entre 9%-91% da altura) e o diagnóstico foi
direto: *"você não desenhou uma trilha ruim; você colocou uma trilha
potencialmente boa dentro do recipiente errado."* Nós a menos de 100px de
distância vertical, três mascotes disputando atenção ao mesmo tempo
(cabeçalho, nó atual, card de etapa concluída), emblemas detalhados de 32px
dentro de nós de 72px virando miniatura sem função, decoração espacial como
9 figurinhas uniformes — tudo sintoma do mesmo problema: **jornada dentro de
um card baixo**.

**Correção estrutural (feedback completo do Marcus, 2026-07-11):**

1. **Separação de responsabilidade.** A aba Plano (painel do tutor) deixou
   de tentar mostrar o mapa inteiro — agora é um resumo de leitura rápida:
   título, "X de Y concluídas", próxima etapa, 5 marcadores
   `✓─✓─●─○─○` e dois botões ("Explorar trilha completa" / "Preparar
   próxima atividade"). O mapa de verdade virou **`pages/trilha.html`**, uma
   tela própria do tutor (`?cycle_id=<uuid>`), shell mínimo — sem rail, sem
   as 7 abas do painel, só voltar + título + progresso no topo.
2. **Escala.** Mapa com `min-height: 1250px` (era 420px), 5 nós com ~220px
   de distância vertical entre eles — "o Duolingo funciona porque a trilha
   é uma página que você percorre, não um diagrama que precisa caber
   inteiro." Nós de 96px (112px na etapa "atual"), emblema ocupando 70% do
   nó (antes 32px soltos, agora 64-78px de verdade).
3. **Concluída mantém o emblema.** Em vez de substituir a ilustração por um
   check genérico, a etapa concluída dessatura o emblema original + aro
   verde + check pequeno no canto — o tutor não perde a referência de qual
   missão é qual.
4. **Caminho segmentado.** 4 trechos de SVG (não 1 path de cor única), cada
   um colorido pelo estado do nó de destino: roxo suave = concluído, dourado
   = leva à etapa atual, lavanda pontilhada = futuro. Comunica progresso de
   verdade, não só a cor dos nós.
5. **Um só gato.** "O gato não é decoração. Ele é um personagem." Regra
   nova: no máximo um mascote visível no mapa inteiro. `trilha-plano.js`
   calcula a "etapa atual" (1ª não concluída, mesmo quando 2 etapas estão
   tecnicamente `em_andamento` ao mesmo tempo nos dados reais — acontece
   quando o tutor prepara mais de uma atividade adiantado) e só ela ganha o
   mascote-guia; quando tudo termina, o mascote-comemorar substitui o guia
   na última etapa. Removido o mascote do cabeçalho e o mascote extra no
   card ao selecionar uma etapa concluída — o card só muda de conteúdo.
6. **Decoração hierárquica.** 1 planeta grande parcialmente cortado no topo,
   elementos médios/pequenos no meio (lua, estrelas, cometa), 1 planeta
   médio-grande cortado perto da etapa final — não mais 9 figurinhas
   uniformes de 30-72px com a mesma opacidade.
7. **Mobile.** O painel de detalhes vira bottom sheet (mesmo padrão do
   `.support-drawer` que já existia em `tutor.html` pro "Falar com equipe",
   só que ancorado embaixo em vez do lado) — abre só num toque de verdade
   no nó, fecha via backdrop ou botão ✕. Nunca painel lateral apertado.

**Arquitetura:** `css/trilha-plano.css` foi descontinuado —
**`css/trilha.css`** é o único CSS novo que `pages/trilha.html` carrega
(Marcus pediu esse arquivo especificamente). `js/components/trilha-plano.js`
continua um componente puro (não sabe de Supabase, não navega sozinho), só
que agora sem cabeçalho próprio (título/progresso/voltar são do shell da
página) e com a lógica de "etapa atual" nova.

**Ponte "Preparar atividade" entre páginas:** como `trilha.html` é uma
página separada, não dá pra passar o objeto da etapa direto em memória.
Solução: `onPrepararEtapa` navega pra
`tutor.html?view=record&tab=activities&plan=<id>&step=<id>`; `bootstrap()`
em `tutor.js` lê esses dois parâmetros (mesmo padrão de `?view=&tab=` que já
existia pra volta do Modo Criança) e `renderRecord()` procura a etapa em
`PLANOS_REGISTRO` pelo id, chamando a mesma ponte `prefillFromPlano` de
sempre.

**Verificado ao vivo (Playwright):** resumo compacto com 5 pontos e
"próxima etapa" corretos; "Explorar trilha completa" abre `trilha.html` com
o `cycle_id` certo; mapa renderiza com exatamente 1 nó `--current` e 1
mascote, mesmo com 2 etapas `em_andamento` nos dados reais do Mateus; altura
do mapa 1250px; "Preparar atividade" na trilha volta pro painel com o form
pré-preenchido certo (`plan=primeiros_numeros&step=contar-1-5` → "Vai criar
Contar objetos até 5 — 5 itens, nível 1, 3 rodadas"); mobile sem overflow
horizontal, bottom sheet abre/fecha via toque e via backdrop; zero erro de
console em qualquer tela; `npx vite build` passa limpo com a página nova
registrada em `vite.config.js`.

**Pendências (continuam as mesmas do §15, mais uma):**

- Pose "comemorando" de verdade e `plano_etapa` formal — ver §15.
- Mapa navegável da criança fica pro app mobile futuro — ver §15.
- **Nova:** os 4 segmentos do caminho em `trilha-plano.js` têm coordenadas
  desenhadas à mão pro novo viewBox (`0 0 400 1000`) — se o plano crescer
  além de 5 etapas, isso precisa de um gerador de curvas, não mais 4
  segmentos fixos.

**Ajuste final (mesmo dia):** o mascote foi removido do mapa por completo.
Mesmo só um por trilha e bem menor que a versão original, ele ainda quebrava
a leitura do caminho entre os nós — Marcus viu a tela renderizada e cortou
na hora ("ele quebra o ciclo"). O mapa fica só path segmentado + nós +
decoração espacial; os webp de `assets/trilha/mascote/` foram removidos por
não terem mais uso. Personagem/narrativa visual fica pra outra hora, se
fizer sentido.
