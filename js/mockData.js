const mockUsers = [
  {
    id: "user_guardian_joao",
    name: "Joao Almeida",
    email: "joao@email.com",
    role: "guardian",
    phone: "(91) 99999-0000",
    status: "active",
    createdAt: "2026-06-01",
  },
  {
    id: "user_tutor_maria",
    name: "Maria Silva",
    email: "maria@email.com",
    role: "tutor",
    phone: "(91) 98888-0000",
    status: "active",
    createdAt: "2026-06-02",
  },
  {
    id: "user_admin_cognita",
    name: "Equipe Cognita",
    email: "admin@cognitahub.org",
    role: "admin",
    phone: "(91) 97777-0000",
    status: "active",
    createdAt: "2026-06-01",
  },
];

const mockChildren = [
  {
    id: "child_joao",
    guardianId: "user_guardian_joao",
    name: "Joao Pereira",
    age: 7,
    schoolYear: "2o ano",
    hasFormalDiagnosis: "not_informed",
    status: "active",
    currentMonth: 2,
    tutorName: "Maria Silva",
    mainGoal: "Contagem, comparacao de quantidades e somas simples",
    preferredFormats: ["visual", "concreto", "passo a passo"],
    interests: "objetos do cotidiano, jogos e personagens",
    avoidances: "textos longos e muitas instrucoes ao mesmo tempo",
    currentActivity: "Soma com apoio visual",
    nextSession: "Quinta-feira, 15h",
    createdAt: "2026-06-01",
  },
  {
    id: "child_lia",
    guardianId: "user_guardian_lia",
    name: "Lia Costa",
    age: 9,
    schoolYear: "4o ano",
    hasFormalDiagnosis: true,
    status: "waiting",
    currentMonth: 1,
    tutorName: "Aguardando tutor",
    mainGoal: "Problemas simples do cotidiano e geometria basica",
    preferredFormats: ["concreto", "jogos"],
    interests: "desenhos, blocos e desafios curtos",
    avoidances: "atividades muito abstratas sem exemplo",
    currentActivity: "Comparar quantidades com objetos",
    nextSession: "Aguardando match",
    createdAt: "2026-06-04",
  },
];

const mockLearningProfiles = [
  {
    id: "profile_joao",
    childId: "child_joao",
    preferredFormats: ["visual", "concrete", "step_by_step"],
    attentionSpan: "short",
    mathDifficulties: ["counting", "addition", "quantity_comparison"],
    strengths: "Boa resposta a exemplos concretos e repeticao previsivel.",
    motivators: "Objetos da casa, jogos rapidos e personagens.",
    avoidances: "Textos longos e muitas instrucoes simultaneas.",
    updatedAt: "2026-06-08",
  },
];

const mockTutorApplications = [
  {
    id: "application_ana",
    tutorId: "user_tutor_ana",
    name: "Ana Martins",
    formation: "Psicopedagogia",
    linkedin: "linkedin.com/in/anamartins",
    experience: "Experiencia com TEA e reforco de matematica.",
    weeklyAvailability: "Terca e quinta, tarde",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: "application_rafael",
    tutorId: "user_tutor_rafael",
    name: "Rafael Nunes",
    formation: "Licenciatura em Matematica",
    linkedin: "linkedin.com/in/rafaelnunes",
    experience: "Aulas de reforco e atividades ludicas.",
    weeklyAvailability: "Sabado, manha",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
  },
];

const mockSupportCycles = [
  {
    id: "cycle_joao_maria",
    childId: "child_joao",
    tutorId: "user_tutor_maria",
    startDate: "2026-06-01",
    endDate: "2026-11-30",
    currentMonth: 2,
    status: "active",
    mainGoal: "Fortalecer contagem, comparacao e somas simples.",
    currentPlan: "Soma com objetos, cartoes visuais e exemplos da rotina.",
  },
];

const mockMatches = [
  {
    id: "match_joao_maria",
    childId: "child_joao",
    tutorId: "user_tutor_maria",
    childName: "Joao Pereira",
    tutorName: "Maria Silva",
    reason: "Horario compativel, foco em soma simples e experiencia pedagogica.",
    compatibility: {
      schedule: true,
      mathFocus: true,
      experience: true,
    },
    status: "approved",
    createdAt: "2026-06-05",
  },
  {
    id: "match_lia_rafael",
    childId: "child_lia",
    tutorId: "user_tutor_rafael",
    childName: "Lia Costa",
    tutorName: "Rafael Nunes",
    reason: "Sabado pela manha e foco em problemas do cotidiano.",
    compatibility: {
      schedule: true,
      mathFocus: true,
      experience: false,
    },
    status: "suggested",
    createdAt: "2026-06-08",
  },
];

const mockSessions = [
  {
    id: "session_001",
    cycleId: "cycle_joao_maria",
    childId: "child_joao",
    tutorId: "user_tutor_maria",
    date: "2026-06-06",
    durationMinutes: 45,
    topic: "Soma com objetos e cartoes visuais",
    activityUsed: "Soma com apoio visual",
    engagement: 4,
    difficulty: 2,
    result: "improved",
    notes: "Respondeu melhor com objetos do cotidiano.",
    nextStep: "Praticar contagem em situacoes da rotina.",
    createdAt: "2026-06-06",
  },
];

const mockActivities = [
  {
    id: "activity_soma_visual",
    title: "Soma com apoio visual",
    ageRange: "7-9",
    mathSkill: "addition",
    format: "visual",
    difficultyLevel: 1,
    estimatedMinutes: 15,
    instructions: "Usar objetos da casa para montar grupos e contar o total.",
    tags: ["soma", "visual", "concreto"],
  },
];

const mockProgressLogs = [
  {
    id: "progress_001",
    childId: "child_joao",
    cycleId: "cycle_joao_maria",
    skill: "addition",
    previousLevel: "precisava de ajuda constante",
    currentLevel: "resolve somas simples com objetos",
    evidence: "Completou 4 exemplos com apoio visual.",
    source: "session",
    createdAt: "2026-06-06",
  },
];

const mockReports = [
  {
    id: "report_joao_month_1",
    cycleId: "cycle_joao_maria",
    childId: "child_joao",
    tutorId: "user_tutor_maria",
    month: 1,
    summary: "Boa adaptacao ao formato visual e concreto.",
    progress: "Maior seguranca em contagem e pequenas somas.",
    difficulties: "Perde foco em atividades longas.",
    recommendations: "Manter atividades curtas com objetos familiares.",
    createdAt: "2026-06-07",
  },
];

const mockAdminNotes = [
  {
    id: "note_001",
    relatedType: "match",
    relatedId: "match_lia_rafael",
    authorId: "user_admin_cognita",
    note: "Confirmar disponibilidade do responsavel antes de aprovar o match.",
    visibility: "internal",
    createdAt: "2026-06-08",
  },
];

window.cognitaData = {
  users: mockUsers,
  children: mockChildren,
  learningProfiles: mockLearningProfiles,
  tutorApplications: mockTutorApplications,
  supportCycles: mockSupportCycles,
  matches: mockMatches,
  sessions: mockSessions,
  activities: mockActivities,
  progressLogs: mockProgressLogs,
  reports: mockReports,
  adminNotes: mockAdminNotes,
};

window.cognitaMock = window.cognitaMock || {
  responsavel: {
    nome: "Joao Almeida",
    primeiroNome: "Joao",
    email: "joao@email.com",
  },
  crianca: {
    nome: "Joao Pereira",
    idade: "7 anos",
    etapaEscolar: "2o ano do ensino fundamental",
    foco: "Contagem, comparacao de quantidades e pequenas somas.",
  },
  tutor: {
    nome: "Maria Silva",
    primeiroNome: "Maria",
    formacao: "Pedagogia",
    disponibilidade: "Quinta-feira, 15h",
  },
  ciclo: {
    status: "Ativo",
    mesAtual: "Mes 2 de 6",
    progressoTexto: "33% do ciclo concluido",
    progressoPercentual: "33%",
    cadastro: "Validado pela equipe",
    match: "Tutor vinculado",
    presencas: "4 de 4 sessoes",
  },
  sessaoAtual: {
    dia: "Quinta-feira",
    horario: "15h",
    resumoHorario: "Quinta, 15h",
    formato: "Encontro online",
    tema: "Soma com apoio visual",
    registro: "Soma com objetos e cartoes visuais.",
  },
  atividadeSugerida: {
    titulo: "Contar objetos da casa",
    descricao: "Contar objetos da casa e comparar grupos com mais ou menos itens.",
    semana: "Semana 4",
  },
  observacaoTutor: {
    texto: "Joao respondeu melhor a exemplos com objetos do cotidiano.",
    tipo: "Registro",
  },
};
