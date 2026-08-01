export const ESTADOS_RESUMO = Object.freeze({
  CICLO_PLANEJADO: 'CICLO_PLANEJADO', // P — cycle.status = 'planned'
  CICLO_PAUSADO: 'CICLO_PAUSADO', // Z — cycle.status = 'paused'
  CICLO_CONCLUIDO: 'CICLO_CONCLUIDO', // F — cycle.status = 'completed'
  EXECUCAO_PENDENTE: 'EXECUCAO_PENDENTE', // 1
  MODULO_EM_REVISAO: 'MODULO_EM_REVISAO', // 2
  MODULO_BLOQUEADO: 'MODULO_BLOQUEADO', // 3
  JORNADA_CONCLUIDA: 'JORNADA_CONCLUIDA', // 4
  SEM_JORNADA: 'SEM_JORNADA', // 5
  MISSAO_DISPONIVEL: 'MISSAO_DISPONIVEL', // 6
  EM_DIA: 'EM_DIA', // 7
})

export function moduloAtualDe(modules = []) {
  return modules.find((m) => m.status !== 'concluido') ?? null
}

/**
 * Deriva o estado dominante do Resumo.
 *
 * @param {object}   args
 * @param {object}   args.cycle              support_cycles (precisa de .status)
 * @param {object?}  args.trail              child_trail mais recente (getLatestChildTrail) ou null
 * @param {Array}    args.modules            child_trail_modules do trail (getChildTrailModules)
 * @param {Array}    args.missions           child_trail_missions DO MÓDULO ATUAL (getChildTrailMissions)
 * @param {Array}    args.execucoesPendentes atividade_execucao com session_id null (listPendingExecucoes)
 * @returns {{ estado: string, dados: object }}
 */
export function derivarEstadoResumo({
  cycle,
  trail = null,
  modules = [],
  missions = [],
  execucoesPendentes = [],
} = {}) {
  const E = ESTADOS_RESUMO

  // ── §3.1 Portão de entrada: o estado do ciclo filtra tudo ──────────────
  if (!cycle || cycle.status === 'planned') return { estado: E.CICLO_PLANEJADO, dados: {} }
  if (cycle.status === 'paused') return { estado: E.CICLO_PAUSADO, dados: {} }
  if (cycle.status === 'completed') return { estado: E.CICLO_CONCLUIDO, dados: {} }
  // cycle.status === 'active' → segue pra cascata

  // ── §3.2 Cascata de prioridades (para no primeiro match) ───────────────

  // 1. Execução da criança sem sessão vinculada → revisar/registrar.
  //    É a prioridade máxima: a criança já fez algo que ainda não virou
  //    devolutiva pra família.
  if (execucoesPendentes.length > 0) {
    return {
      estado: E.EXECUCAO_PENDENTE,
      dados: { execucao: execucoesPendentes[0], total: execucoesPendentes.length },
    }
  }

  const modulo = moduloAtualDe(modules)

  // 2. Módulo atual aguardando revisão → decidir avançar/repetir/adaptar.
  if (modulo?.status === 'aguardando_revisao') {
    return { estado: E.MODULO_EM_REVISAO, dados: { modulo } }
  }

  // 3. Módulo atual bloqueado → preparar e liberar.
  if (modulo?.status === 'bloqueado') {
    return { estado: E.MODULO_BLOQUEADO, dados: { modulo } }
  }

  if (trail?.status === 'concluida') {
    return { estado: E.JORNADA_CONCLUIDA, dados: { trail } }
  }

  // 5. Nunca teve trilha → atribuir jornada.
  if (!trail) {
    return { estado: E.SEM_JORNADA, dados: {} }
  }

  // 6. Missão do módulo atual disponível → a criança tem o que fazer.
  //    Informativo, calmo, sem CTA de decisão: comunica que está em dia.
  if (missions.some((m) => m.status === 'disponivel')) {
    return { estado: E.MISSAO_DISPONIVEL, dados: { modulo } }
  }

  // 7. Nada esperando decisão do tutor. A calma é a mensagem.
  return { estado: E.EM_DIA, dados: {} }
}
