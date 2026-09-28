# Cognita mobile — instruções locais

Ler também `CLAUDE.md` na raiz, `docs/PRODUCT.md`, `docs/MOBILE.md` e
`.claude/CURRENT.md` (caminhos relativos à raiz do repositório).

## Aplicação e limites

Esta pasta é o app Android em Vanilla JS + Vite + Capacitor. Não presumir React
nem considerar o bootstrap inativo por uma observação feita na main.

O fluxo ativo parte de `apps/mobile/index.html`, importa `src/main.js` e
chama `initApp` de `src/app.js`. Este orquestra telas e estado; não há router
de framework. `screen` e `openModule` também controlam o botão voltar Android.

- `src/screens/`: renderização e callbacks da interface.
- `src/activities/`: moldes e despacho por `activity.molde`.
- `src/services/`: autenticação, consultas, gravações e preferências.
- `src/config/`: configurações locais.
- `src/assets/` e `src/styles/`: recursos visuais e estilos.

Identificar consumidores antes de alterar um contrato compartilhado. Na main,
a prévia web reutiliza alguns renderizadores mobile; isso não prova que os
bootstraps ou fluxos de persistência sejam iguais. Verificar a branch de destino
e não sincronizar cópias só porque têm o mesmo nome.

## Entrada experimental planejada

O plano completo e os critérios de aceitação estão em `docs/MOBILE.md`.
Não presumir que esse fluxo existe até verificá-lo no código.

- Abertura e experimentação locais não podem depender de sessão, pareamento,
  internet, variáveis Supabase ou sucesso de uma requisição.
- Inspecionar o grafo de imports: adiar apenas `signInAnonymously()` não basta
  enquanto um import criar o cliente Supabase antecipadamente.
- Reutilizar a tela de missão e os moldes; não duplicar os jogos.
- Diferenciar conclusão local e conclusão conectada por contrato explícito.
- Experimentar não cria criança, tutor, ciclo, jornada ou execução no backend.
  Na primeira versão, não persistir histórico experimental nem migrá-lo depois.
- Uma preferência local pode escolher a navegação, nunca autorizar dados.
- Entrar na experimentação não deve desparear, trocar a criança ou encerrar
  a sessão conectada existente.
- Disponibilizar exemplos ao mediador; não gerar progressão pedagógica
  automática, recomendação por diagnóstico ou promessa de aprendizagem.

## Fluxo conectado e ciclo de vida

Manter autenticação anônima do aparelho e validação do vínculo no servidor.
A sessão usa `cognita-mobile-child-auth-v1`; não reutilizar a sessão web do
adulto nem acrescentar login de tutor dentro desse cliente como atalho.

Preservar os contratos de pareamento, troca/desconexão, jornada e conclusão.
Verificar erro de salvamento e repetição de clique, sem declarar sucesso antes
da confirmação. A experimentação não chama `createActivityExecution`.

Ao criar telas/estados, atualizar voltar e `appStateChange`: uma retomada não
deve executar o boot conectado no meio de uma missão local. A validação de
uma sessão em segundo plano também não pode substituir uma tela que o usuário
já abriu. Não classificar falha de rede como código inválido automaticamente.

Preservar texto grande e movimento reduzido. Não exibir controles de som,
vibração ou outros apoios que ainda não estejam implementados.

## Verificação por alvo

Da raiz:

- `npm --prefix apps/mobile run dev`: prévia no navegador.
- `npm --prefix apps/mobile run build`: bundle mobile.
- `npm --prefix apps/mobile run preview`: servir o bundle.

Dentro de `apps/mobile/`, após build e quando a tarefa exigir pacote nativo,
`npx cap sync android` atualiza o projeto nativo. Revisar os arquivos gerados.
Compilar com o ambiente Android disponível; não confundir sync com compilação.

Verificar no Android: primeira abertura offline, conclusão local, botão voltar,
pausa/retomada e fluxo pareado online. Vite no navegador não prova esses casos.
Sem emulador/dispositivo, registrar exatamente o que não foi verificado.

O package mobile inspecionado não define `npm test`. Verificar o estado atual
e executar testes relevantes existentes; não adicionar infraestrutura genérica
como parte de uma alteração pequena.

Para mudanças só de documentação/configuração do agente, validar referências,
JSON/frontmatter e escopo; informar que o runtime não foi exercitado.
