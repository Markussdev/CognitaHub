flowchart TD
    A[Visitante acessa o site] --> B{Qual perfil?}

    B --> C[Responsável legal]
    B --> D[Tutor voluntário]

    C --> E[Cadastro da criança]
    D --> F[Cadastro do tutor]

    E --> G[Aguardando validação da equipe]
    F --> H[Aguardando aprovação do tutor]

    G --> I[Responsável aprovado]
    H --> J[Tutor aprovado]

    I --> K[Match manual feito pela equipe]
    J --> K

    K --> L[Ciclo de acompanhamento iniciado]
    L --> M[Sessão semanal]
    M --> N[Registro do tutor]
    N --> O[Atividade sugerida]
    O --> P[Responsável acompanha evolução]
    P --> Q[Equipe monitora relatórios]
    Q --> R[Relatório final do ciclo]


    