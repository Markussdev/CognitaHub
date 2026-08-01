import { supabase } from '../lib/supabase.js'
import { requireRole, requirePairedDevice } from '../lib/auth.js'
import { el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { getLatestChildTrail, getChildTrailModules, getChildTrailMissionsWithActivity, getTrailTemplateWithModules } from '../data/trilha-formal.js'
import { claimPairingCode, getPairedChildContext } from '../data/pareamento.js'
import { renderTrilhaCrianca } from '../components/trilha-crianca.js'
import { solveTurnstile } from '../lib/turnstile.js'
import { mascoteUrl } from '../lib/trilha-assets.js'

// Duas portas de entrada coexistindo (Fase 13):
//   ?demo=1 + tutor autenticado → "modo demonstração" (Sprint 6A), reusa a
//     sessão do tutor, só pra ele testar/mostrar a trilha sem precisar de
//     um dispositivo pareado de verdade.
//   sem ?demo=1 → fluxo real: dispositivo pareado (auth anônimo do
//     Supabase + paired_devices, ver docs/supabase-fase-13-pareamento-
//     dispositivo.sql). Sem pareamento ainda, mostra a tela de código.
// As duas portas convergem no mesmo mostrarTrilhaComum() depois de
// resolver quem é a criança — o resto (módulos, missões, mapa) é idêntico.

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

// Nome do aparelho pra família diferenciar um do outro na lista (painel do
// responsável) — não pede nada à criança, só lê o user-agent do navegador.
// Prioridade: modelo Android exposto no UA (mais específico) > "Navegador
// no Sistema" > só o sistema, se o navegador não for reconhecível.
function generateDeviceName() {
  const ua = navigator.userAgent || ''

  const browser = ua.includes('Edg/') ? 'Edge'
    : (ua.includes('OPR/') || ua.includes('Opera')) ? 'Opera'
    : ua.includes('Chrome/') ? 'Chrome'
    : ua.includes('Firefox/') ? 'Firefox'
    : (ua.includes('Safari/') && !ua.includes('Chrome')) ? 'Safari'
    : null

  const os = ua.includes('Windows') ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : ua.includes('Android') ? 'Android'
    : ua.includes('Mac OS X') ? 'Mac'
    : ua.includes('Linux') ? 'Linux'
    : null

  const androidModel = ua.match(/Android [\d.]+;\s*([^;)]+)\)/)?.[1]?.trim()
  if (androidModel && !/^(k|wv|build\/)/i.test(androidModel)) return androidModel

  if (browser && os) return `${browser} no ${os}`
  if (browser) return browser
  if (os) return `Aplicativo ${os}`
  return null
}

const root = document.querySelector('[data-app-root]')
const params = new URLSearchParams(location.search)

function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || ''
}

function renderErro(mensagem) {
  root.replaceChildren()
  const wrap = el('div', 'crianca-abertura')
  wrap.append(el('h1', null, 'Ops!'))
  wrap.append(el('p', null, mensagem))
  const voltar = el('a', 'btn-grande', 'Voltar')
  voltar.href = 'tutor.html'
  wrap.append(voltar)
  root.append(wrap)
}

// sairHref null (dispositivo pareado real) = sem link de saída — a
// criança não tem pra onde "sair", isso é o app dela.
function renderSairLink(sairHref) {
  if (!sairHref) return
  const link = el('a', 'crianca-sair', 'Sair (modo teste)')
  link.href = sairHref
  root.append(link)
}

function renderAviso(sairHref, titulo, mensagem) {
  root.replaceChildren()
  renderSairLink(sairHref)
  const wrap = el('div', 'crianca-abertura')
  wrap.append(el('h1', null, titulo))
  wrap.append(el('p', null, mensagem))
  root.append(wrap)
}

function renderAbertura({ childName, onContinuar }) {
  const wrap = el('div', 'crianca-abertura')
  const mascote = el('img', 'crianca-abertura-mascote')
  mascote.src = mascoteUrl('planejar')
  mascote.alt = ''
  mascote.setAttribute('aria-hidden', 'true')
  wrap.append(mascote)
  wrap.append(el('h1', null, `Olá, ${firstName(childName)}!`))
  wrap.append(el('p', null, 'Sua próxima missão está pronta.'))
  const btn = el('button', 'btn-grande', 'Continuar jornada')
  btn.type = 'button'
  btn.addEventListener('click', onContinuar)
  wrap.append(btn)
  return wrap
}

// Tela de pareamento — pede o código de 8 caracteres gerado pelo adulto no
// painel, resolve o desafio Turnstile, cria a sessão anônima e reivindica
// o código. Alguém adulto normalmente digita isso junto com a criança na
// primeira vez.
function renderPareamento({ onPareado }) {
  root.replaceChildren()
  const wrap = el('div', 'crianca-abertura crianca-pareamento')
  const mascote = el('img', 'crianca-abertura-mascote')
  mascote.src = mascoteUrl('planejar')
  mascote.alt = ''
  mascote.setAttribute('aria-hidden', 'true')
  wrap.append(mascote)
  wrap.append(el('h1', null, 'Vamos conectar este aparelho?'))
  wrap.append(el('p', null, 'Peça pro tutor ou responsável o código da sua jornada.'))

  const input = el('input', 'crianca-codigo-input')
  input.type = 'text'
  input.placeholder = '0000-0000'
  input.maxLength = 9
  input.autocomplete = 'off'
  input.autocapitalize = 'characters'
  input.setAttribute('aria-label', 'Código de pareamento')
  wrap.append(input)

  const turnstileContainer = el('div', 'crianca-turnstile')
  wrap.append(turnstileContainer)

  const erroMsg = el('p', 'crianca-pareamento-erro')
  erroMsg.hidden = true
  wrap.append(erroMsg)

  const btn = el('button', 'btn-grande', 'Conectar')
  btn.type = 'button'
  wrap.append(btn)

  btn.addEventListener('click', async () => {
    const codigo = input.value.trim()
    if (!codigo) return
    erroMsg.hidden = true
    btn.disabled = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.is_anonymous) {
        const captchaToken = await solveTurnstile(turnstileContainer, TURNSTILE_SITE_KEY)
        const { error: authError } = await supabase.auth.signInAnonymously({ options: { captchaToken } })
        if (authError) throw authError
      }
      const { error: claimError } = await claimPairingCode(codigo, generateDeviceName())
      if (claimError) throw claimError
      onPareado()
    } catch {
      btn.disabled = false
      erroMsg.textContent = 'Código inválido ou expirado. Confira com o tutor e tente de novo.'
      erroMsg.hidden = false
    }
  })

  root.append(wrap)
}

// Fase 12 (enxuta): só orientação espacial ("onde eu estou"), nada
// clicável — a criança não escolhe módulo, isso continua sendo decisão do
// tutor. Só os módulos MATERIALIZADOS pra essa criança viram ponto (não
// desenha módulo anterior ao início dela como "bloqueado" — ele
// simplesmente não existe no caminho dela, não é uma trava futura).
function renderModulosIndicador(modules, currentId) {
  const wrap = el('div', 'crianca-modulos-indicador')
  modules.forEach((cm, i) => {
    if (i > 0) wrap.append(el('span', 'crianca-modulo-linha'))
    const estado = cm.status === 'concluido' ? 'concluido' : (cm.id === currentId ? 'atual' : 'futuro')
    const dot = el('span', `crianca-modulo-dot crianca-modulo-dot--${estado}`, estado === 'concluido' ? '✓' : '')
    dot.setAttribute('aria-label', `Módulo ${cm.trail_modules?.position}: ${
      estado === 'concluido' ? 'concluído' : estado === 'atual' ? 'módulo atual' : 'ainda não chegou aqui'
    }`)
    wrap.append(dot)
  })
  return wrap
}

function normalizarMissao(row) {
  const mt = row.mission_templates
  const atividade = Array.isArray(row.child_activities) ? row.child_activities[0] : row.child_activities
  return {
    id: row.id,
    status: row.status,
    titulo: mt?.title || '',
    emblema: mt?.emblema || mt?.molde || 'identificar',
    childActivityId: atividade?.id || null,
  }
}

// Núcleo compartilhado pelas duas portas de entrada — tudo daqui pra baixo
// não sabe (nem precisa saber) se veio do modo demonstração ou de um
// dispositivo pareado de verdade.
async function mostrarTrilhaComum({ childId, cycleId, childName, sairHref, buildVoltarUrl, sandbox = false }) {
  root.replaceChildren()

  const { data: childTrail, error: trailError } = await getLatestChildTrail(childId, cycleId)
  if (trailError) {
    renderErro('Não conseguimos carregar sua jornada agora.')
    return
  }
  if (!childTrail) {
    renderAviso(sairHref, `Oi, ${firstName(childName)}!`, 'Sua trilha ainda está sendo preparada. Volte daqui a pouco!')
    return
  }
  if (childTrail.status === 'concluida') {
    renderAviso(sairHref, 'Você terminou! 🎉', 'Você concluiu toda a sua jornada. Muito bem!')
    return
  }
  if (childTrail.status === 'pausada') {
    renderAviso(sairHref, `Oi, ${firstName(childName)}!`, 'Sua jornada está pausada agora. Volte quando o tutor liberar de novo.')
    return
  }

  const { data: modules, error: modulesError } = await getChildTrailModules(childTrail.id)
  if (modulesError) {
    renderErro('Não conseguimos carregar sua jornada agora.')
    return
  }

  const current = (modules ?? []).find((cm) => cm.status !== 'concluido')
  if (!current) {
    renderAviso(sairHref, 'Você terminou! 🎉', 'Você concluiu toda a sua jornada. Muito bem!')
    return
  }
  if (current.status === 'bloqueado') {
    renderAviso(sairHref, `Oi, ${firstName(childName)}!`, 'Sua próxima missão está sendo preparada. Volte daqui a pouco!')
    return
  }

  const [{ data: missionRows, error: missionsError }, { data: templateModules }] = await Promise.all([
    getChildTrailMissionsWithActivity(current.id),
    getTrailTemplateWithModules(childTrail.trail_template_id),
  ])
  if (missionsError || !missionRows) {
    renderErro('Não conseguimos carregar sua jornada agora.')
    return
  }
  const missoes = missionRows.map(normalizarMissao)
  const totalModulos = templateModules?.length || modules.length

  renderSairLink(sairHref)

  const tm = current.trail_modules
  const topo = el('div', 'crianca-topo')
  if (childTrail.trail_templates?.title) {
    topo.append(el('p', 'crianca-trilha-titulo', childTrail.trail_templates.title))
  }
  topo.append(el('h2', null, tm ? `Módulo ${tm.position} — ${tm.title}` : 'Sua missão'))
  if (tm) topo.append(el('p', 'crianca-modulo-legenda', `Módulo ${tm.position} de ${totalModulos}`))
  topo.append(renderModulosIndicador(modules, current.id))
  root.append(topo)

  const moduloCompleto = current.status === 'aguardando_revisao'
  if (moduloCompleto) {
    const aviso = el('p', null, 'Módulo completo — aguardando o tutor preparar o próximo passo!')
    aviso.style.cssText = 'text-align:center;color:var(--ink-soft);padding:0 24px 16px;'
    root.append(aviso)
  }

  // Feedback curto ao voltar do Modo Criança (?voltou=1) — o check no
  // mapa já reflete o atividade_execucao novo (acabou de ser recarregado
  // acima), não depende do tutor ter registrado sessão.
  if (params.get('voltou') === '1') {
    // Em sandbox (prévia do tutor) nada foi concluído de verdade — não repetir
    // o sinal falso de "missão concluída".
    const banner = el('p', null,
      sandbox ? 'Prévia encerrada — nada foi alterado.'
        : moduloCompleto ? 'Você terminou o módulo! 🎉'
          : 'Missão concluída! Muito bem! 🎉')
    banner.style.cssText = sandbox
      ? 'text-align:center;color:var(--ink-soft);font-weight:700;padding:0 24px 16px;'
      : 'text-align:center;color:var(--ok);font-weight:800;padding:0 24px 16px;'
    root.append(banner)
  }

  const onOpenMission = (missao) => {
    if (!missao.childActivityId) return
    const destino = new URLSearchParams({ activity: missao.childActivityId, return: buildVoltarUrl() })
    if (sandbox) destino.set('sandbox', '1') // prévia do tutor: modo-crianca não grava nem avança
    window.location.href = `modo-crianca.html?${destino.toString()}`
  }

  const trilha = renderTrilhaCrianca({ missoes, onOpenMission })
  root.append(trilha)
  requestAnimationFrame(() => trilha.scrollToMissaoAtual?.())
}

// ── Porta 1: modo demonstração (tutor testando pelo painel) ────────────

async function iniciarModoDemo() {
  const session = await requireRole('tutor')
  if (!session) return

  const cycleId = params.get('cycle_id')
  if (!cycleId) {
    renderErro('Faltou identificar o ciclo — peça pro tutor abrir por aqui de novo.')
    return
  }

  const { data: cycles, error } = await getTutorCycles(session.user.id)
  if (error) {
    renderErro('Não conseguimos carregar agora. Tenta de novo daqui a pouco.')
    return
  }

  const cycle = (cycles ?? []).find((c) => c.id === cycleId)
  if (!cycle) {
    renderErro('Não encontramos essa jornada.')
    return
  }

  const childName = cycle.children?.name || 'criança'
  document.title = `Cognita | Jornada de ${firstName(childName)}`

  const mostrar = () => mostrarTrilhaComum({
    childId: cycle.child_id,
    cycleId: cycle.id,
    childName,
    sairHref: 'tutor.html?view=record&tab=plan',
    buildVoltarUrl: () => `app-crianca.html?${new URLSearchParams({ cycle_id: cycle.id, demo: '1', voltou: '1' }).toString()}`,
    sandbox: true, // Porta 1 (tutor testando pelo painel) é sempre prévia — nunca grava
  })

  root.replaceChildren()
  if (params.get('voltou') === '1') {
    await mostrar()
  } else {
    root.append(renderAbertura({ childName, onContinuar: mostrar }))
  }
}

// ── Porta 2: dispositivo pareado de verdade ─────────────────────────────

async function iniciarFluxoPareado() {
  const device = await requirePairedDevice()
  if (!device) {
    renderPareamento({ onPareado: iniciarFluxoPareado })
    return
  }

  const { data: rows, error } = await getPairedChildContext()
  if (error) {
    renderErro('Não conseguimos verificar seu pareamento agora.')
    return
  }
  if (!rows?.length) {
    // sessão anônima existe, mas sem pareamento ativo (nunca reivindicou
    // um código nesta sessão, ou o pareamento foi revogado pelo adulto)
    renderPareamento({ onPareado: iniciarFluxoPareado })
    return
  }

  const contexto = rows[0]
  document.title = `Cognita | Jornada de ${firstName(contexto.primeiro_nome)}`

  // contexto.cycle_id vem de um left join (child_trails) — fica null
  // quando o dispositivo já foi pareado mas nenhuma trilha foi atribuída
  // ainda. Corta aqui em vez de deixar getLatestChildTrail(childId, null)
  // rodar um .eq('cycle_id', null) de comportamento incerto.
  const mostrar = async () => {
    if (!contexto.child_trail_id) {
      root.replaceChildren()
      renderAviso(null, `Oi, ${firstName(contexto.primeiro_nome)}!`, 'Sua trilha ainda está sendo preparada. Volte daqui a pouco!')
      return
    }
    await mostrarTrilhaComum({
      childId: contexto.child_id,
      cycleId: contexto.cycle_id,
      childName: contexto.primeiro_nome,
      sairHref: null,
      buildVoltarUrl: () => `app-crianca.html?voltou=1`,
    })
  }

  root.replaceChildren()
  if (params.get('voltou') === '1') {
    await mostrar()
  } else {
    root.append(renderAbertura({ childName: contexto.primeiro_nome, onContinuar: mostrar }))
  }
}

async function init() {
  if (params.get('demo') === '1') {
    await iniciarModoDemo()
  } else {
    await iniciarFluxoPareado()
  }
}

init()
