// Helpers e constantes compartilhados entre os domínios extraídos de
// js/pages/tutor.js (sessões em tutor/sessoes.js, perfil em tutor/perfil.js)
// e os painéis que continuam no próprio tutor.js (Resumo, Plano, Atividades,
// Início, rail). Nada aqui tem lógica exclusiva de um único domínio — por
// isso fica num módulo-folha à parte, em vez de dentro de qualquer um dos
// dois, o que evitaria import circular entre eles.

import { el } from '../../lib/ui.js'

export const gatoMatematicoSrc = '/assets/gatomatematico-sem-fundo.png'

// Estados de profiles.status que ainda não liberaram acesso pleno ao papel
// de tutor — usado tanto pela máquina de estados do painel (tutor.js) quanto
// pela tela de perfil (mostra "Em análise" em vez de "Validado").
export const REVIEW_STATUSES = ['pending', 'waiting_review', 'tutor_pending']

export function simpleHead(title) {
  const head = el('div', 'card-h')
  head.append(el('h3', null, title))
  return head
}

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

// "Há N dias" / "hoje" / "ontem" para uma data pura (coluna `date`) —
// compartilhado entre o Início/cmdk (tutor.js) e o acervo de Atividades
// (tutor/atividades.js). Diferente de formatExecucaoQuando, que lida com
// timestamp completo das execuções do Modo Criança.
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

// Tradução de child_trail_missions.status — usada tanto pelo acervo de
// Atividades (rótulo "Jornada · Disponível" no item) quanto pelo painel
// Plano/trilha-formal (tutor.js). É só um dicionário de exibição, não
// acopla Atividades ao domínio de Jornada.
export const MISSION_STATUS_LABEL = {
  bloqueada: 'Bloqueada',
  disponivel: 'Disponível',
  concluida: 'Concluída',
}

// Menu contextual "⋯" (Duplicar/Editar/Arquivar, Cancelar ciclo…) — usado
// pelo acervo de Atividades e pelo cabeçalho da Jornada em tutor.js.
export function kebabMenu(items) {
  const wrap = el('div', 'kebab')
  const btn = el('button', 'btn btn-ghost btn-sm kebab-btn', '⋯')
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Mais ações')
  btn.setAttribute('aria-haspopup', 'true')
  btn.setAttribute('aria-expanded', 'false')
  const menu = el('div', 'kebab-menu')
  menu.hidden = true

  function close() {
    menu.hidden = true
    btn.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', onDoc)
    document.removeEventListener('keydown', onKey)
  }
  function onDoc(ev) { if (!wrap.contains(ev.target)) close() }
  function onKey(ev) { if (ev.key === 'Escape') close() }

  items.forEach(({ label, run, tone }) => {
    const it = el('button', `kebab-item${tone ? ` kebab-item--${tone}` : ''}`, label)
    it.type = 'button'
    it.addEventListener('click', () => { close(); run() })
    menu.append(it)
  })

  btn.addEventListener('click', () => {
    if (menu.hidden) {
      menu.hidden = false
      btn.setAttribute('aria-expanded', 'true')
      setTimeout(() => {
        document.addEventListener('click', onDoc)
        document.addEventListener('keydown', onKey)
      }, 0)
    } else close()
  })

  wrap.append(btn, menu)
  return wrap
}
