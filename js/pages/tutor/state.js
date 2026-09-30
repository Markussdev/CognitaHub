// Estado compartilhado do painel do tutor. Só entra aqui o que MAIS DE UM módulo
// precisa ler ou escrever; o resto fica dentro do módulo que o usa.

// Sessão autenticada (requireRole). Definida uma vez, em bootstrapTutor().
export let session = null
export function setSession(value) {
  session = value
}

// "Entregas" vindas de outras telas, lidas uma vez no carregamento (handoffs.js)
// e consumidas — viram null — quando o acompanhamento é renderizado (record.js):
//   activity — ?activity=<uuid> (Biblioteca) ou retorno do Modo Condução
//   preset   — ?preset=<slug> (Biblioteca, "Personalizar para ...")
//   etapa    — ?plan=&step= (volta de trilha.html)
export const handoffs = { activity: null, preset: null, etapa: null }

// O que o painel já sabe do acompanhamento atual:
//   derived        — resultado de deriveTutorState (estado + ciclo)
//   recentSessions — últimas sessões carregadas (alimenta a busca ⌘K)
export const current = { derived: null, recentSessions: [] }
