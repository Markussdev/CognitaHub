# Cognita mobile — estado e entrada imediata

Atualizado em 27/09/2026. Princípios pedagógicos: [PRODUCT.md](PRODUCT.md).

## 1. Estado observado, não promessa de funcionamento

Inspeção estática da branch `feat/mobile-app`, commit
`0dbe1c749ea0db035e854ad049aba911d3e22c2a`:

| Parte | Comportamento encontrado |
| --- | --- |
| `apps/mobile/index.html` / `src/main.js` | Inicializam o app e as preferências visuais. |
| `src/app.js` | Autentica anonimamente, consulta vínculo e carrega a jornada. |
| `src/services/supabase.js` | Cria cliente durante a importação; lê duas variáveis de ambiente. |
| `src/services/auth.js` | Reutiliza a sessão anônima; sessão adulta não é aceita nesse cliente. |
| `src/screens/mission.js` | Recebe atividade, saída e conclusão por callbacks. |
| `src/activities/activity-runner.js` | Executa apenas Contar e Identificar. |
| `src/services/executions.js` | Registra execução no fluxo conectado. |

Sem vínculo, o app mostra pareamento. Com vínculo e sem `child_trail_id`,
mostra "Seu tutor ainda não montou sua jornada". A espera decorre da ausência
de jornada; autenticação anônima identifica o dispositivo, não cria a jornada.

A prévia visual de landmarks não é uma experiência funcional completa.
A prévia web da main também não substitui o teste do APK. O banco compartilhado
e suas políticas precisam de validação própria para testar dados reais.

## 2. Objetivo da próxima implementação

Permitir que educador, responsável ou avaliador abra o app e experimente uma
atividade imediatamente, preservando o acesso às jornadas vinculadas.

A experimentação é um exemplo para conhecer e conduzir a experiência com
mediação humana. Não é avaliação, diagnóstico, trilha personalizada ou
comprovação de aprendizagem. Não usar diagnóstico/idade para escolher o exemplo.

O escopo inicial usa os dois moldes existentes. Não depende das futuras
atividades audiovisuais nem de monetização. A proposta responde à barreira de
acesso discutida com Marcus e à inspeção estática; seu benefício em uso real
e a adequação pedagógica dos exemplos ainda não foram validados.

## 3. Comportamento desejado — ainda não implementado

| Situação | Destino |
| --- | --- |
| Primeira abertura | Tela com "Experimentar uma atividade", "Tenho um código" e orientação secundária para adultos. |
| Experimentar | Seleção de Contar ou Identificar, objetivo/sugestão de condução para o adulto, atividade e encerramento local. |
| Tenho um código | Inicialização da parte conectada e fluxo de pareamento existente. |
| Retorno com vínculo válido e jornada | Retomar o percurso conectado após validar sessão e contexto. |
| Vínculo válido, sem jornada | Informar o estado, oferecer atualizar e experimentar sem remover o vínculo. |
| Rede indisponível | Oferecer tentativa de conexão e experimentação local; não apagar sessão ou vínculo por erro de rede. |

No encerramento experimental, oferecer repetir ou escolher outra atividade.
Não mostrar "Salvando..." nem direcionar a um mapa inexistente. A apresentação
ao adulto deve usar linguagem de proposta, incluir possibilidades de adaptação
e o que observar, e manter a instrução infantil simples. Revisar o conteúdo
concreto dessas orientações; reutilizar um molde não significa que ele já foi
validado pedagogicamente.

Neste primeiro recorte, o estado da atividade experimental existe só durante
a sessão de interface; ele não representa um indicador de aprendizagem.
Preferências visuais existentes podem continuar persistidas.
Não pedir nome, diagnóstico ou outro dado da criança para experimentar.

Não transferir resultados experimentais para uma criança pareada mais tarde:
o app não sabe quem realizou o exemplo. Uma pessoa já pareada pode experimentar
sem perder seu vínculo nem alterar sua jornada.

## 4. Recorte técnico sugerido

Os nomes de arquivos novos abaixo são sugestões, não módulos já existentes.

1. Ajustar `src/main.js` / `src/app.js` para separar entrada local e
   inicialização conectada. Inspecionar todos os imports transitivos que
   criam o cliente Supabase, inclusive telas de perfil e serviços.
2. Acrescentar uma tela de entrada/experimentação e configurações locais dos
   exemplos. Recursos necessários devem acompanhar o bundle.
3. Reutilizar `renderMission` e `mountActivity`. Passar uma conclusão local
   que não dependa de IDs reais nem grave no banco.
4. Ajustar textos/retorno da missão por contrato explícito. O caminho conectado
   continua responsável por `createActivityExecution` e atualização da jornada.
5. Atualizar os estados usados no botão voltar, pausa/retomada e carregamentos
   assíncronos. Não permitir que um boot tardio substitua a experimentação.
6. Usar a mesma entrada local nos estados sem jornada e de conexão indisponível.

Adiar só a chamada de autenticação não resolve a inicialização antecipada de
`createClient`. A entrada local deve continuar abrindo sem configuração
Supabase. Usar o menor isolamento necessário, sem reescrever todo o orquestrador
ou criar um segundo motor de atividades.

Este recorte não exige mudança de schema, RLS ou RPC. Se a implementação
descobrir uma dependência que exija isso, relatar antes de ampliar o escopo.
Não criar contas fictícias no backend para destravar a interface.

## 5. Critérios de aceitação da implementação

Todos estão pendentes até a implementação e a execução dos testes.

- Sem variáveis Supabase: abrir a entrada, concluir cada exemplo e voltar à
  seleção sem inicializar o cliente ou chamar o backend.
- APK instalado, rede desligada: repetir o percurso acima com recursos locais.
  Isso não promete acesso ao site web offline.
- Experimentar: nenhuma autenticação, RPC ou gravação de execução; nenhum
  histórico experimental associado à criança ou sincronizado posteriormente.
- Sem jornada: entrar/sair da experimentação preservando o vínculo existente.
- Online: parear, carregar atividade atribuída, concluir e confirmar a gravação.
  Falha de salvamento deve permitir recuperação sem fingir conclusão.
- Código inválido/expirado e erro de conexão: mensagens apropriadas e saída
  disponível; a pessoa não fica presa numa tela de espera.
- Android: voltar retorna ao destino correto; pausa/retomada não reinicia
  atividade local nem a substitui por pareamento/jornada.
- Texto grande e movimento reduzido continuam respeitados.
- Não regravar ou duplicar uma conclusão conectada ao retornar da experimentação.

Registrar separadamente build, rastreamento estático, navegador, APK e banco.
Um build verde não prova que uma política autoriza a operação correta.

## 6. Próximos recortes em discussão

Estas direções vieram da conversa de produto; não são funcionalidades prontas
nem autorização para ampliar a tarefa de entrada imediata.

### Monetização institucional

Explorar uma licença de uso hospedado para escola/turma, comprada por um adulto,
com organização do acompanhamento e distribuição de atividades. Preço, limites,
papéis institucionais e permissões ainda precisam ser definidos. Isso não
autoriza cobrar famílias ou restringir apoios de acessibilidade.

O pacote mobile já tem um protótipo de RevenueCat (Test Store), em
`services/revenuecat.js` e `screens/school-license.js`, alcançado só pelo
entrypoint temporário do Shipaton (`?school=1` ou `VITE_SHIPATON_SCHOOL_DEMO`)
e fora do fluxo da criança. Oferta e preço são demonstrativos, sem validação
com receita real. Uma compra real deve se vincular ao responsável
institucional; não ao identificador
anônimo do aparelho infantil. Direitos de acesso e vínculos são verificados
no servidor. Separar compra de teste de receita real e conferir a documentação
e as regras atuais do evento antes de afirmar elegibilidade.

### Variação de experiências

Explorar narração repetível em Identificar, associação numeral/quantidade com
peças e comparação de conjuntos. Áudio deve poder ser desligado; arrastar
deve ter alternativa por toque. Não mostrar como disponíveis os apoios que
não foram construídos.

Objetivo, condução, contexto e feedback do adulto continuam centrais.
Registrar o uso de um apoio não equivale a validar uma escala de aprendizagem.
As questões pedagógicas abertas em PRODUCT permanecem abertas.

### Avaliação completa do projeto

A entrada local demonstra as atividades, mas não comprova tutor → criança →
registro. Esse percurso exigirá ambiente de demonstração separado, dados
fictícios e instruções reproduzíveis. O repositório não demonstra uma baseline
completa de banco; não apresentar SQLs históricos como instalação garantida.
