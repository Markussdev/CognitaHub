// Stub do contrato de atividade infantil (§5 da direção de design).
// Formato: molde, tema, config, instrucao, acolhimento, feedback_acerto,
// feedback_dificuldade, encerramento. A casca renderiza só contra este objeto.
//
// Integração futura: trocar esta função por uma leitura dos parâmetros da rota
// (?activity=&role=&return=) + busca no Supabase, mantendo o mesmo formato.
export function getStubActivityContract() {
  return {
    id: 'stub-contar-dinossauros',
    molde: 'contar',
    tema: 'dinossauros',
    config: {
      quantidade: 5,
      nivel: 1,
      rodadas: 3,
    },
    instrucao: 'Toque em cada dinossauro para contar.',
    missao: 'Contar dinossauros',
    acolhimento: {
      titulo: 'Oi! Vamos fazer uma missão curtinha?',
      fala: 'Eu adoro contar coisas. Bora começar?',
    },
    feedback_acerto: [
      'Isso mesmo! Você contou certinho.',
      'Boa! O número está certo.',
      'Muito bem, contamos juntos.',
    ],
    feedback_dificuldade: [
      'Quase lá. Vamos tentar de novo, com calma.',
      'Sem problema. Contar leva um tempinho — de novo?',
    ],
    encerramento: {
      titulo: 'Missão concluída!',
      resumo: 'Vocês contaram até {quantidade} dinossauros, {rodadas} {vezes}.',
    },
  }
}
