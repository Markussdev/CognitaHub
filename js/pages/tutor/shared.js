// Helpers e constantes compartilhados entre os domínios extraídos de
// js/pages/tutor.js (sessões em tutor/sessoes.js, perfil em tutor/perfil.js,
// atividades em tutor/atividades.js, resumo em tutor/resumo.js, início em
// tutor/home.js, suporte em tutor/support.js, command palette em
// tutor/command-palette.js) e os painéis que continuam no próprio tutor.js
// (Plano, rail, máquina de estados/navegação). Nada aqui tem lógica
// exclusiva de um único domínio — por isso fica num módulo-folha à parte,
// em vez de dentro de qualquer um dos outros, o que evitaria import
// circular entre eles.

import { el, ageFrom } from '../../lib/ui.js'
import { hasActiveTutorCycle } from '../../lib/library-access.mjs'

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

// Normaliza valores que podem chegar como array real, JSON stringificado
// ("[\"a\",\"b\"]") ou literal de array do Postgres ("{a,\"b c\"}") — o
// schema real mistura os três conforme a coluna foi preenchida. Usado pelo
// Resumo (contexto/chips), por buildLibraryHref (abaixo) e por tutor.js
// (atividade sugerida do Início).
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

// Href pra Biblioteca com o contexto completo da criança — usado pelo link
// do rail, pelo atalho "Abrir biblioteca de atividades" do ⌘K e pelo card
// Atalhos do Início (antes cada consumidor montava um subconjunto diferente
// de params; child_id sozinho já quebrava "Personalizar para
// Mateus"/recomendações se faltasse). Retorna null quando o ciclo não tem
// biblioteca disponível (hasActiveTutorCycle).
export function buildLibraryHref(cycle) {
  if (!hasActiveTutorCycle(cycle)) return null
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const params = new URLSearchParams()
  const childFirst = firstName(child.name)
  if (childFirst) params.set('child', childFirst)
  if (child.id) params.set('child_id', child.id)
  if (cycle.id) params.set('cycle_id', cycle.id)
  const age = ageFrom(child.birth_date)
  if (age != null) params.set('age', String(age))
  // Sinais pra "Recomendadas" da Biblioteca (regra explícita, sem IA) — dado
  // que o painel já carregou, zero query extra em atividades.js.
  const difficulties = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
  if (difficulties.length) params.set('focus', difficulties.join(','))
  const formats = toList(lp.preferred_formats)
  if (formats.length) params.set('pref', formats.join(','))
  return 'atividades.html?' + params.toString()
}

// Biblioteca local enxuta de atividades sugeridas: a sugestão muda conforme
// o foco do ciclo em vez de ser sempre a mesma atividade fixa. Usada pelo
// card "Atividade sugerida" do Início e pelo grupo "Atividades" do ⌘K.
// TODO(wiring:activities): trocar por consulta à tabela activities quando
// ela existir.
export const ACTIVITY_LIBRARY = {
  contagem: {
    title: 'Blocos de contagem coloridos', skill: 'contagem até 10',
    focus: 'contagem, adição simples e comparação de quantidades', time: '15-20 min',
    materials: 'blocos, tampinhas ou objetos pequenos',
    why: 'Combina com apoio visual e dura pouco — bom para sessões curtas.',
    nextStep: 'Repetir contagem até 10 com apoio visual e comparar dois grupos pequenos.',
  },
  'adição simples': {
    title: 'Soma com objetos concretos', skill: 'adição até 10',
    focus: 'adição simples com apoio visual', time: '15-20 min',
    materials: 'objetos pequenos ou desenhos',
    why: 'Trabalha a adição de forma concreta antes do cálculo abstrato.',
    nextStep: 'Avançar para somas com dois dígitos quando estiver confiante.',
  },
  'comparação de quantidades': {
    title: 'Qual grupo tem mais?', skill: 'comparação de quantidades',
    focus: 'comparar dois grupos de objetos', time: '10-15 min',
    materials: 'objetos pequenos de duas cores',
    why: 'Prepara o terreno para maior/menor antes da adição e subtração.',
    nextStep: 'Introduzir os símbolos de maior e menor depois da comparação visual.',
  },
  'sequência numérica': {
    title: 'Trilha numérica', skill: 'sequência de 1 a 10',
    focus: 'ordem numérica e reconhecimento dos números', time: '15-20 min',
    materials: 'cartões numerados ou trilha desenhada',
    why: 'Reforça a ordem dos números com movimento, bom para manter o foco.',
    nextStep: 'Aumentar a trilha até 20 quando a sequência até 10 estiver firme.',
  },
  subtração: {
    title: 'Tirando da coleção', skill: 'subtração até 10',
    focus: 'subtração simples com apoio concreto', time: '15-20 min',
    materials: 'objetos pequenos para retirar do grupo',
    why: 'Mostra a subtração como ação física antes do símbolo no papel.',
    nextStep: 'Registrar a subtração por escrito quando a ação concreta estiver clara.',
  },
}
const DEFAULT_ACTIVITY = ACTIVITY_LIBRARY.contagem

export function pickSuggestedActivity(difficulties) {
  const list = toList(difficulties).map((d) => d.toLowerCase())
  const match = Object.keys(ACTIVITY_LIBRARY).find((key) =>
    list.some((d) => d.includes(key) || key.includes(d))
  )
  return match ? ACTIVITY_LIBRARY[match] : DEFAULT_ACTIVITY
}

// Aritmética de meses do ciclo ("Mês 3/6") — usada pelo card Acompanhamentos
// do Início (tutor/home.js) e pelo chip de status do cabeçalho do Record
// (renderRecordHeader, tutor.js).
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
