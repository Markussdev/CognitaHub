import { requireRole } from '../lib/auth.js'
import { el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { getLatestChildTrail, getChildTrailModules, getChildTrailMissionsWithActivity, getTrailTemplateWithModules } from '../data/trilha-formal.js'
import { renderTrilhaCrianca } from '../components/trilha-crianca.js'

// Sprint 6A — "modo demonstração infantil": protótipo da experiência que um
// dia vai virar o app infantil de verdade (celular da criança, pareado sem
// login próprio — ver docs/V2-DIRECAO.md). Por enquanto reusa a sessão
// autenticada do TUTOR (mesmo requireRole('tutor') de sempre) só pra testar
// a UX — não é a autenticação final. Chega aqui via tutor.html → aba Plano.
//
// Fase 10 — migrado do currículo hardcoded (PLANOS_REGISTRO) pro currículo
// formal (Trilha → Módulo → Missão, ver docs/supabase-fase-5 em diante).
// Não lê mais nada de js/data/planos-registro.js.

const session = await requireRole('tutor')
const root = document.querySelector('[data-app-root]')

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

function renderAviso(cycleId, titulo, mensagem) {
  root.replaceChildren()
  renderSairLink(cycleId)
  const wrap = el('div', 'crianca-abertura')
  wrap.append(el('h1', null, titulo))
  wrap.append(el('p', null, mensagem))
  root.append(wrap)
}

function renderSairLink(cycleId) {
  const link = el('a', 'crianca-sair', 'Sair (modo teste)')
  link.href = `tutor.html?view=record&tab=plan`
  root.append(link)
}

function renderAbertura({ childName, onContinuar }) {
  const wrap = el('div', 'crianca-abertura')
  const mascote = el('img', 'crianca-abertura-mascote')
  mascote.src = '../assets/trilha/mascote/planejar.webp'
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

// Fase 12 (enxuta): só orientação espacial ("onde eu estou"), nada
// clicável — a criança não escolhe módulo, isso continua sendo decisão do
// tutor. Só os módulos MATERIALIZADOS pra essa criança viram ponto (não
// desenha módulos anteriores ao início dela como "bloqueados" — eles
// simplesmente não existem no caminho dela, não são uma trava futura).
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

async function init() {
  if (!session) return

  const params = new URLSearchParams(location.search)
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

  async function mostrarTrilha() {
    root.replaceChildren()

    const { data: childTrail, error: trailError } = await getLatestChildTrail(cycle.child_id, cycle.id)
    if (trailError) {
      renderErro('Não conseguimos carregar sua jornada agora.')
      return
    }
    if (!childTrail) {
      renderAviso(cycle.id, `Oi, ${firstName(childName)}!`, 'Sua trilha ainda está sendo preparada. Volte daqui a pouco!')
      return
    }
    if (childTrail.status === 'concluida') {
      renderAviso(cycle.id, 'Você terminou! 🎉', 'Você concluiu toda a sua jornada. Muito bem!')
      return
    }
    if (childTrail.status === 'pausada') {
      renderAviso(cycle.id, `Oi, ${firstName(childName)}!`, 'Sua jornada está pausada agora. Volte quando o tutor liberar de novo.')
      return
    }

    const { data: modules, error: modulesError } = await getChildTrailModules(childTrail.id)
    if (modulesError) {
      renderErro('Não conseguimos carregar sua jornada agora.')
      return
    }

    const current = (modules ?? []).find((cm) => cm.status !== 'concluido')
    if (!current) {
      renderAviso(cycle.id, 'Você terminou! 🎉', 'Você concluiu toda a sua jornada. Muito bem!')
      return
    }
    if (current.status === 'bloqueado') {
      renderAviso(cycle.id, `Oi, ${firstName(childName)}!`, 'Sua próxima missão está sendo preparada. Volte daqui a pouco!')
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

    renderSairLink(cycle.id)

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
      const banner = el('p', null, moduloCompleto ? 'Você terminou o módulo! 🎉' : 'Missão concluída! Muito bem! 🎉')
      banner.style.cssText = 'text-align:center;color:var(--ok);font-weight:800;padding:0 24px 16px;'
      root.append(banner)
    }

    const onOpenMission = (missao) => {
      if (!missao.childActivityId) return
      const voltaPara = `app-crianca.html?${new URLSearchParams({ cycle_id: cycle.id, demo: '1', voltou: '1' }).toString()}`
      const destino = new URLSearchParams({ activity: missao.childActivityId, return: voltaPara })
      window.location.href = `modo-crianca.html?${destino.toString()}`
    }

    const trilha = renderTrilhaCrianca({ missoes, onOpenMission })
    root.append(trilha)
    requestAnimationFrame(() => trilha.scrollToMissaoAtual?.())
  }

  root.replaceChildren()
  if (params.get('voltou') === '1') {
    await mostrarTrilha()
  } else {
    root.append(renderAbertura({ childName, onContinuar: mostrarTrilha }))
  }
}

init()
