import { el } from '../../lib/ui.js'
import { getCycleSessions } from '../../data/sessions.js'
import { getLatestChildTrail, getChildTrailModules, getChildTrailMissions } from '../../data/trilha-formal.js'
import { listPendingExecucoes } from '../../data/atividade-execucao.js'
import { derivarEstadoResumo, ESTADOS_RESUMO, moduloAtualDe } from '../resumo-estado.js'
import { firstName, simpleHead, formatDate, formatExecucaoQuando, formatLastSession, toList } from './shared.js'

// Domínio Resumo (mesa de trabalho) — extraído de js/pages/tutor.js. Contrato
// com o resto da tela (renderRecord em tutor.js): buildResumoPanel(cycle,
// { openForm, openPlan, openSessions }) devolve um <section> com .reload()
// (chamado depois de salvar uma sessão, e uma vez no bootstrap inicial).
// openForm/openPlan/openSessions substituem o acesso direto a switchTab/
// sessionForm que o painel tinha quando vivia dentro de tutor.js — este
// módulo não conhece a navegação entre abas, só recebe o que fazer quando o
// tutor clica num CTA. Nada do comportamento mudou nesta extração — só o
// arquivo que contém o código.
//
// Substitui o antigo dossiê. A tela inteira deriva de derivarEstadoResumo()
// (js/pages/resumo-estado.js): um estado dominante, no máximo um CTA. Nada aqui
// inventa dado — tudo vem de sessions/atividade_execucao/child_trails já
// existentes.

// Feed genérico (ícone + texto + hora) — usado só pela timeline do Resumo.
function renderFeedItems(container, items) {
  container.replaceChildren()
  items.forEach((item) => {
    const row = el('div', 'feed-item')
    const ico = el('div', `feed-ico ${item.tone}`)
    ico.innerHTML = item.icon
    const tx = el('div', 'feed-tx')
    tx.innerHTML = item.html
    if (item.sub) tx.append(el('span', 'sub', item.sub))
    row.append(ico, tx)
    if (item.time) row.append(el('div', 'feed-time', item.time))
    container.append(row)
  })
}

export function buildResumoPanel(cycle, { openForm, openPlan, openSessions }) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'overview' // id interno mantido — switchTab/tabs seguem funcionando

  const wrap = el('div', 'resumo')
  wrap.append(el('p', 'card-copy', 'Carregando resumo…'))
  panel.append(wrap)

  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const nome = firstName(child.name) || 'a criança'
  const E = ESTADOS_RESUMO

  // ── Bloco 2: copy da "Próxima decisão" por estado (§5). cta pode ser null. ──
  function decisaoDe(estado, dados) {
    switch (estado) {
      case E.CICLO_PLANEJADO:
        return { ti: 'O ciclo começa em breve.', ds: 'Leia o perfil pedagógico e revise as informações antes da primeira sessão.',
          cta: { label: 'Ver perfil pedagógico', href: `perfil-crianca.html?id=${cycle.child_id ?? ''}` } }
      case E.EXECUCAO_PENDENTE: {
        const titulo = dados.execucao?.child_activities?.titulo || 'uma atividade'
        const quando = dados.execucao?.created_at ? formatExecucaoQuando(dados.execucao.created_at) : 'há pouco'
        const ti = dados.total > 1
          ? `${nome} concluiu ${dados.total} atividades que ainda não viraram registro — a mais recente foi "${titulo}" ${quando}.`
          : `${nome} completou "${titulo}" ${quando} e a execução ainda não virou registro.`
        return { ti,
          ds: 'Transforme o que a criança fez numa sessão para a família acompanhar.',
          cta: { label: `Revisar o que ${nome} fez`, onClick: openForm } }
      }
      case E.MODULO_EM_REVISAO:
        return { ti: `O módulo ${dados.modulo?.trail_modules?.position} terminou. Hora de decidir como ${nome} segue.`,
          ds: 'Avançar para o próximo, repetir ou adaptar — a decisão é sua.',
          cta: { label: 'Decidir: avançar, repetir ou adaptar', onClick: openPlan } }
      case E.MODULO_BLOQUEADO:
        return { ti: `O módulo ${dados.modulo?.trail_modules?.position} está pronto para ser preparado e liberado para ${nome}.`,
          ds: 'Libere o módulo para a primeira missão ficar disponível no aparelho.',
          cta: { label: 'Preparar e liberar módulo', onClick: openPlan } }
      case E.JORNADA_CONCLUIDA:
        return { ti: `${nome} concluiu a jornada "${dados.trail?.trail_templates?.title || 'atual'}". 🎉 O histórico está guardado.`,
          ds: 'Escolha a próxima jornada quando fizer sentido — nada se perde.',
          cta: { label: 'Atribuir próxima jornada', onClick: openPlan },
          secondary: { label: 'Ver histórico', onClick: openSessions } }
      case E.SEM_JORNADA:
        return { ti: `${nome} ainda não tem uma jornada.`, ds: 'Escolha uma jornada da biblioteca para começar o acompanhamento.',
          cta: { label: 'Atribuir jornada', onClick: openPlan } }
      case E.MISSAO_DISPONIVEL:
        return { ti: `Tudo preparado. ${nome} tem uma missão disponível no aparelho.`,
          ds: 'Nada esperando decisão sua agora — é a vez da criança.',
          cta: { label: 'Ver jornada', onClick: openPlan, discreto: true } }
      case E.CICLO_PAUSADO:
        return { ti: 'O ciclo está pausado.', ds: 'A equipe acompanha e avisa os próximos passos.', cta: null }
      case E.CICLO_CONCLUIDO:
        return { ti: `Ciclo concluído. Obrigado pelo cuidado com ${nome}.`, ds: 'O histórico permanece nas Sessões.',
          cta: { label: 'Ver histórico de sessões', onClick: openSessions } }
      case E.EM_DIA:
      default:
        return { ti: 'Tudo em dia por aqui.', ds: 'Nada esperando decisão sua no momento.', cta: null }
    }
  }

  function renderDecisao(estado, dados) {
    const d = decisaoDe(estado, dados)
    const card = el('div', 'card card--accent resumo-decisao')
    card.append(simpleHead('Próxima decisão'))
    const body = el('div', 'card-b')
    body.append(el('div', 'decisao-ti', d.ti))
    if (d.ds) body.append(el('p', 'card-copy', d.ds))
    if (d.cta) {
      const actions = el('div', 'decisao-actions')
      const cls = d.cta.discreto ? 'resumo-link' : 'btn btn-accent'
      let primary
      if (d.cta.href) {
        primary = el('a', cls, d.cta.label); primary.href = d.cta.href
      } else {
        primary = el('button', cls, d.cta.label); primary.type = 'button'
        primary.addEventListener('click', d.cta.onClick)
      }
      actions.append(primary)
      if (d.secondary) {
        const sec = el('button', 'btn btn-ghost btn-sm', d.secondary.label)
        sec.type = 'button'; sec.addEventListener('click', d.secondary.onClick)
        actions.append(sec)
      }
      body.append(actions)
    }
    card.append(body)
    return card
  }

  // ── Bloco 1: Pulso — uma linha, fatos derivados ──────────────────────────
  function renderPulso({ sessions, execucoesPendentes, trail, modules }) {
    const parts = []
    const last = sessions[0]
    parts.push(last ? `Última sessão ${formatLastSession(last.date)}` : 'Nenhuma sessão registrada')
    if (execucoesPendentes.length) {
      parts.push(`${execucoesPendentes.length} ${execucoesPendentes.length === 1 ? 'atividade aguardando' : 'atividades aguardando'} registro`)
    }
    if (trail && modules.length) {
      const pos = moduloAtualDe(modules)?.trail_modules?.position ?? modules.length
      parts.push(`Módulo ${pos} de ${modules.length}`)
    }
    const pulso = el('div', 'resumo-pulso')
    parts.forEach((p, i) => {
      if (i) pulso.append(el('span', 'sep', '·'))
      pulso.append(el('span', null, p))
    })
    return pulso
  }

  // ── Bloco 3: O que aconteceu — merge de sessões + execuções + atribuição ──
  function renderTimeline({ sessions, execucoesPendentes, trail }) {
    const items = []
    sessions.forEach((s) => items.push({
      _t: new Date(s.created_at || s.date).getTime(),
      tone: 'you',
      icon: `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
      html: '<b>Você</b> registrou a sessão',
      sub: [s.activity_title, s.focus_area ? `foco em ${s.focus_area}` : null].filter(Boolean).join(' · '),
      time: formatLastSession(s.date),
    }))
    execucoesPendentes.forEach((e) => items.push({
      _t: new Date(e.created_at).getTime(),
      tone: 'team',
      icon: `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>`,
      html: `<b>${nome}</b> concluiu ${e.child_activities?.titulo ? `"${e.child_activities.titulo}"` : 'uma atividade'}`,
      sub: 'Aguardando você registrar a sessão',
      time: formatExecucaoQuando(e.created_at),
    }))
    if (trail) items.push({
      _t: new Date(trail.created_at).getTime(),
      tone: 'team',
      icon: `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.6.6-5 4.4 1.5 6.5L12 17l-6 3.3 1.5-6.5-5-4.4 6.6-.6z"/></svg>`,
      html: `<b>Jornada</b> ${trail.trail_templates?.title ? `"${trail.trail_templates.title}"` : ''} atribuída`,
      sub: '',
      time: formatDate(trail.created_at?.slice(0, 10)) ?? '',
    })
    items.sort((a, b) => b._t - a._t)

    const card = el('div', 'card')
    card.append(simpleHead('O que aconteceu'))
    const cbody = el('div', 'card-b')
    if (!items.length) {
      cbody.append(el('p', 'card-copy', 'Nada por aqui ainda — o histórico aparece assim que a criança fizer uma atividade ou você registrar uma sessão.'))
    } else {
      const feed = el('div', 'feed')
      renderFeedItems(feed, items.slice(0, 5))
      cbody.append(feed)
    }
    card.append(cbody)
    return card
  }

  // ── Bloco 4: Contexto — 3 chips + link + meta (só se existir) ─────────────
  function renderContexto() {
    const card = el('div', 'card')
    card.append(simpleHead(`Contexto de ${nome}`))
    const cbody = el('div', 'card-b')
    const chips = el('div', 'resumo-contexto chips')
    const difficulties = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
    const addChip = (label, val, cls) => { if (val) chips.append(el('span', `chip ${cls}`, `${label}: ${val}`)) }
    addChip('foco', difficulties[0], 'chip--1')
    addChip('prefere', toList(lp.preferred_formats)[0], 'chip--2')
    addChip('evita', toList(lp.avoidances)[0], 'chip--3')
    if (!chips.children.length) chips.append(el('span', 'chip chip--1', 'Perfil pedagógico ainda não detalhado'))
    cbody.append(chips)
    const link = el('a', 'resumo-link', 'Ver perfil pedagógico completo →')
    link.href = `perfil-crianca.html?id=${cycle.child_id ?? ''}`
    cbody.append(link)
    if (cycle.main_goal) cbody.append(el('div', 'resumo-meta', `Meta do ciclo: ${cycle.main_goal}`))
    card.append(cbody)
    return card
  }

  function renderErro() {
    const card = el('div', 'card')
    card.append(simpleHead('Resumo'))
    const cbody = el('div', 'card-b')
    cbody.append(el('p', 'card-copy', 'Não foi possível carregar o resumo agora. Verifique a conexão e tente de novo.'))
    const btn = el('button', 'btn btn-ghost btn-sm', 'Tentar novamente')
    btn.type = 'button'; btn.addEventListener('click', reload)
    cbody.append(btn)
    card.append(cbody)
    return card
  }

  async function reload() {
    // sessions sempre (pulso/timeline/histórico). trail/módulos/missões/
    // execuções só quando o ciclo está ativo — nos estados P/Z/F a cascata
    // nem roda (o portão de ciclo decide antes).
    const isActive = cycle.status === 'active'
    const [sessRes, trailRes] = await Promise.all([
      getCycleSessions(cycle.id),
      isActive ? getLatestChildTrail(cycle.child_id, cycle.id) : Promise.resolve({ data: null, error: null }),
    ])
    const trail = trailRes?.data ?? null

    let modRes = { data: [], error: null }
    let exeRes = { data: [], error: null }
    let missions = []
    if (isActive) {
      ;[modRes, exeRes] = await Promise.all([
        trail ? getChildTrailModules(trail.id) : Promise.resolve({ data: [], error: null }),
        listPendingExecucoes(cycle.child_id, cycle.id),
      ])
      // Erro nas missões afeta só o sinal informativo MISSAO_DISPONIVEL, não
      // é crítico pra derivar o estado — não bloqueia o Resumo.
      const mod = moduloAtualDe(modRes.data ?? [])
      if (mod) missions = (await getChildTrailMissions(mod.id))?.data ?? []
    }

    // Consulta crítica falhou → NÃO derivar estado de dado incompleto (erro
    // viraria "Tudo em dia" indevido). Erro honesto + tentar novamente.
    if (sessRes.error || trailRes?.error || modRes.error || exeRes.error) {
      wrap.replaceChildren(renderErro())
      return
    }

    const sessions = sessRes.data ?? []
    const modules = modRes.data ?? []
    const execucoesPendentes = exeRes.data ?? []
    const { estado, dados } = derivarEstadoResumo({ cycle, trail, modules, missions, execucoesPendentes })

    // P/Z/F reduzem para "Próxima decisão" + histórico (quando existir). §5.
    const reduced = !isActive
    wrap.replaceChildren()
    if (!reduced) wrap.append(renderPulso({ sessions, execucoesPendentes, trail, modules }))
    wrap.append(renderDecisao(estado, dados))
    if (!reduced || sessions.length) wrap.append(renderTimeline({ sessions, execucoesPendentes, trail }))
    if (!reduced) wrap.append(renderContexto())
  }

  panel.reload = reload
  return panel
}
