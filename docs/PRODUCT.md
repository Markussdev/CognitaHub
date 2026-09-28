# Cognita Hub — direção de produto

Este documento registra o que já está **decidido** sobre a direção do produto.

Ele não é lugar de pensamento em aberto — isso vive no vault "Central".
Ele não é lugar de decisão com contexto e alternativas — isso vive em
`docs/decisions/`.

## Como ler este documento junto com o código

`docs/PRODUCT.md` é fonte da verdade sobre a **intenção** do produto.
O código é fonte da verdade sobre o **comportamento implementado hoje**.

Quando os dois discordam, **reporte a divergência**. Não reescreva a
implementação para bater com este documento, a não ser que essa reconciliação
seja a tarefa aprovada.

Divergência é informação. Silenciar uma, escolhendo o lado mais conveniente,
é o único erro grave aqui.

Última revisão: 19 de setembro de 2026.

---

## O que o Cognita é

Uma infraestrutura digital de apoio à **mediação humana** na aprendizagem de
matemática de crianças com TEA, inicialmente de 5 a 9 anos.

O Cognita ajuda adultos a conhecer a criança, escolher ou adaptar experiências,
mediar, observar, registrar e usar esse histórico para melhorar a experiência
seguinte.

O ciclo central:

```
CONHECER → ADAPTAR → MEDIAR → OBSERVAR → APRENDER ↺
```

A tecnologia organiza esse ciclo. Ela não conduz o processo pedagógico e não
substitui quem conhece, acompanha ou ensina a criança.

### A pergunta central do produto

> Como criar uma plataforma que ajude adultos a adaptar o ensino de matemática
> para cada criança, sem fingir que um software consegue substituir o olhar
> pedagógico de quem conhece aquela criança?

---

## Quem participa

**Criança** — centro do processo. A experiência se adapta a ela, não o
contrário. Ela pode usar recursos digitais diretamente, mas **a experiência
infantil não é autoensinável**: a mediação humana continua presente.

**Responsável** — tem o conhecimento cotidiano que nenhuma plataforma
substitui. Contribui com contexto e observações.

**Mediador** — conduz a experiência. Pode ser tutor, professor, responsável ou
outro profissional da educação. A arquitetura **não deve assumir** que só um
tutor voluntário generalista exerce mediação. O Cognita não presume que esse
adulto seja especialista clínico.

**Equipe Cognita (C-FORCE)** — mantém a plataforma e impede que decisão técnica
seja tomada sem considerar implicação pedagógica.

**Especialistas e instituições** — validam a proposta. Existem para evitar que o
Cognita seja construído só a partir de suposições da própria equipe.

---

## Princípios decididos

**Pessoa antes do diagnóstico.** TEA, idade e nível de suporte dão contexto.
Nunca determinam atividade, dificuldade, formato, acessibilidade, estratégia ou
progressão. Nenhuma lógica do tipo `TEA nível 2 → atividade X`.

**A decisão pedagógica permanece humana.** O sistema não conhece a criança
melhor que quem convive e trabalha com ela.

**Atividade é proposta, não receita.** Ela carrega habilidade/objetivo,
materiais, sugestão de condução, adaptações possíveis e o que observar — e o
mediador adapta.

**Template responde "como esta habilidade pode ser trabalhada?"** — nunca "como
uma criança com perfil X deve aprender?".

**Duas interfaces distintas.** Instrução para o adulto e instrução para a
criança não se confundem.

**Progresso não é acerto sobre total.** Acompanha-se habilidade + contexto +
nível de apoio + observação + evolução no tempo. Evitar falsa precisão
pedagógica.

**Acessibilidade é configurável e individual.** Um recurso que ajuda uma criança
pode atrapalhar outra. Mais recursos ≠ mais acessibilidade.

**Feedback humano é dado estrutural**, não campo de comentário decorativo.

**Registro de sessão em três níveis é requisito de segurança**: dado
estruturado, devolutiva guiada para a família, e nota interna do tutor que a
família nunca vê. Sem essa separação, nota crua do tutor chegaria à família.

**Linguagem nunca generaliza.** Prefira "esta criança demonstrou responder
melhor a X nesta experiência" a "crianças autistas aprendem melhor com X".
Prefira "você pode experimentar…" a "esta criança deve…".

**Identidade de marca ≠ personalização da experiência.** O maracajá representa o
projeto, nunca características de crianças com TEA. Que ele sirva para uma
criança específica é hipótese de design.

---

## O que o Cognita NÃO é

- não substitui escola, professor ou instituição de ensino;
- não substitui profissionais especializados;
- não realiza avaliação clínica nem emite diagnóstico;
- não é autoridade pedagógica autônoma;
- não trata crianças com TEA como grupo homogêneo;
- não reduz aprendizagem a acertos;
- não oferece solução universal de acessibilidade;
- não transforma automaticamente observação humana em decisão pedagógica.

Fora de escopo técnico: marketplace, ranking público, gamificação competitiva.

---

## Premissas aposentadas

Estas moldaram código que ainda existe. **Código coerente com elas é legado, não
intenção.** Não estenda e não reescreva por conta própria — sinalize.

**"A biblioteca é o especialista embutido que sabe o que é seguro para cada
criança."**
Morreu porque aumentar a quantidade de templates não resolve personalização —
continua sendo uma tentativa de antecipar todas as formas de uma criança
aprender, e isso um software sozinho não faz. A biblioteca segue importante,
com outro papel: ponto de partida para o mediador.

**Progresso como porcentagem de acerto.**
Morreu porque `8/10` não diz se a criança fez sozinha, após demonstração, com
apoio verbal, com objeto físico, ou só naquele contexto.

**Um "modo acessível" único.**
Morreu porque narração, som, animação e densidade visual ajudam uma criança e
atrapalham outra.

**A visão de fluxo autônomo** (`criança → atividade pronta → resposta →
certo/errado → progresso → próxima`).
Substituída pelo ciclo de mediação descrito no topo.

---

## Perguntas em aberto — não viram código

Estas ainda não têm resposta validada. Se uma tarefa depende de uma delas,
**pare e identifique a decisão** em vez de escolher uma silenciosamente.

- Qual é a melhor forma de representar uma habilidade? Quem pode marcar uma
  habilidade como adquirida?
- Como registrar nível de apoio sem criar falsa precisão? A escala hipotética
  (não observado / com apoio / parcial / independente / em outro contexto)
  ainda **não** foi validada por profissionais.
- Como diferenciar observação de avaliação formal?
- Quais campos do perfil realmente ajudam o mediador? Como representar
  comunicação verbal e não verbal, leitura e compreensão, sem simplificar
  demais?
- Quanto feedback pedir sem tornar a sessão burocrática? O feedback do mediador
  fica no histórico, gera sugestão, altera perfil, influencia recomendação, ou
  exige revisão? **Automação é a opção de maior risco e não está decidida.**
- Como configurar acessibilidade sem criar interface impossível de usar?
- O Cognita deve ter editor de atividades? Atividades podem ser compartilhadas
  entre educadores? Como fazer curadoria?
- Como trabalhar regulação/autorregulação com responsabilidade?
- Que informações cada papel pode visualizar? Quais dados **nunca** devem ser
  usados para inferência automática?
- **Como funciona o contato entre mediador e família?** A regra anterior era
  "contato tutor–família é sempre mediado pela equipe". Ela vem da visão
  pré-Ruaké e entrou em tensão com a definição atual de mediador — se o
  responsável pode ser o mediador, a regra já não descreve o mesmo mundo.
  Precisa de decisão explícita antes de voltar a valer como princípio.

---

## Regra de desenvolvimento

```
RELATO / EVIDÊNCIA → APRENDIZADO → HIPÓTESE → VALIDAÇÃO
→ REQUISITO → DESIGN → IMPLEMENTAÇÃO
```

Nada ouvido de pesquisador, professor, usuário ou referência vira código
diretamente. **A capacidade técnica de implementar uma feature não é evidência
de que ela deva existir.**

Referências em estudo (AFIRM, "Um olhar sobre mim", JClic, Numberblocks,
geoplano, CrossMath) são referências. Não são requisitos nem checklist de
implementação.

---

## Como este documento muda

Uma linha entra aqui quando a decisão está tomada. Enquanto está em discussão,
vive no vault. Enquanto está em tensão com outra decisão, vive na seção de
perguntas em aberto.

Uma decisão com contexto, alternativas consideradas e consequência ganha um
arquivo em `docs/decisions/` — e aqui fica só a regra resultante.

Quando uma premissa é aposentada, ela **não é apagada**: vai para a seção de
premissas aposentadas com o motivo. O motivo é o que impede alguém de
reintroduzi-la seis meses depois.
