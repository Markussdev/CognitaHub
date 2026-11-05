# Arquitetura — Cognita Hub

Última revisão: 3 de setembro de 2026.

## Visão geral

O Cognita Hub possui três partes principais:

1. Hub web para responsáveis, tutores e administração.
2. Experiência infantil para realizar missões e acompanhar a jornada.
3. Backend compartilhado no Supabase.

```mermaid
flowchart LR
    WEB[Hub web] --> API[Supabase Data API e RPCs]
    CHILD[Experiência infantil] --> API
    API --> AUTH[Supabase Auth]
    API --> DB[(PostgreSQL + RLS)]
    WEB --> STORAGE[Supabase Storage]
```

O frontend é uma aplicação multipágina. Cada arquivo HTML é uma entrada do Vite e carrega módulos JavaScript responsáveis pela interface e pelo acesso aos dados.

## Stack

Frontend:

- HTML5;
- CSS3;
- JavaScript com ES Modules;
- Vite.

Backend:

- Supabase Auth;
- PostgreSQL;
- Row Level Security (RLS);
- funções PostgreSQL expostas como RPC;
- Supabase Storage.

Proteção complementar:

- Cloudflare Turnstile para a criação de sessões anônimas no fluxo infantil.

## Estrutura principal

```text
cognita-hub/
├── apps/mobile/        # módulos da experiência infantil
├── css/                # estilos do hub e das páginas
├── js/
│   ├── components/     # componentes compartilhados
│   ├── data/           # consultas, comandos e RPCs do Supabase
│   ├── lib/            # autenticação, cliente Supabase e utilitários
│   └── pages/          # controladores das páginas
├── pages/              # entradas HTML do Vite
├── public/             # assets servidos sem transformação
├── docs/               # arquitetura, banco e roadmap
├── index.html          # página pública inicial
└── vite.config.js      # entradas do build multipágina
```

### Responsabilidades das camadas

- `pages/` define a estrutura de cada tela.
- `js/pages/` coordena estado, eventos e renderização de cada tela.
- `js/components/` concentra componentes reutilizáveis do hub.
- `js/data/` é a fronteira principal entre o hub e o Supabase.
- `js/lib/` reúne infraestrutura compartilhada, incluindo autenticação.
- `apps/mobile/src/` concentra serviços, telas, atividades e assets da experiência infantil modular.

### Página especial: Mundo SENAI 2026

`pages/mundo-senai.html` é uma página pública e independente, feita para a apresentação do projeto no Mundo SENAI 2026 (5 e 6 de novembro). Ela não faz parte do fluxo do hub: tem CSS próprio (`css/mundo-senai.css`, que só reaproveita o motor de superfície de `css/brand-surface.css`) e JavaScript próprio (`js/pages/mundo-senai.js`). Não importa o cliente do Supabase, não faz requisições e não lê nem grava dados.

A página tem dois modos, alternados pelo atributo `body[data-modo]`:

- **Explorar** (`pagina`, o padrão): a página longa, com o conteúdo complementar (caminho de um clique, três mundos, CCNA, propósito).
- **Apresentação** (`apresentacao`): um palco em tela cheia (`div.ap`, no fim do `<body>`) com 4 cenas, uma por integrante: origem do Cognita, como a plataforma funciona, redes de computadores e nuvem. A equipe controla as trocas (botões grandes, setas do teclado, indicador de progresso); nada avança por tempo. Abre pelo botão "Iniciar apresentação" ou direto por `?apresentacao=1` (e `&cena=1..4`). Sem JavaScript o palco permanece `hidden` e só o modo Explorar existe.

Tudo no palco é **simulação local e didática**, com dados fictícios ("criança exemplo") e estados determinísticos: o botão "Liberar missão" apenas troca um atributo no próprio palco, o caminho do pedido (dispositivo, rede local, roteador, internet, serviço remoto) e a cena da nuvem (API, autenticação, RLS, PostgreSQL) são animações explicativas, não captura de tráfego nem chamada real. Depois do carregamento, o conteúdo essencial não depende da rede (as fontes do Google Fonts são as únicas requisições remotas e têm fallback para a fonte do sistema).

Os atributos `data-secao` e `data-slot` (simulador-requisicoes, camadas-tcpip, inspetor-http, demo-supabase) seguem no HTML como âncoras antigas, sem consumidor em CSS ou JS; os slots da "fase 2" **não** foram implementados e a apresentação não os usa. Se um dia existir uma demonstração com Supabase, o acesso a dados deve passar por `js/data/`, como no resto do projeto.

## Identidades e papéis

| Papel | Responsabilidade | Autenticação |
|---|---|---|
| `guardian` | Responsável pela criança | E-mail e senha |
| `tutor` | Tutor voluntário validado pela equipe | E-mail e senha |
| `admin` | Equipe Cognita | E-mail e senha; papel atribuído de forma administrativa |
| `child_device` | Identidade técnica de um dispositivo infantil | Usuário anônimo do Supabase |

`auth.users` mantém a identidade de autenticação e `profiles` mantém o papel e o estado usados pela aplicação. Para usuários anônimos, o trigger de criação de perfil define `role = child_device` e `status = active`.

Um usuário anônimo do Supabase assume o papel PostgreSQL `authenticated`; por isso, a autorização infantil não pode depender apenas desse papel. Ela também verifica a identidade anônima, o perfil `child_device` e o vínculo ativo em `paired_devices`.

## Fluxo adulto

```mermaid
flowchart TD
    A[Responsável cria a conta e cadastra a criança] --> B[Tutor envia seu cadastro]
    B --> C[Admin analisa e aprova o tutor]
    C --> D[Admin realiza o match]
    D --> E[Ciclo de acompanhamento é criado]
    E --> F[Tutor prepara trilha e registra sessões]
    F --> G[Criança realiza atividades]
    G --> H[Responsável acompanha a evolução]
```

Responsáveis e tutores entram com e-mail e senha. As páginas protegidas recuperam o perfil no banco, verificam papel e estado e redirecionam acessos incompatíveis.

## Fluxo infantil

```mermaid
flowchart TD
    A[Aplicação infantil abre] --> B[Reutiliza ou cria usuário anônimo]
    B --> C[Dispositivo recebe perfil child_device ativo]
    C --> D[Código de pareamento é informado]
    D --> E[RPC associa o dispositivo à criança]
    E --> F[Contexto pareado é carregado]
    F --> G[Criança acessa módulos e missões]
    G --> H[Execuções e progresso são enviados ao backend]
```

A sessão anônima é persistida no navegador para evitar a criação de um usuário novo a cada tentativa. O pareamento pode ser revogado pela família ou removido no próprio dispositivo sem apagar a criança.

## Autorização

O frontend nunca é a fonte de autoridade para permissões. Ele melhora a navegação, mas as decisões de acesso pertencem ao banco e combinam:

- `profiles.role` e `profiles.status`;
- relações entre responsáveis, tutores, crianças e ciclos;
- vínculo ativo em `paired_devices`;
- políticas RLS;
- funções PostgreSQL com validações próprias.

Metadados editáveis pelo usuário não devem ser usados diretamente como fonte de autorização. O cadastro público só pode originar `guardian` ou `tutor`; `admin` não é concedido pelo frontend.

## Banco e evolução do schema

O schema em produção é atualmente a fonte de verdade. Os antigos scripts executados manualmente foram removidos de `docs/` porque não formavam uma sequência reproduzível de migrations.

Enquanto não existir uma baseline versionada em `supabase/migrations/`, mudanças no banco devem ser conferidas diretamente no projeto Supabase e refletidas em [DATABASE.md](./DATABASE.md). A criação da baseline está registrada no [ROADMAP.md](./ROADMAP.md).
