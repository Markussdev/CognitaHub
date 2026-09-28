# Trabalho atual — preparação do mobile

Atualizado em 27/09/2026.

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
`docs/MOBILE.md`. Não inventar preço, plano comercial validado ou aprovação
pedagógica, nem implementar RevenueCat por consequência desta tarefa.

## Como retomar

1. Ler `CLAUDE.md`, `apps/mobile/CLAUDE.md` e este arquivo.
2. Confirmar branch, alterações locais e diff.
3. Ler `docs/PRODUCT.md` e o recorte pertinente de `docs/MOBILE.md`.
4. Ler o caminho real do comportamento e os consumidores afetados.
5. Relatar brevemente os arquivos lidos e executar apenas a tarefa solicitada.

Ao encerrar uma implementação, atualizar aqui o que foi feito, a evidência de
verificação e o que permanece pendente. Não repetir o diário de outra branch.