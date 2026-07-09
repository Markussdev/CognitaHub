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
    // sessão); {quantidade}/{rodadas}/{vezes} ficam para o formatTemplate do
    // casca, porque podem mudar via "mais fácil"/"mais difícil". {vezes} é
    // "vez"/"vezes" já concordado — ver render() em modo-crianca.js.
    encerramentoResumo: 'Vocês contaram até {quantidade} {tema}, {rodadas} {vezes}.',
  },
  identificar: {
    label: 'Identificar',
    disponivel: true,
    temas: [{ id: 'numeros', label: 'Números', disponivel: true }],
    // maiorNumero/opcoes moldam o sorteio (alvo + distratores, sempre entre
    // 1 e maiorNumero) — ver js/pages/moldes/identificar.js. nivel/rodadas
    // seguem o mesmo papel genérico que já têm no molde contar.
    campos: [
      // max 10 (não só 5) pra caber a etapa "Identificar números de 1 a 10"
      // do Plano — o molde em si (identificar.js) já era genérico o
      // suficiente pra não precisar de nenhuma mudança de lógica.
      { key: 'maiorNumero', label: 'Maior número', control: 'pills', unidade: null, min: 3, max: 10, default: 5 },
      { key: 'opcoes', label: 'Quantidade de opções', control: 'pills', unidade: null, min: 3, max: 5, default: 4 },
      { key: 'nivel', label: 'Nível', control: 'pills', unidade: null, min: 1, max: 5, default: 1 },
      { key: 'rodadas', label: 'Rodadas', control: 'pills', unidade: 'rodadas', min: 1, max: 5, default: 3 },
    ],
    // Só um placeholder pro form/revisão do tutor — o texto de verdade que a
    // criança vê muda a cada rodada (o alvo é sorteado na hora) e vem do
    // próprio molde via activeMold.instrucao, não deste campo. Ver
    // render()/montarMolde() em modo-crianca.js.
    instrucaoPadrao: 'Toque no número que eu disser.',
    tituloPadrao: (temaLabel) => `Identificar ${temaLabel.toLowerCase()}`,
    acolhimentoFala: 'Eu adoro encontrar números. Bora começar?',
    feedbackAcerto: [
      'Isso mesmo! Você encontrou certinho.',
      'Boa! Esse número está certo.',
      'Muito bem, você achou rapidinho.',
    ],
    feedbackDificuldade: [
      'Quase lá. Vamos tentar de novo, com calma.',
      'Sem problema. Olha bem os números — de novo?',
    ],
    encerramentoResumo: 'Vocês encontraram os números certos, {rodadas} {vezes}.',
  },
  comparar: { label: 'Comparar', disponivel: false, temas: [], campos: [] },
  associar: { label: 'Associar', disponivel: false, temas: [], campos: [] },
}

// Monta o contrato completo (o formato que o Modo Criança renderiza) a partir
// de molde+tema+config+instrucao — usado tanto pela leitura real de uma
// child_activity (js/pages/modo-crianca.js) quanto pela prévia ao vivo do
// form de composição (js/pages/tutor.js). Fala/feedback/resumo de encerramento
// nunca vêm do banco nem do form — são o padrão do molde, sempre.
//
// Sprint 2 (Missão curtinha): a saudação de acolhimento passou a ser genérica
// e da casca, não mais autorada por molde — reduz o que um molde novo precisa
// definir. O que identifica a atividade pra criança é a etiqueta curta
// `missao` (ex.: "Contar dinossauros"), mostrada como "Missão: {missao}".
const SAUDACAO_ACOLHIMENTO = 'Oi! Vamos fazer uma missão curtinha?'

export function buildContractFromParts({ molde: moldeKey, tema, config, instrucao, titulo }) {
  const molde = MOLDES_REGISTRO[moldeKey]
  const temaLabel = molde?.temas.find((t) => t.id === tema)?.label || tema || ''
  const resumoTemplate = (molde?.encerramentoResumo || 'Atividade concluída.')
    .replace('{tema}', temaLabel.toLowerCase())
  const missao = molde?.tituloPadrao?.(temaLabel) || titulo || molde?.label || ''

  return {
    molde: moldeKey,
    tema,
    config: config || {},
    instrucao,
    missao,
    acolhimento: {
      titulo: SAUDACAO_ACOLHIMENTO,
      fala: molde?.acolhimentoFala || 'Bora fazer essa atividade juntos?',
    },
    feedback_acerto: molde?.feedbackAcerto?.length ? molde.feedbackAcerto : ['Muito bem!'],
    feedback_dificuldade: molde?.feedbackDificuldade?.length
      ? molde.feedbackDificuldade
      : ['Vamos tentar de novo, com calma.'],
    encerramento: {
      titulo: 'Missão concluída!',
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
