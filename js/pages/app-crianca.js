import { requireRole } from '../lib/auth.js'
import { el } from '../lib/ui.js'
import { getTutorCycles } from '../data/tutor.js'
import { PLANOS_REGISTRO, computeStatusCrianca } from '../data/planos-registro.js'
import { renderTrilhaCrianca } from '../components/trilha-crianca.js'

// Sprint 6A — "modo demonstração infantil": protótipo da experiência que um
// dia vai virar o app infantil de verdade (celular da criança, pareado sem
// login próprio — ver docs/V2-DIRECAO.md). Por enquanto reusa a sessão
// autenticada do TUTOR (mesmo requireRole('tutor') de sempre) só pra testar
// a UX — não é a autenticação final. Chega aqui só via
// trilha.html → "Testar como criança" → ?cycle_id=<uuid>&demo=1.

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

function renderSairLink(cycleId) {
  const link = el('a', 'crianca-sair', 'Sair (modo teste)')
  link.href = `trilha.html?cycle_id=${encodeURIComponent(cycleId)}`
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
  const plano = PLANOS_REGISTRO.primeiros_numeros
  document.title = `Cognita | Jornada de ${firstName(childName)}`

  async function mostrarTrilha() {
    root.replaceChildren()
    renderSairLink(cycle.id)

    const topo = el('div', 'crianca-topo')
    topo.append(el('h2', null, plano.titulo))
    root.append(topo)

    const statuses = await computeStatusCrianca(plano, cycle.child_id)
    if (!statuses) {
      renderErro('Não conseguimos carregar sua jornada agora.')
      return
    }

    const algumaDisponivel = statuses.some((s) => s.status === 'disponivel')
    const tudoConcluido = statuses.every((s) => s.status === 'concluida')
    if (!algumaDisponivel && !tudoConcluido) {
      const aviso = el('p', null, 'Sua próxima missão está sendo preparada. Volte daqui a pouco!')
      aviso.style.cssText = 'text-align:center;color:var(--ink-soft);padding:0 24px 16px;'
      root.append(aviso)
    }

    // Feedback curto ao voltar do Modo Criança (?voltou=1) — o check no
    // mapa já reflete o atividade_execucao novo (computeStatusCrianca
    // acabou de rodar acima), não depende do tutor ter registrado sessão.
    if (params.get('voltou') === '1') {
      const banner = el('p', null, tudoConcluido ? 'Você terminou todas as missões! 🎉' : 'Missão concluída! Muito bem! 🎉')
      banner.style.cssText = 'text-align:center;color:var(--ok);font-weight:800;padding:0 24px 16px;'
      root.append(banner)
    }

    const onIniciarMissao = (etapa, childActivityId) => {
      const voltaPara = `app-crianca.html?${new URLSearchParams({ cycle_id: cycle.id, demo: '1', voltou: '1' }).toString()}`
      const destino = new URLSearchParams({ activity: childActivityId, return: voltaPara })
      window.location.href = `modo-crianca.html?${destino.toString()}`
    }

    const trilha = renderTrilhaCrianca({ plano, statusesCrianca: statuses, onIniciarMissao })
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
