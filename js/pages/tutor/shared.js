// Helpers de formatação e leitura de dado compartilhados entre o registro de
// sessão (js/pages/tutor/sessoes.js) e os demais painéis de js/pages/tutor.js
// (Resumo, Plano, Atividades, Início, rail). Nenhum destes tem lógica
// exclusiva de sessão — por isso ficam num módulo à parte em vez de dentro
// de qualquer um dos dois, o que evitaria import circular entre eles.

export const gatoMatematicoSrc = '/assets/gatomatematico-sem-fundo.png'

export function formatDate(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00Z`)
  return isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

// Timestamp completo (com hora) das execuções do Modo Criança — diferente de
// formatLastSession (js/pages/tutor.js), que só lida com datas puras (coluna
// `date` de sessions). "hoje às 14:32" em vez de só "hoje", porque o tutor
// pode registrar mais de uma execução no mesmo dia e precisa diferenciá-las.
export function formatExecucaoQuando(isoTimestamp) {
  if (!isoTimestamp) return null
  const d = new Date(isoTimestamp)
  if (isNaN(d.getTime())) return null

  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((base - dayOnly) / 86400000)

  if (diffDays === 0) return `hoje às ${hora}`
  if (diffDays === 1) return `ontem às ${hora}`
  const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
  return `${dataCurta} às ${hora}`
}

export function firstName(fullName) {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'criança'
}

// Supabase embute relação 1:1 via FK (child_activities em atividade_execucao)
// ora como objeto, ora como array de 1 — normaliza pros dois formatos.
export function pickEmbedded(value) {
  return Array.isArray(value) ? value[0] : value
}
