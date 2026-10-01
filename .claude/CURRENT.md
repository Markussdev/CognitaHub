# Trabalho atual — preparação do mobile

Atualizado em 27/09/2026; seção "Visão da escola" acrescentada em 01/10/2026.

## Escopo desta alteração

Adaptar o contexto do Claude Code da main para a branch mobile.
Esta alteração é documental: não implementa telas, autenticação, atividades,
monetização ou mudanças de banco.

O histórico de refatoração do painel do tutor continua na main. Não usar aquela
fase ("apenas refatoração, sem comportamento") como objetivo deste trabalho.

## Estado observado

Base inspecionada: `feat/mobile-app`, commit
`0dbe1c749ea0db035e854ad049aba911d3e22c2a`.

- `apps/mobile/` possui package próprio, Capacitor e projeto Android.
- Entrada: `index.html → src/main.js → src/app.js`.
- O início atual exige sessão anônima e consulta o pareamento.
- Sem vínculo, mostra pareamento; com vínculo e sem jornada, mostra espera.
- O cliente Supabase é criado durante o import de `services/supabase.js`.
- Os moldes executáveis são `contar` e `identificar`.
- A conclusão da missão recebe callback; o fluxo conectado grava a execução.
- A entrada experimental descrita abaixo ainda não existe.

Confirmar novamente esses pontos se o código mudar. Esta inspeção não é teste
do APK nem validação do banco de produção.

## Próxima implementação proposta

Entrada imediata, conforme `docs/MOBILE.md`:

1. Apresentar "Experimentar uma atividade" e "Tenho um código", com acesso
   secundário à orientação para adultos.
2. Oferecer Contar e Identificar locais, com apresentação para o mediador,
   usando os executores existentes.
3. Inicializar a parte conectada somente ao conectar/retomar a jornada.
4. Manter conclusão experimental local, sem perfil infantil ou execução no banco.
5. Preservar sessão, vínculo e jornada no fluxo conectado; oferecer exploração
   quando não houver jornada ou quando a conexão falhar.
6. Tratar voltar e retomar no Android sem interromper a atividade.

Ainda pendentes: implementação, build mobile, teste sem configuração Supabase,
teste offline no APK e regressão do pareamento/conclusão conectada.
Não marcar nenhum desses itens como concluído apenas porque foi documentado.

## Depois desta etapa

Monetização institucional e atividades com novos apoios são direções em
discussão, não parte da entrada imediata. Ver a seção de próximos recortes em
`docs/MOBILE.md`. Já existe um protótipo de RevenueCat (Test Store) em
`services/revenuecat.js` e `screens/school-license.js`, alcançado só por
`?school=1` ou `VITE_SHIPATON_SCHOOL_DEMO`. Não inventar preço, plano
comercial validado ou aprovação pedagógica, nem ampliar esse protótipo por
consequência desta tarefa.

## Visão da escola na demo Cognita Escola — 01/10/2026

Escopo: pluralizar a vitrine institucional (antes só havia o Mateus). Detalhes e
limites em `docs/MOBILE.md` §6. Não faz parte da entrada imediata.

Feito (branch `shipaton-2026`, árvore de trabalho sem commit):
- `School overview` no workspace: métricas da escola demo, amostra de 6 de 24
  alunos, "Demonstration data" visível; Mateus abre o ecossistema
  (Tutor / Child / Family) e cada superfície volta a quem a abriu.
- Cartão do Mateus derivado do store; abre "Up to date" e vira "Session to
  review" ao concluir uma missão; volta ao normal quando o mediador registra a
  sessão. Contagem de missões, sem porcentagem, sem "on track".
- Botão voltar do Android na vitrine (`demo/school-back.js`).

Verificado:
- `npm --prefix apps/mobile run build`: passa, com as flags do `.env` local e com
  `VITE_SHIPATON_SCHOOL_DEMO` / `VITE_SHIPATON_CHILD_DEMO` vazias. Só o segundo
  prova o isolamento: com as flags ligadas o Vite elimina o ramo conectado e o
  chunk do `app.js`/Supabase nem é gerado. Sem flags, esse chunk só é referenciado
  por `import()` dinâmico (`main.js` e o clique em `school-license.js`).
- Navegador (Chromium headless, 390×844, módulo do RevenueCat trocado por stub):
  fluxo licença → workspace → visão → Mateus → Tutor/Child/Family e volta; a
  criança concluiu uma missão de Contar e a escola refletiu a pendência; texto
  grande sem rolagem horizontal; nenhuma requisição ao Supabase; sem erros de
  console. O registro da sessão pelo mediador foi feito direto no store, não
  pelo assistente da interface.

Não verificado:
- APK/dispositivo: o botão físico de voltar foi exercitado chamando
  `handleSchoolBack()` no navegador; o listener nativo (`App.addListener`) não.
  Confirmar no aparelho: voltar em cada tela da vitrine e a confirmação de sair
  na licença.
- RevenueCat real (Test Store) levando ao workspace; no navegador o módulo foi
  substituído por stub.
- O card "Child" do workspace sem `VITE_SHIPATON_CHILD_DEMO` (entra no fluxo
  conectado e cria sessão anônima); evitado de propósito nos testes.
- Teste de leitura da visão da escola com avaliadores.

Pendente / decisão: voltar do Android estando na vitrine sai do workspace para a
licença e zera o estado da demo (mesmo efeito da seta); não foi alterado.

## Como retomar

1. Ler `CLAUDE.md`, `apps/mobile/CLAUDE.md` e este arquivo.
2. Confirmar branch, alterações locais e diff.
3. Ler `docs/PRODUCT.md` e o recorte pertinente de `docs/MOBILE.md`.
4. Ler o caminho real do comportamento e os consumidores afetados.
5. Relatar brevemente os arquivos lidos e executar apenas a tarefa solicitada.

Ao encerrar uma implementação, atualizar aqui o que foi feito, a evidência de
verificação e o que permanece pendente. Não repetir o diário de outra branch.