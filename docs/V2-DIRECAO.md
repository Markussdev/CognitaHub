# Cognita Hub — Direção da V2 (Hub adulto + Modo Criança)

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
