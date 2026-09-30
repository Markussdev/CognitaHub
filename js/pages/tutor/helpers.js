// Utilitários puros do painel do tutor: datas, nomes, listas e rótulos de status.
// Nada aqui toca o DOM além de simpleHead (cabeçalho de card).
import { el } from '../../lib/ui.js'

export function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function formatDate(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00Z`)
  return isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

export function formatLastSession(value) {
  if (!value) return 'sem registro'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return formatDate(value) ?? 'sem registro'

  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.max(0, Math.round((base - date) / 86400000))
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays <= 30) return `há ${diffDays} dias`
  return formatDate(value) ?? 'sem registro'
}

// Timestamp completo (com hora) das execuções do Modo Criança — diferente
// de formatLastSession, que só lida com datas puras (coluna `date` de
// sessions). "hoje às 14:32" em vez de só "hoje", porque o tutor pode
// registrar mais de uma execução no mesmo dia e precisa diferenciá-las.
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

export function formatDuracaoAprox(segundos) {
  if (!segundos) return null
  if (segundos < 60) return `${segundos}s`
  return `${Math.round(segundos / 60)} min`
}

export const COMO_ENCERROU_LABEL = {
  crianca_concluiu: 'Concluída',
  adulto_encerrou: 'Encerrada pelo adulto',
  pausa: 'Pausada',
  recusa: 'Recusada',
}

export function monthsBetween(start, end) {
  if (!start || !end) return 6
  const s = new Date(`${start}T00:00:00Z`), e = new Date(`${end}T00:00:00Z`)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 6
  return Math.max(1, (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()))
}

export function currentCycleMonth(start, end) {
  if (!start) return 1
  const now = new Date(), s = new Date(`${start}T00:00:00Z`)
  if (isNaN(s.getTime())) return 1
  const total = monthsBetween(start, end)
  const elapsed = (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + (now.getUTCMonth() - s.getUTCMonth()) + 1
  return Math.min(Math.max(elapsed, 1), total)
}

export function firstName(fullName) {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'criança'
}

// Supabase embute relação 1:1 via FK (child_activities em atividade_execucao)
// ora como objeto, ora como array de 1 — normaliza pros dois formatos.
export function pickEmbedded(value) {
  return Array.isArray(value) ? value[0] : value
}

export function simpleHead(title) {
  const head = el('div', 'card-h')
  head.append(el('h3', null, title))
  return head
}

// Normaliza valores que podem chegar como array real, JSON stringificado
// ("[\"a\",\"b\"]") ou literal de array do Postgres ("{a,\"b c\"}") — o
// schema real mistura os três conforme a coluna foi preenchida.
export function toList(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value !== 'string') return [String(value)]

  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1)
    if (!inner) return []
    return (inner.match(/"(?:[^"\\]|\\.)*"|[^,]+/g) || [])
      .map((s) => s.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'))
      .filter(Boolean)
  }
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch { /* não era JSON válido — trata como texto simples abaixo */ }
  }
  return [trimmed]
}

export const MODULE_STATUS_LABEL = {
  bloqueado: 'Bloqueado',
  liberado: 'Liberado',
  aguardando_revisao: 'Aguardando revisão',
  concluido: 'Concluído',
}

export const MISSION_STATUS_LABEL = {
  bloqueada: 'Bloqueada',
  disponivel: 'Disponível',
  concluida: 'Concluída',
}
