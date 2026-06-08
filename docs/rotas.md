# Rotas do Cognita Hub

Este documento organiza as páginas do MVP estático do Cognita Hub. Como o projeto usa HTML, CSS e JavaScript puro, cada rota corresponde a um arquivo `.html`.

## Rotas públicas

| Rota | Página | Função | Usuário |
|---|---|---|---|
| `/index.html` | Home | Apresentar o projeto, o fluxo de acompanhamento e as chamadas para participação | Visitante |
| `/pages/cadastro.html` | Escolha de cadastro | Permitir que a pessoa escolha entre responsável, tutor ou equipe | Visitante |
| `/pages/cadastro-responsavel.html` | Cadastro do responsável | Cadastrar responsável e criança para análise da equipe | Responsável |
| `/pages/cadastro-tutor.html` | Cadastro do tutor | Cadastrar tutor voluntário para validação | Tutor |
| `/pages/login.html` | Login | Entrada simulada para responsáveis, tutores e equipe | Responsável, tutor e equipe |

## Rotas internas simuladas

| Rota | Página | Função | Usuário |
|---|---|---|---|
| `/pages/responsavel.html` | Painel do responsável | Acompanhar ciclo, tutor, atividade, status e progresso | Responsável |
| `/pages/tutor.html` | Painel do tutor | Ver crianças acompanhadas, sessões, registros e relatórios | Tutor |
| `/pages/admin.html` | Painel admin | Validar cadastros, criar matches e acompanhar ciclos | Equipe Cognita |
| `/pages/atividades.html` | Biblioteca de atividades | Consultar atividades por idade e habilidade | Responsável, tutor e equipe |

## Fluxo principal

```text
Home
├── Sou responsável -> Cadastro responsável
├── Sou tutor -> Cadastro tutor
├── Participar -> Escolha de cadastro
├── Entrar -> Login
└── Atividades -> Biblioteca de atividades

Cadastro responsável
├── Enviar cadastro
└── Ver exemplo do painel responsável

Cadastro tutor
├── Enviar voluntariado
└── Ver exemplo do painel tutor

Login
├── Responsável -> Painel responsável
├── Tutor voluntário -> Painel tutor
└── Equipe -> Painel admin
```

## Regra de organização

Cada página deve deixar claro:

- Quem usa a página.
- O que essa pessoa quer fazer.
- Qual é o próximo passo esperado.
