# Roteiro de demo — Cognita Hub V2 (3 minutos)

Mostra o ciclo de aprendizagem guiada inteiro: **tutor conduz, criança
executa, sistema registra, família entende.** Não precisa montar cenário —
a criança demo ("Mateus") já tem histórico real de tudo isso.

**Antes de começar:** duas janelas/abas de navegador lado a lado (ou duas
abas anônimas) — uma logada como tutor (`tutor.teste@gmail.com`), outra como
responsável. Deixa as duas já na tela de login, prontas.

---

## 1. Painel do tutor → Mateus (20s)

Login como tutor → clica em **Mateus** na lista de acompanhamentos.

> "Esse é o painel do tutor voluntário. Ele acompanha uma criança de cada
> vez — aqui, o Mateus, 9 anos, ciclo ativo, mês 2 de 6."

## 2. Aba Plano — "isso não é só atividade solta" (35s)

Clica na aba **Plano**.

> "Isso aqui é a parte que eu acho mais importante mostrar: o tutor não
> escolhe atividade aleatória. Ele segue um plano — 'Primeiros Números'.
> Cinco etapas, cada uma com um objetivo. Repara que a primeira já está
> **Concluída** e a segunda **Em andamento** — isso é calculado sozinho, a
> partir do que já foi preparado e registrado. A criança nunca escolhe a
> etapa — quem decide é o tutor."

Aponta pra uma etapa ainda "a fazer" (ex.: "Identificar números de 1 a 10").

## 3. Preparar atividade desta etapa (25s)

Clica **Preparar atividade desta etapa** nessa etapa.

> "Um clique já joga o tutor pra tela de preparar atividade, com tudo
> pré-preenchido: o molde, o tema, a configuração, até a instrução que a
> criança vai ler. O tutor só revisa e confirma."

Mostra a **prévia ao vivo** ao lado (o iframe já mostrando "Toque no número
X" com os números grandes) — clica **Salvar atividade**.

## 4. Modo Criança — "Fazer com a criança" (40s)

Na tabela de atividades preparadas, clica **Fazer com a criança** (pode ser
numa atividade já pronta, tipo "Contar dinossauros", pra ser mais rápido que
esperar o sorteio de números).

> "Essa é a tela que a criança usa — tela cheia, sem menu, sem distração.
> Acolhimento curto: 'Vamos fazer uma missão curtinha?'. E aqui" — clica
> **Começar** — "a atividade de verdade: toca em cada dinossauro pra
> contar."

Toca nos itens, mostra o feedback ("Boa! O número está certo."), completa
as rodadas até **Missão concluída!**.

> "Perceba: o controle do adulto fica escondido atrás de um toque longo
> nesse botão aqui" — (aponta o "···" no canto, sem precisar segurar de
> verdade) — "a criança não esbarra nele sem querer."

Clica **Voltar para o tutor**.

## 5. Registrar a sessão (30s)

Volta automaticamente pra aba Sessões. Abre **Registro guiado**.

> "A execução que a criança acabou de fazer já está aqui, esperando —
> molde, nível, quando foi feita, se concluiu. O tutor não digita de novo."

Clica **Usar esta execução**, mostra os 3 níveis do registro (dado
estruturado → resumo pra família → nota interna), preenche rapidamente o
resumo, clica **Salvar registro**.

> "Essa nota aqui embaixo" — aponta o Nível 3 — "é só do tutor e da equipe.
> A família nunca vê isso."

## 6. Troca pra tela do responsável (30s)

Troca pra outra janela, já logada como responsável.

> "E esse é o painel da família — do outro lado do mesmo ciclo."

Clica em **Sessões**.

> "Aqui está a sessão que acabou de ser registrada, com o resumo exato que
> o tutor escreveu — e só isso. Sem nota interna, sem jargão técnico, sem
> nada que não seja pra família ver."

## Fechamento (10s)

> "Resumindo: o tutor tem um plano, não uma lista solta de atividades. A
> criança só executa o que foi preparado pra ela. E a família acompanha sem
> precisar entender nada de pedagogia — só lê o que aconteceu."

---

## Se sobrar tempo / perguntarem mais

- **"Tem mais de uma atividade?"** — sim, dois moldes hoje: contar
  (dinossauros) e identificar (números). A arquitetura foi pensada pra
  crescer — molde novo não mexe no resto do sistema.
- **"A criança pode fazer sozinha?"** — não, e é proposital. O Modo Criança
  só abre por um adulto (tutor, por enquanto) escolhendo uma atividade já
  preparada. Não tem login infantil, não tem navegação livre.
- **"Isso roda no celular?"** — o Modo Criança sim, testado. O painel do
  tutor ainda não tem o menu adaptado pra celular pequeno — é o próximo
  ajuste visual, não afeta o que a criança usa.

## Dados que a demo usa (não apagar antes de apresentar)

Criança "Mateus" (tutor `tutor.teste@gmail.com`, responsável
`marcus.vwq.777@gmail.com`) tem, de propósito: atividades preparadas nos
dois moldes, execuções em estados diferentes (registradas e pendentes), e
as 5 etapas do Plano em 3 status diferentes (concluída / em andamento / a
fazer) — é o que dá o efeito de "sistema com histórico de verdade" na
demo, em vez de uma tela vazia sendo preenchida na hora.
