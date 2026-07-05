// Fonte única de verdade sobre o que cada molde é: usado pela autoria do
// tutor (js/pages/tutor.js, monta o form de composição) E pela casca do
// Modo Criança (js/pages/modo-crianca.js, monta acolhimento/feedback ao
// carregar uma child_activity real). Adicionar um molde novo é adicionar
// uma entrada aqui — nenhum dos dois consumidores precisa mudar.
export const MOLDES_REGISTRO = {
  contar: {
    label: 'Contar',
    disponivel: true,
    temas: [{ id: 'dinossauros', label: 'Dinossauros', disponivel: true }],
    // control diz ao form de composição qual widget usar — slider pra faixas
    // largas e "de sensação contínua", pills numeradas pra faixas curtas e
    // precisas. unidade alimenta o resumo em linguagem natural ("6 itens").
    campos: [
      { key: 'quantidade', label: 'Quantos itens', control: 'slider', unidade: 'itens', min: 1, max: 10, default: 5 },
      { key: 'nivel', label: 'Nível', control: 'pills', unidade: null, min: 1, max: 5, default: 1 },
      { key: 'rodadas', label: 'Rodadas', control: 'pills', unidade: 'rodadas', min: 1, max: 5, default: 3 },
    ],
    instrucaoPadrao: 'Toque em cada dinossauro para contar.',
    tituloPadrao: (temaLabel) => `Contar ${temaLabel.toLowerCase()}`,
    acolhimentoTitulo: (temaLabel) => `Vamos contar ${temaLabel.toLowerCase()}?`,
    acolhimentoFala: 'Eu adoro contar coisas. Bora começar?',
    feedbackAcerto: [
      'Isso mesmo! Você contou certinho.',
      'Boa! O número está certo.',
      'Muito bem, contamos juntos.',
    ],
    feedbackDificuldade: [
      'Quase lá. Vamos tentar de novo, com calma.',
      'Sem problema. Contar leva um tempinho — de novo?',
    ],
    // {tema} é resolvido na hora de montar o contrato (não muda durante a
    // sessão); {quantidade}/{rodadas} ficam para o formatTemplate do casca,
    // porque podem mudar via "mais fácil"/"mais difícil".
    encerramentoResumo: 'Vocês contaram até {quantidade} {tema}, {rodadas} vezes.',
  },
  identificar: { label: 'Identificar', disponivel: false, temas: [], campos: [] },
  comparar: { label: 'Comparar', disponivel: false, temas: [], campos: [] },
  associar: { label: 'Associar', disponivel: false, temas: [], campos: [] },
}

// Monta o contrato completo (o formato que o Modo Criança renderiza) a partir
// de molde+tema+config+instrucao — usado tanto pela leitura real de uma
// child_activity (js/pages/modo-crianca.js) quanto pela prévia ao vivo do
// form de composição (js/pages/tutor.js). Acolhimento/feedback/encerramento
// nunca vêm do banco nem do form — são o padrão do molde, sempre.
export function buildContractFromParts({ molde: moldeKey, tema, config, instrucao, titulo }) {
  const molde = MOLDES_REGISTRO[moldeKey]
  const temaLabel = molde?.temas.find((t) => t.id === tema)?.label || tema || ''
  const resumoTemplate = (molde?.encerramentoResumo || 'Atividade concluída.')
    .replace('{tema}', temaLabel.toLowerCase())

  return {
    molde: moldeKey,
    tema,
    config: config || {},
    instrucao,
    acolhimento: {
      titulo: molde?.acolhimentoTitulo?.(temaLabel) || titulo || 'Vamos começar?',
      fala: molde?.acolhimentoFala || 'Bora fazer essa atividade juntos?',
    },
    feedback_acerto: molde?.feedbackAcerto?.length ? molde.feedbackAcerto : ['Muito bem!'],
    feedback_dificuldade: molde?.feedbackDificuldade?.length
      ? molde.feedbackDificuldade
      : ['Vamos tentar de novo, com calma.'],
    encerramento: {
      titulo: 'Atividade concluída!',
      resumo: resumoTemplate,
    },
  }
}

// Resumo curto em linguagem natural pro momento de revisão do form
// ("6 itens, nível 1, 3 rodadas") — separado do resumo de encerramento
// (que é o que a CRIANÇA lê) porque o público e o tom são diferentes.
export function formatConfigResumo(moldeKey, config) {
  const molde = MOLDES_REGISTRO[moldeKey]
  if (!molde || !config) return ''
  return molde.campos
    .map(({ key, label, unidade }) => (unidade ? `${config[key]} ${unidade}` : `${label.toLowerCase()} ${config[key]}`))
    .join(', ')
}
