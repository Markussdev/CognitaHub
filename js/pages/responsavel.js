import { el, ageFrom, initials } from '../lib/ui.js'
import { requireRole, signOut } from '../lib/auth.js'
import { getAvatarUrl } from '../lib/avatar.js'
import { wireRailToggle } from '../lib/rail.js'
import { getGuardianChildren, getChildAppIdentity } from '../data/guardian.js'
import { getLatestChildTrail, getChildTrailModules, getChildTrailMissions } from '../data/trilha-formal.js'
import { listPairedDevices, revokePairedDevice, createPairingCode } from '../data/pareamento.js'
import astronautaSrc from '../../assets/cat-astronauta.png'
import cientistaSrc from '../../assets/cat-cientista.png'
import magoSrc from '../../assets/cat-mago.png'
import pintorSrc from '../../assets/cat-pintor.png'
import mascoteSrc from '../../assets/gatomatematico-sem-fundo.png'
import { emblemaUrl } from '../lib/trilha-assets.js'

// ── Painel da família — devolutiva, não operação ─────────────────────────────
// A família não é uma versão limitada do tutor: ela responde só a quatro
// perguntas — o que a criança fez, como se saiu, o que mudou, e o que o
// tutor recomenda agora. Quatro espaços: Início (Resumo) · Jornada ·
// Sessões · Criança. Tudo dado real:
//   · children/support_cycles/tutor/learning_profiles (js/data/guardian.js)
//   · sessões via get_family_sessions_v2 (níveis 1+2, NUNCA a nota interna)
//   · jornada formal via RLS de guardian (ct/ctm/ctmi_guardian_select,
//     docs/supabase-fase-5-trilha-formal.sql)
// Poda honesta (a versão anterior era mock com dado real remendado por
// cima): Relatórios (não existe monthly_reports), "Atividades para casa" e
// "Próxima atividade sugerida" (não existe curadoria/motor), tutor e sessões
// de exemplo ("Marina Souza"/"Lucas") — agora é dado real ou vazio honesto.

// ── Avatar Cognita da criança (SEM foto — decisão deliberada) ────────────────
// A criança nunca usa foto própria no produto: mascote decorativo, escolhido
// deterministicamente pelo id (estável entre visitas, sem coluna nova).
const MASCOTES = [astronautaSrc, cientistaSrc, magoSrc, pintorSrc]
function mascoteDe(childId) {
  const s = String(childId || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return MASCOTES[h % MASCOTES.length]
}

// Quando a criança personaliza nome/avatar no app dela, o painel da família
// reflete a mesma escolha (chip, jornada, perfil) — em vez do nome oficial
// e do mascote determinístico. Sem personalização (ou coluna indisponível
// nesta base), cai no fallback de sempre.
const AVATAR_BY_KEY = {
  astronauta: astronautaSrc,
  cientista: cientistaSrc,
  mago: magoSrc,
  pintor: pintorSrc,
}
const AVATAR_LABEL = {
  astronauta: 'Gato astronauta',
  cientista: 'Gato cientista',
  mago: 'Gato mago',
  pintor: 'Gato pintor',
}
function childDisplayName(child) {
  if (!child) return ''
  return child.preferred_name?.trim() || firstName(child.name)
}
function childMascot(child) {
  if (!child) return mascoteDe(null)
  return AVATAR_BY_KEY[child.avatar_key] || mascoteDe(child.id)
}

// ── Estado carregado no boot ─────────────────────────────────────────────────

let D = {
  guardianName: '',
  child: null,       // children + learning_profiles
  cycle: null,       // support_cycles + profiles (tutor) + sessions (v2)
  tutor: null,
  sessions: [],      // mais recente primeiro
  trail: null,       // child_trail mais recente do ciclo (ou null)
  modules: [],       // child_trail_modules
  missions: [],      // missões do módulo atual
  status: 'waiting_review',
  pairedDevices: [], // aparelhos do app da criança (ativos + revogados)
  devicesError: null,
}

let activeView = 'resumo'

const $ = (sel) => document.querySelector(sel)

// ── Helpers de formatação ────────────────────────────────────────────────────

function firstName(fullName) {
  return (fullName ?? '').trim().split(/\s+/)[0] || ''
}

// Tokenizer caractere-a-caractere pra texto[] do Postgres, ex.:
// {animais, "blocos coloridos", elogios}. Precisa ser tokenizer, não regex
// de alternância (/"(...)"|([^,]+)/g) — testado e o ramo sem aspas vencia
// no espaço logo antes de uma aspa (posição onde só ele "começa a casar"),
// engolindo a aspa inteira como texto em vez de deixar o ramo com aspas
// disparar. Suporta \" escapado dentro do trecho entre aspas.
function parsePgArrayLiteral(inner) {
  const items = []
  let i = 0
  const n = inner.length
  while (i < n) {
    while (i < n && /\s/.test(inner[i])) i += 1
    if (i >= n) break
    let val = ''
    if (inner[i] === '"') {
      i += 1
      while (i < n && inner[i] !== '"') {
        if (inner[i] === '\\' && i + 1 < n) { val += inner[i + 1]; i += 2 }
        else { val += inner[i]; i += 1 }
      }
      i += 1 // fecha a aspa
      while (i < n && inner[i] !== ',') i += 1 // até a próxima vírgula
    } else {
      while (i < n && inner[i] !== ',') { val += inner[i]; i += 1 }
    }
    i += 1 // pula a vírgula
    items.push(val.trim())
  }
  return items.filter(Boolean)
}

// motivators/avoidances podem chegar em formatos diferentes dependendo de
// como o dado entrou (form real via .getAll() vira array de verdade pelo
// supabase-js; dado seedado direto por SQL às vezes vem como texto literal
// do Postgres — {a,"b c"} — ou como string JSON — ["a","b"]). Trata os três
// formatos + string simples separada por vírgula, sem vazar sintaxe crua.
function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parsePgArrayLiteral(trimmed.slice(1, -1))
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
    } catch {
      // não era JSON válido — cai pro split por vírgula abaixo
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

function formatQuando(value) {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return formatDate(value) ?? ''
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.max(0, Math.round((base - date) / 86400000))
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays <= 30) return `há ${diffDays} dias`
  return formatDate(value) ?? ''
}

function monthsBetween(startDate, endDate) {
  if (!startDate || !endDate) return 6
  const a = new Date(`${startDate}T00:00:00`)
  const b = new Date(`${endDate}T00:00:00`)
  if (isNaN(a) || isNaN(b)) return 6
  return Math.max(1, Math.round((b - a) / (30.44 * 86400000)))
}

function currentCycleMonth(startDate, endDate) {
  if (!startDate) return 1
  const a = new Date(`${startDate}T00:00:00`)
  if (isNaN(a)) return 1
  const m = Math.floor((Date.now() - a) / (30.44 * 86400000)) + 1
  return Math.min(Math.max(1, m), monthsBetween(startDate, endDate))
}

// Chaves = enum real de learning_profiles.attention_span (confirmado em
// js/pages/cadastro-responsavel.js ATTENTION_MAP / js/data/signup.js
// mapAttentionSpan) — 'curta'/'media'/'longa' nunca existiram no banco,
// eram um palpite meu não conferido; por isso "medium" vazava cru na tela.
const ATTENTION_LABEL = {
  short: 'Períodos curtos de atenção — pausas ajudam',
  medium: 'Atenção média — sessões de 15 a 25 minutos funcionam bem',
  long: 'Consegue manter o foco por períodos mais longos',
  unknown: null, // "ainda não sei" no cadastro — nada de verdade pra mostrar
}

// ── Suporte (contato honesto — sem formulário que não persiste) ──────────────

function buildSupportBody() {
  const frag = document.createDocumentFragment()
  const childFirst = firstName(D.child?.name)
  if (childFirst) {
    const ctx = el('div', 'support-context')
    ctx.append(document.createTextNode('Sobre: '), el('b', null, childFirst))
    frag.append(ctx)
  }
  frag.append(el('p', null, 'Dúvidas sobre o acompanhamento, o tutor ou seus dados? A equipe Cognita responde em até 48h.'))
  frag.append(el('div', 'support-divider'))
  const actions = el('div', 'support-actions')
  const mail = el('a', 'btn-outline', 'Enviar e-mail')
  mail.href = `mailto:cognitahub1@gmail.com?subject=${encodeURIComponent(childFirst ? `Acompanhamento de ${childFirst}` : 'Ajuda no Cognita Hub')}`
  const whats = el('a', 'btn-outline', 'Chamar no WhatsApp')
  whats.href = 'https://wa.me/559182050907'
  whats.target = '_blank'
  whats.rel = 'noopener'
  actions.append(mail, whats)
  frag.append(actions)
  return frag
}

function openSupportDrawer() {
  const body = $('[data-support-body]')
  const drawer = $('[data-support-drawer]')
  const backdrop = $('[data-support-backdrop]')
  if (!body || !drawer || !backdrop) return
  body.replaceChildren(buildSupportBody())
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

function closeSupportDrawer() {
  $('[data-support-drawer]')?.classList.remove('open')
  $('[data-support-backdrop]')?.classList.remove('open')
  $('[data-support-drawer]')?.setAttribute('aria-hidden', 'true')
}

// ── Blocos compartilhados ────────────────────────────────────────────────────

function viewHead(title, sub, { comChip = true } = {}) {
  const head = el('header', 'fam-head')
  const tx = el('div')
  tx.append(el('p', 'kicker', 'Painel da família'))
  tx.append(el('h1', null, title))
  if (sub) tx.append(el('p', 'sub', sub))
  head.append(tx)

  if (comChip && D.child) {
    const chip = el('div', 'fam-child-chip')
    const img = document.createElement('img')
    img.src = childMascot(D.child)
    img.alt = ''
    const chipTx = el('div', 'tx')
    chipTx.append(el('span', null, 'Acompanhando'))
    const idade = ageFrom(D.child.birth_date)
    chipTx.append(el('strong', null, `${childDisplayName(D.child)}${idade != null ? ` · ${idade} anos` : ''}`))
    chip.append(img, chipTx)
    head.append(chip)
  }
  return head
}

function cardPad(...children) {
  const card = el('div', 'card card-pad')
  children.forEach((c) => c && card.append(c))
  return card
}

function famEmpty(strongText, spanText) {
  const wrap = el('div', 'fam-empty')
  const img = document.createElement('img')
  img.src = mascoteSrc
  img.alt = ''
  wrap.append(img, el('strong', null, strongText), el('span', null, spanText))
  return wrap
}

// Card da devolutiva (última sessão) — o coração do Resumo.
function renderDevolutivaCard() {
  const last = D.sessions[0]
  const card = el('div', 'card card-pad fam-devolutiva')
  card.append(el('p', 'kicker', 'Última devolutiva do tutor'))

  if (!last) {
    card.append(el('p', 'quote', `O tutor ainda não registrou a primeira sessão. Depois de cada encontro, o resumo do que aconteceu aparece aqui — escrito para você, sem termos técnicos.`))
    return card
  }

  card.append(el('p', 'quote', last.family_summary || 'O tutor registrou esta sessão sem resumo escrito.'))

  const who = el('div', 'who')
  const av = el('span', 'av', initials(D.tutor?.name || 'T'))
  if (D.tutor?.avatar_path) {
    getAvatarUrl(D.tutor.avatar_path).then((url) => {
      if (!url) return
      av.textContent = ''
      const img = document.createElement('img')
      img.src = url; img.alt = ''
      av.append(img)
    })
  }
  who.append(av, document.createTextNode(`${D.tutor?.name || 'Tutor'} · ${formatQuando(last.date)}`))
  card.append(who)

  if (last.next_step) {
    const next = el('div', 'fam-next')
    next.append(el('b', null, 'O que vem agora'))
    next.append(el('p', null, last.next_step))
    card.append(next)
  }
  return card
}

function renderTutorCard() {
  const card = el('div', 'card card-pad')
  card.append(el('p', 'kicker', 'Tutor que acompanha'))

  if (!D.tutor) {
    card.append(el('p', 'sub', 'O tutor aparece aqui assim que a equipe Cognita fizer o pareamento.'))
    return card
  }

  const row = el('div', 'fam-tutor')
  row.style.marginTop = '10px'
  const av = el('div', 'av', initials(D.tutor.name))
  if (D.tutor.avatar_path) {
    getAvatarUrl(D.tutor.avatar_path).then((url) => {
      if (!url) return
      av.textContent = ''
      const img = document.createElement('img')
      img.src = url; img.alt = ''
      av.append(img)
    })
  }
  const tx = el('div')
  tx.append(el('b', null, D.tutor.name))
  tx.append(el('div', 'form', D.tutor.tutor_formation
    ? `${D.tutor.tutor_formation} · validada pela equipe Cognita`
    : 'Validado(a) pela equipe Cognita'))
  row.append(av, tx)
  card.append(row)

  if (D.tutor.tutor_presentation) {
    const p = el('p', null, `"${D.tutor.tutor_presentation}"`)
    p.style.cssText = 'margin-top:10px;font-size:.86rem;color:var(--ink-soft);font-style:italic;line-height:1.55;'
    card.append(p)
  }

  card.append(el('div', 'fam-tutor-note', 'O contato é sempre mediado pela equipe Cognita — qualquer dúvida, use a Ajuda.'))
  return card
}

// ── View: Resumo (Início) ────────────────────────────────────────────────────

const CYCLE_PILL = {
  active: { dot: 'ok', text: 'Ciclo ativo' },
  planned: { dot: 'info', text: 'Ciclo começa em breve' },
  paused: { dot: 'warn', text: 'Ciclo pausado' },
  completed: { dot: 'ok', text: 'Ciclo concluído' },
}

function renderHero() {
  const c = D.cycle
  const hero = el('div', 'fam-hero')
  const top = el('div', 'fam-hero-top')
  const pillInfo = CYCLE_PILL[c.status] ?? CYCLE_PILL.active
  const pill = el('span', 'fam-pill')
  pill.append(el('span', `dot ${pillInfo.dot}`), document.createTextNode(pillInfo.text))
  top.append(pill)
  hero.append(top)

  const nome = childDisplayName(D.child)
  const TITULO = {
    active: `O acompanhamento de ${nome} está em andamento.`,
    planned: `Tudo pronto — o ciclo de ${nome} vai começar.`,
    paused: `O acompanhamento de ${nome} está pausado.`,
    completed: `${nome} concluiu o ciclo de acompanhamento. 🎉`,
  }
  hero.append(el('h2', null, TITULO[c.status] ?? TITULO.active))

  if (c.main_goal) hero.append(el('p', 'goal', `Objetivo do ciclo: ${c.main_goal}`))

  if (c.status === 'active') {
    const total = monthsBetween(c.start_date, c.end_date)
    const atual = currentCycleMonth(c.start_date, c.end_date)
    const meses = el('div', 'fam-meses')
    const bar = el('div', 'fam-meses-bar')
    const fill = el('i')
    fill.style.width = `${Math.round((atual / total) * 100)}%`
    bar.append(fill)
    meses.append(bar, el('span', 'num', `Mês ${atual} de ${total}`))
    hero.append(meses)
  }
  return hero
}

function renderJornadaMini() {
  const card = el('div', 'card card-pad fam-jornada-mini')
  card.append(el('p', 'kicker', `Jornada de ${childDisplayName(D.child)}`))

  if (!D.trail) {
    card.append(el('p', 'sub', 'O tutor ainda está preparando a jornada — ela aparece aqui quando começar.'))
    return card
  }

  const titulo = el('p', null, D.trail.trail_templates?.title || 'Jornada')
  titulo.style.cssText = 'margin-top:8px;font-weight:700;color:var(--ink);font-size:.95rem;'
  card.append(titulo)

  const atual = D.modules.find((m) => m.status !== 'concluido')
  const pos = atual?.trail_modules?.position ?? D.modules.length
  const feitas = D.missions.filter((m) => m.status === 'concluida').length
  const linha = [`Módulo ${pos} de ${D.modules.length}`]
  if (D.missions.length) linha.push(`${feitas} de ${D.missions.length} missões concluídas`)
  const sub = el('p', 'sub', D.trail.status === 'concluida' ? 'Jornada concluída! 🎉' : linha.join(' · '))
  sub.style.marginTop = '3px'
  card.append(sub)

  if (D.missions.length) {
    const traj = el('div', 'traj')
    D.missions.forEach((m) => {
      const cls = m.status === 'concluida' ? 'done' : m.status === 'disponivel' ? 'now' : ''
      traj.append(el('span', `fam-dot ${cls}`, m.status === 'concluida' ? '✓' : String(m.mission_templates?.position ?? '·')))
    })
    card.append(traj)
  }

  const link = el('button', 'fam-link', 'Ver a jornada completa →')
  link.type = 'button'
  link.addEventListener('click', () => switchView('jornada'))
  card.append(link)
  return card
}

function renderResumoAtivo() {
  const stack = el('div', 'fam-stack')
  stack.append(renderHero())
  stack.append(renderDevolutivaCard())
  const cols = el('div', 'fam-cols')
  cols.append(renderJornadaMini(), renderTutorCard())
  stack.append(cols)
  return stack
}

// Pré-ciclo: a jornada do cadastro em 3 passos honestos, sem inventar prazo.
const PRE_STEPS = [
  { id: 'analise', title: 'Cadastro em análise', desc: 'A equipe Cognita revisa as informações da criança.' },
  { id: 'match', title: 'Encontrando o tutor ideal', desc: 'Buscamos alguém com formação e disponibilidade compatíveis.' },
  { id: 'ciclo', title: 'Início do ciclo', desc: 'Com o tutor definido, o acompanhamento de 6 meses começa.' },
]

function renderResumoPre() {
  const stack = el('div', 'fam-stack')

  const COPY = {
    waiting_review: { now: 'analise', title: 'Recebemos o cadastro.', sub: 'A equipe está revisando com carinho — você não precisa fazer nada agora.' },
    revision_requested: { now: 'analise', warn: true, title: 'Precisamos de um ajuste no cadastro.', sub: 'A equipe Cognita vai entrar em contato (ou fale com a gente pela Ajuda) para completar uma informação.' },
    waiting_match: { now: 'match', title: 'Cadastro aprovado!', sub: 'Agora estamos procurando o tutor ideal — avisamos assim que houver um pareamento.' },
    rejected: { now: 'analise', warn: true, title: 'Não foi possível seguir com o cadastro.', sub: 'Fale com a equipe pela Ajuda para entender o motivo e os próximos passos.' },
  }
  const copy = COPY[D.status] ?? COPY.waiting_review

  const hero = el('div', 'fam-hero')
  const pill = el('span', 'fam-pill')
  pill.append(el('span', `dot ${copy.warn ? 'warn' : 'info'}`), document.createTextNode('Antes do ciclo'))
  hero.append(pill)
  hero.append(el('h2', null, copy.title))
  hero.append(el('p', 'goal', copy.sub))
  stack.append(hero)

  const nowIdx = PRE_STEPS.findIndex((s) => s.id === copy.now)
  const card = cardPad(el('p', 'kicker', 'Como funciona daqui pra frente'))
  const steps = el('div', 'fam-status-steps')
  PRE_STEPS.forEach((s, i) => {
    const step = el('div', `fam-status-step${i < nowIdx ? ' done' : i === nowIdx ? ' now' : ''}`)
    step.append(el('span', 'n', i < nowIdx ? '✓' : String(i + 1)))
    const tx = el('div')
    tx.append(el('b', null, s.title), el('p', null, s.desc))
    step.append(tx)
    steps.append(step)
  })
  card.append(steps)
  stack.append(card)
  return stack
}

function viewResumo() {
  const page = el('div', 'fam-page')
  page.append(viewHead(`Olá, ${firstName(D.guardianName) || 'família'}.`,
    D.child ? `Acompanhe aqui o caminho de ${childDisplayName(D.child)} no Cognita.` : ''))
  page.append(D.cycle ? renderResumoAtivo() : renderResumoPre())
  return page
}

// ── View: Jornada ────────────────────────────────────────────────────────────

const MODULE_FAM_LABEL = {
  bloqueado: 'Ainda vem',
  liberado: 'Em andamento',
  aguardando_revisao: 'Em revisão com o tutor',
  concluido: 'Concluído',
}
const MISSION_FAM = {
  concluida: { cls: 'done', label: 'Concluída' },
  disponivel: { cls: 'now', label: 'É a próxima' },
  bloqueada: { cls: 'wait', label: 'Ainda vem' },
}

function viewJornada() {
  const page = el('div', 'fam-page')
  const nome = childDisplayName(D.child)
  page.append(viewHead(`Jornada de ${nome}`,
    'Uma sequência de missões que o tutor preparou e acompanha de perto. A criança faz cada missão no aparelho pareado.'))

  const stack = el('div', 'fam-stack')

  if (!D.cycle || D.cycle.status === 'planned') {
    stack.append(cardPad(famEmpty('A jornada aparece aqui quando o ciclo começar.',
      'Com o tutor definido e o ciclo ativo, você acompanha cada missão nesta tela.')))
    page.append(stack)
    return page
  }

  if (!D.trail) {
    stack.append(cardPad(famEmpty(`O tutor está preparando a jornada de ${nome}.`,
      'Assim que a primeira trilha for atribuída, o caminho completo aparece aqui.')))
    page.append(stack)
    return page
  }

  if (D.trail.status === 'concluida') {
    stack.append(el('div', 'fam-banner ok', `🎉 ${nome} concluiu a jornada "${D.trail.trail_templates?.title || ''}"! O histórico continua guardado aqui.`))
  } else if (D.trail.status === 'pausada') {
    stack.append(el('div', 'fam-banner warn', 'A jornada está pausada no momento — o tutor e a equipe avisam quando retomar.'))
  }

  const trilhaCard = cardPad(el('p', 'kicker', D.trail.trail_templates?.title || 'Jornada'))
  if (D.trail.trail_templates?.description) {
    const desc = el('p', null, D.trail.trail_templates.description)
    desc.style.cssText = 'margin-top:8px;font-size:.9rem;color:var(--ink-soft);line-height:1.55;'
    trilhaCard.append(desc)
  }

  const atual = D.modules.find((m) => m.status !== 'concluido')
  const stepper = el('div', 'fam-modstep')
  stepper.style.marginTop = '14px'
  D.modules.forEach((m) => {
    const tm = m.trail_modules
    const isNow = m.id === atual?.id
    const step = el('span', `step${m.status === 'concluido' ? ' done' : isNow ? ' now' : ''}`)
    step.append(el('span', 'n', m.status === 'concluido' ? '✓' : String(tm?.position ?? '·')))
    step.append(document.createTextNode(tm?.title ?? 'Módulo'))
    stepper.append(step)
  })
  trilhaCard.append(stepper)
  stack.append(trilhaCard)

  if (atual) {
    const tm = atual.trail_modules
    const modCard = cardPad(el('p', 'kicker', `Agora: ${tm?.title ?? 'Módulo atual'} · ${MODULE_FAM_LABEL[atual.status] ?? ''}`))
    if (tm?.objective) {
      const obj = el('p', null, tm.objective)
      obj.style.cssText = 'margin-top:8px;font-size:.9rem;color:var(--ink-soft);line-height:1.5;'
      modCard.append(obj)
    }
    if (D.missions.length) {
      const list = el('div')
      list.style.marginTop = '10px'
      D.missions.forEach((m) => {
        const mt = m.mission_templates
        const row = el('div', 'fam-missao')
        const img = document.createElement('img')
        img.src = emblemaUrl(mt?.emblema || 'identificar')
        img.alt = ''
        row.append(img)
        row.append(el('span', 'tx', mt?.title ?? 'Missão'))
        const st = MISSION_FAM[m.status] ?? MISSION_FAM.bloqueada
        row.append(el('span', `st ${st.cls}`, st.label))
        list.append(row)
      })
      modCard.append(list)
    } else if (atual.status === 'bloqueado') {
      const p = el('p', null, 'O tutor ainda está preparando as missões deste módulo.')
      p.style.cssText = 'margin-top:10px;font-size:.86rem;color:var(--muted);'
      modCard.append(p)
    }
    stack.append(modCard)
  }

  page.append(stack)
  return page
}

// ── View: Sessões ────────────────────────────────────────────────────────────

function renderSessaoCard(s) {
  const card = el('div', 'card card-pad fam-sessao')
  card.append(el('p', 'when', `${formatQuando(s.date)} · ${formatDate(s.date) ?? ''}`))
  card.append(el('h3', null, s.activity_title || 'Sessão registrada'))
  card.append(el('p', 'resumo', s.family_summary || 'O tutor registrou esta sessão sem resumo escrito.'))

  const chips = el('div', 'chips')
  const execs = Array.isArray(s.execucoes) ? s.execucoes : []
  if (execs.length) chips.append(el('span', null, `${execs.length} ${execs.length === 1 ? 'atividade no aparelho' : 'atividades no aparelho'}`))
  if (s.duration_minutes) chips.append(el('span', 'num', `${s.duration_minutes} min`))
  if (s.focus_area) chips.append(el('span', null, s.focus_area))
  if (chips.children.length) card.append(chips)

  if (s.next_step) {
    const next = el('div', 'fam-next')
    next.append(el('b', null, 'Próximo passo'))
    next.append(el('p', null, s.next_step))
    card.append(next)
  }
  return card
}

function viewSessoes() {
  const page = el('div', 'fam-page')
  const nome = childDisplayName(D.child)
  page.append(viewHead(`Sessões de ${nome}`,
    'A devolutiva de cada encontro, escrita pelo tutor para a família.'))

  const stack = el('div', 'fam-stack')

  if (!D.cycle || D.cycle.status === 'planned') {
    stack.append(cardPad(famEmpty('As sessões aparecem aqui quando o ciclo começar.',
      'Depois de cada encontro, o tutor escreve um resumo do que aconteceu — sem termos técnicos.')))
  } else if (!D.sessions.length) {
    stack.append(cardPad(famEmpty('Nenhuma sessão registrada ainda.',
      `Depois do primeiro encontro, o resumo escrito pelo tutor de ${nome} aparece aqui.`)))
  } else {
    D.sessions.forEach((s) => stack.append(renderSessaoCard(s)))
  }

  page.append(stack)
  return page
}

// ── View: Criança ────────────────────────────────────────────────────────────

function factRow(label, value) {
  const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : value
  if (!text) return null
  const row = el('div', 'fam-fact')
  row.append(el('dt', null, label), el('dd', null, text))
  return row
}

function viewCrianca() {
  const page = el('div', 'fam-page')
  const nome = childDisplayName(D.child)
  page.append(viewHead(`Sobre ${nome}`, 'O que o tutor e a equipe sabem para adaptar cada atividade.'))

  const stack = el('div', 'fam-stack')
  const child = D.child
  const lp = child.learning_profiles ?? {}

  const idCard = el('div', 'card card-pad')
  const idRow = el('div', 'fam-perfil-id')
  const img = document.createElement('img')
  img.className = 'mascote'
  img.src = childMascot(child)
  img.alt = ''
  const idTx = el('div')
  idTx.append(el('h2', null, childDisplayName(child)))
  const idade = ageFrom(child.birth_date)
  idTx.append(el('p', 'meta', [idade != null ? `${idade} anos` : null, child.school_year].filter(Boolean).join(' · ') || '—'))
  idRow.append(img, idTx)
  idCard.append(idRow)
  stack.append(idCard)

  const focos = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
  const aprendeCard = cardPad(el('p', 'kicker', `Como ${nome} aprende melhor`))
  const facts = el('dl', 'fam-facts')
  ;[
    factRow('Foco atual', focos),
    factRow('Prefere', toList(lp.preferred_formats)),
    factRow('Atenção', ATTENTION_LABEL[lp.attention_span] ?? null),
    factRow('O que motiva', toList(lp.motivators)),
    factRow('O que evitar', toList(lp.avoidances)),
    factRow('Notas sensoriais', child.sensory_notes),
    factRow('Rotina', child.routine_notes),
  ].forEach((row) => row && facts.append(row))

  if (facts.children.length) {
    aprendeCard.append(facts)
  } else {
    aprendeCard.append(famEmpty('Perfil pedagógico ainda não detalhado.',
      'As informações do cadastro aparecem aqui — e o tutor completa aos poucos, junto com a equipe.'))
  }
  stack.append(aprendeCard)

  stack.append(renderDeviceAppCard())
  stack.append(renderTutorCard())
  page.append(stack)
  return page
}

// ── Aplicativo da criança (identidade + aparelhos conectados) ───────────────
// View-only nesta primeira versão: nome e avatar são escolhidos pela
// criança no app dela; o responsável só acompanha e pode revogar um
// aparelho. Editar por aqui fica pra decidir depois (não é o produto hoje).

function formatDeviceDate(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function formatDeviceWhen(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
    return `hoje às ${time}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'ontem'
  return formatDeviceDate(value)
}

function renderDeviceRow(device) {
  const row = el('div', 'fam-device')
  row.append(el('span', 'fam-device-dot'))
  const tx = el('div', 'fam-device-tx')
  tx.append(el('b', null, device.device_name || 'Dispositivo sem nome'))
  const conectado = formatDeviceDate(device.paired_at)
  if (conectado) tx.append(el('span', null, `Conectado em ${conectado}`))
  const ultimo = formatDeviceWhen(device.last_seen_at)
  tx.append(el('span', null, ultimo ? `Último acesso ${ultimo}` : 'Ainda não acessou'))
  row.append(tx)

  const revokeBtn = el('button', 'btn-outline', 'Revogar acesso')
  revokeBtn.type = 'button'
  revokeBtn.addEventListener('click', () => handleRevokeDevice(device, revokeBtn))
  row.append(revokeBtn)
  return row
}

async function handleRevokeDevice(device, button) {
  const nome = childDisplayName(D.child)
  const confirmMsg = `Revogar acesso deste aparelho?\n\nO aplicativo deixará de mostrar a jornada de ${nome}. Será necessário um novo código para conectar novamente.`
  if (!window.confirm(confirmMsg)) return

  button.disabled = true
  button.textContent = 'Revogando…'
  const { error } = await revokePairedDevice(device.id)
  if (error) {
    button.disabled = false
    button.textContent = 'Revogar acesso'
    window.alert('Não foi possível revogar agora. Tente novamente em instantes.')
    return
  }

  const { data } = await listPairedDevices(D.child.id)
  D.pairedDevices = data ?? []
  switchView('crianca')
}

function renderConnectDevice() {
  const wrap = el('div', 'fam-connect-device')
  const btn = el('button', 'btn-outline', 'Conectar novo aparelho')
  btn.type = 'button'
  const result = el('div', 'fam-pair-result')
  result.hidden = true

  btn.addEventListener('click', async () => {
    btn.disabled = true
    const { data: codigo, error } = await createPairingCode(D.child.id)
    btn.disabled = false
    result.hidden = false
    result.replaceChildren()
    if (error) {
      const err = el('p', null, 'Não foi possível gerar o código agora.')
      err.style.color = 'var(--bad)'
      result.append(err)
      return
    }
    result.append(el('p', 'fam-pair-label', 'Código de pareamento — válido por 10 minutos'))
    result.append(el('p', 'fam-pair-code', codigo))
    result.append(el('p', 'fam-pair-hint', 'Digite este código na tela de pareamento do aparelho da criança.'))
  })

  wrap.append(btn, result)
  return wrap
}

function renderDeviceAppCard() {
  const child = D.child
  const card = cardPad(el('p', 'kicker', 'Aplicativo da criança'))

  const idRow = el('div', 'fam-app-id')
  const img = document.createElement('img')
  img.src = childMascot(child)
  img.alt = ''
  const idTx = el('div')
  idTx.append(el('b', null, childDisplayName(child)))
  idTx.append(el('span', null, 'Nome exibido no aplicativo'))
  idTx.append(el('span', null, AVATAR_LABEL[child.avatar_key] || 'Avatar padrão'))
  idRow.append(img, idTx)
  card.append(idRow)

  const devicesHead = el('p', 'kicker fam-devices-head', 'Aparelhos conectados')
  card.append(devicesHead)

  if (D.devicesError) {
    card.append(el('p', 'fam-devices-error', 'Não foi possível carregar os aparelhos agora. Atualize a página para tentar de novo.'))
  } else {
    const ativos = D.pairedDevices.filter((d) => !d.revoked_at)
    if (!ativos.length) {
      card.append(el('p', 'sub', 'Nenhum aparelho conectado ainda.'))
    } else {
      const list = el('div', 'fam-devices')
      ativos.forEach((d) => list.append(renderDeviceRow(d)))
      card.append(list)
    }
  }

  card.append(renderConnectDevice())
  return card
}

// ── Navegação entre views ────────────────────────────────────────────────────

const VIEWS = { resumo: viewResumo, jornada: viewJornada, sessoes: viewSessoes, crianca: viewCrianca }
const CRUMB = { resumo: 'Início', jornada: 'Jornada', sessoes: 'Sessões', crianca: 'Criança' }

function switchView(view) {
  if (!VIEWS[view]) return
  activeView = view
  const box = $('[data-guardian-state]')
  if (box) box.replaceChildren(VIEWS[view]())
  document.querySelectorAll('[data-view-link]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.viewLink === view)
  })
  const crumb = $('[data-crumb]')
  if (crumb) crumb.textContent = `Painel da família / ${CRUMB[view]}`
  $('#main-content')?.scrollTo({ top: 0 })
}

// ── Estados de erro/vazio do boot ────────────────────────────────────────────

function renderBootMessage(strongText, spanText) {
  const box = $('[data-guardian-state]')
  if (!box) return
  const page = el('div', 'fam-page')
  page.append(viewHead(`Olá, ${firstName(D.guardianName) || 'família'}.`, '', { comChip: false }))
  page.append(cardPad(famEmpty(strongText, spanText)))
  box.replaceChildren(page)
}

// ── Boot ─────────────────────────────────────────────────────────────────────

// `?estado=` continua como fallback de DEMO: só vale quando não existe ciclo
// real (revisar telas pré-match num cadastro de teste). Dado real sempre vence.
const ESTADO_OVERRIDE = (() => {
  const v = new URLSearchParams(location.search).get('estado')
  return ['waiting_review', 'revision_requested', 'waiting_match', 'rejected'].includes(v) ? v : null
})()

function fillIdentity(session) {
  D.guardianName = session.profile.name || 'Família'
  const set = (sel, val) => { const n = $(sel); if (n) n.textContent = val }
  set('[data-account-name]', D.guardianName)
  const ini = initials(D.guardianName)
  const railAv = $('[data-account-avatar]')
  if (railAv) railAv.textContent = ini
  const topAv = $('[data-topbar-avatar]')
  if (topAv) topAv.textContent = ini
}

async function boot() {
  const session = await requireRole('guardian')
  if (!session) return

  fillIdentity(session)
  wireRailToggle()

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
  })
  document.querySelectorAll('[data-view-link]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.viewLink))
  })
  $('[data-rail-team]')?.addEventListener('click', (e) => { e.preventDefault(); openSupportDrawer() })
  $('[data-support-close]')?.addEventListener('click', closeSupportDrawer)
  $('[data-support-backdrop]')?.addEventListener('click', closeSupportDrawer)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSupportDrawer() })

  const { data: children, error } = await getGuardianChildren(session.user.id)
  if (error) {
    renderBootMessage('Não foi possível carregar seus dados.',
      'Verifique a conexão e atualize a página. Se continuar, fale com a equipe pela Ajuda.')
    return
  }

  const child = children?.[0] ?? null
  if (!child) {
    renderBootMessage('Nenhuma criança cadastrada ainda.',
      'Se você acabou de concluir o cadastro, atualize a página em instantes. Qualquer dúvida, fale com a equipe.')
    return
  }

  D.child = child

  // Identidade do app da criança (nome/avatar escolhidos no mobile) e
  // aparelhos conectados — nenhuma das duas falhas derruba o painel: a
  // identidade cai no fallback determinístico (childDisplayName/childMascot),
  // os aparelhos mostram erro só dentro do próprio card, na view Criança.
  const [identityResult, devicesResult] = await Promise.all([
    getChildAppIdentity(child.id),
    listPairedDevices(child.id),
  ])
  if (identityResult.data) {
    D.child.preferred_name = identityResult.data.preferred_name
    D.child.avatar_key = identityResult.data.avatar_key
  }
  if (devicesResult.error) {
    D.devicesError = true
  } else {
    D.pairedDevices = devicesResult.data ?? []
  }

  // Ciclo mais relevante: ativo > planejado > pausado > concluído.
  const cycles = child.support_cycles ?? []
  D.cycle = cycles.find((c) => c.status === 'active')
    ?? cycles.find((c) => c.status === 'planned')
    ?? cycles.find((c) => c.status === 'paused')
    ?? cycles.find((c) => c.status === 'completed')
    ?? null

  if (D.cycle) {
    D.tutor = Array.isArray(D.cycle.profiles) ? D.cycle.profiles[0] : D.cycle.profiles
    D.sessions = [...(D.cycle.sessions ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))
    D.status = D.cycle.status
  } else {
    D.status = ESTADO_OVERRIDE || child.status || 'waiting_review'
  }

  // Jornada formal — RLS de guardian já cobre (fase-5). Falha aqui não
  // derruba o painel: a jornada simplesmente aparece como "em preparação".
  if (D.cycle && ['active', 'paused', 'completed'].includes(D.cycle.status)) {
    const { data: trail } = await getLatestChildTrail(child.id, D.cycle.id)
    if (trail) {
      D.trail = trail
      const { data: modules } = await getChildTrailModules(trail.id)
      D.modules = modules ?? []
      const atual = D.modules.find((m) => m.status !== 'concluido') ?? D.modules[D.modules.length - 1]
      if (atual) {
        const { data: missions } = await getChildTrailMissions(atual.id)
        D.missions = missions ?? []
      }
    }
  }

  switchView('resumo')
}

boot()
