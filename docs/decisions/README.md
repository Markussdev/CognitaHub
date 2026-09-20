# Decisões

Uma decisão por arquivo. O registro existe para que ninguém — inclusive você
daqui a seis meses, inclusive um agente lendo o código — precise redescobrir
por que algo é do jeito que é.

## Quando escrever uma

Escreva quando a decisão:

- fecha uma alternativa que alguém razoavelmente escolheria;
- será questionada no futuro ("por que não usaram X?");
- aposenta uma premissa anterior;
- custa caro para reverter.

Não escreva para escolha óbvia, detalhe de implementação ou preferência de
estilo.

Regra prática: se a resposta a "por que não do outro jeito?" for longa, vira
arquivo.

## Nome do arquivo

```
NNNN-frase-curta-em-minusculas.md
```

Numeração sequencial, sem reuso. `0003-sem-webrtc-embutido.md`.

## Formato

```markdown
# NNNN — Título

**Data:** AAAA-MM-DD
**Status:** aceita | substituída por NNNN | revertida

## Contexto
O que estava acontecendo. Que restrição existia. O que a gente sabia — e
o que não sabia — naquele momento.

## Alternativas consideradas
Cada uma com o motivo real de não ter sido escolhida. Alternativa listada
sem motivo não conta.

## Decisão
O que foi decidido, em uma ou duas frases.

## Consequências
O que isso torna mais fácil. O que torna mais difícil. O que passa a ser
proibido. O que vai ter que ser revisitado, e sob qual condição.
```

## Regras

**Arquivo aceito não se edita.** Se a decisão muda, escreve outra e marca a
antiga como `substituída por NNNN`. Reescrever o passado apaga o motivo, que é
a única coisa que importa aqui.

**Agente não altera decisão existente.** Pode propor uma nova; alterar as
antigas é trabalho do Marcus.

**A regra resultante vai para `docs/PRODUCT.md`.** Aqui fica o raciocínio; lá
fica o que vale como regra. Sem duplicar — lá a regra, aqui o porquê.

## Primeiras a escrever

Duas já existem como decisão tomada e ainda não registrada:

- **por que a adaptação não é automatizada** — por que o Cognita não infere
  experiência a partir de perfil, e o que isso fecha
- **por que a biblioteca deixou de ser "o especialista embutido"** — a premissa
  aposentada depois da Ruaké, e o que entrou no lugar

Uma terceira, mais antiga e igualmente fácil de questionar:

- **por que não há videochamada embutida** — WebRTC foi rejeitado por risco de
  escopo, segurança infantil e proteção de dados; o caminho é um campo de link
  de sessão apontando para serviço externo

E uma quarta, que **ainda não é decisão** — está em aberto e precisa ser
resolvida antes de virar ADR:

- **como funciona o contato entre mediador e família** — a regra antiga
  ("contato tutor–família é sempre mediado pela equipe") entrou em tensão com
  a definição pós-Ruaké de mediador, que inclui o próprio responsável. Está
  listada em "Perguntas em aberto" no `docs/PRODUCT.md` até ser decidida.
