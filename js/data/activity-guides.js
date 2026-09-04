// Conteúdo pedagógico complementar dos guias de atividade.
//
// Objetivo, preparação, passos, falas, adaptações e sinais de sucesso
// continuam vindo de `activities`. Este arquivo guarda apenas o que ainda
// não existe na tabela, evitando duas fontes da verdade para a mesma atividade.
export const ACTIVITY_GUIDES = {
  'conte-os-dinossauros': {
    learningObjectives: [
      'Entender a habilidade trabalhada pela atividade.',
      'Preparar a experiência antes de começar.',
      'Reconhecer quando simplificar ou aumentar a dificuldade.',
    ],

    caseStudy: {
      title: 'Lucas e a contagem dos dinossauros',
      disclaimer: 'Caso fictício para demonstração.',
      learner: 'Lucas, 7 anos',
      text: 'Lucas reconhece pequenas quantidades, mas às vezes conta o mesmo objeto duas vezes. O tutor quer ajudá-lo a associar cada dinossauro a uma única palavra-número.',
    },

    checkpoint: {
      question: 'Se a criança estiver tendo dificuldade, qual adaptação prevista pelo guia você tentaria primeiro?',
      options: [
        'Aumentar a quantidade de objetos.',
        'Utilizar a adaptação indicada para reduzir a dificuldade.',
        'Encerrar imediatamente a atividade.',
      ],
      correctIndex: 1,
      feedback: 'Essa adaptação reduz a dificuldade da tarefa sem trocar a habilidade principal que está sendo trabalhada.',
    },

    review: {
      author: 'Equipe Cognita',
      sources: [],
      specialist: null,
      reviewedAt: null,
    },
  },
}

export function getActivityGuide(slug) {
  return ACTIVITY_GUIDES[slug] || null
}

export function hasActivityGuide(slug) {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_GUIDES, slug)
}
