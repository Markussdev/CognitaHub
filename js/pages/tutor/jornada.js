import { el } from '../../lib/ui.js'
import { cancelTutorCycle } from '../../data/tutor.js'
import {
  listPublishedTrailTemplates, getTrailTemplateWithModules, getLatestChildTrail,
  getChildTrailModules, getChildTrailMissions, assignChildTrail, releaseChildModule,
  advanceChildTrailModule, reopenChildTrailMission,
} from '../../data/trilha-formal.js'
import { emblemaUrl, mascoteUrl } from '../../lib/trilha-assets.js'
import { getModuleVisual } from '../../data/module-visuals.js'
import { buildPairingCard } from './pareamento.js'
import { firstName, kebabMenu, MISSION_STATUS_LABEL } from './shared.js'

// Painel Jornada (Plano — currículo formal Trilha → Módulo → Missão) —
// extraído de js/pages/tutor.js. Contrato com o resto da tela
// (renderRecord em tutor.js) mantido tal como estava:
// buildPlanPanel(cycle, state) devolve <section data-panel="plan" hidden>
// com panel.loadStatus = load. Nada do comportamento mudou nesta
// extração — só o arquivo que contém o código. Diferente dos outros
// domínios extraídos, este não precisou de callbacks novos: não tinha
// dependência implícita de session/currentDerived/navegação — só de cycle
// e state, já recebidos por parâmetro.
//
// Não é navegação livre da criança — é o tutor decidindo a próxima etapa.
// Dado pedagógico e cálculo de status moram em data/planos-registro.js
// (sistema PARALELO e legado — PLANOS_REGISTRO/pendingEtapaParams — que
// não tem nada a ver com este painel; fica em tutor.js). Esta aba não
// tenta mostrar o mapa inteiro em um card compacto — responde rápido
// "qual é o plano, quanto já foi feito, qual a próxima ação", com um botão
// pra abrir a exploração de verdade em tela própria.
//
// O card de pareamento (buildPairingCard) é utilitário SEPARADO — não
// pertence ao ato de atribuir jornada, é ação à parte sobre o aparelho da
// criança.

const MODULE_STATUS_LABEL = {
  bloqueado: 'Bloqueado',
  liberado: 'Liberado',
  aguardando_revisao: 'Aguardando revisão',
  concluido: 'Concluído',
}

// Sprint 6A ("modo demonstração") — reusa a sessão do tutor, sem
// pareamento próprio ainda. Sem ?demo=1 o app.js do app-crianca não teria
// como saber que é um teste do tutor, não a credencial final da criança.
function appendChildAppLink(container, cycle, label) {
  const link = el('a', 'btn btn-ghost btn-sm', label)
  link.href = `preview-crianca.html?${new URLSearchParams({ cycle_id: cycle.id }).toString()}`
  container.append(link)
}

// Currículo formal (Trilha → Módulo → Missão). Passagem funcional,
// sem redesenhar o mapa visual ainda (isso
// é a "Fase 6 — mapa de mundos" do roadmap, só depois de provar o dado
// real ponta a ponta). PLANOS_REGISTRO/trilha-plano.js/trilha.html
// continuam existindo mas não são mais alimentados por este painel.
export function buildPlanPanel(cycle, state) {
  const panel = el('section', 'panel')
  panel.dataset.panel = 'plan'
  panel.hidden = true

  const podePreparar = state === 'cycle_active'
  const bloqueadoMsg = {
    cycle_planned: 'A jornada libera quando a equipe ativar o ciclo.',
    cycle_paused: 'A jornada fica bloqueada enquanto o ciclo estiver pausado.',
    cycle_completed: 'Este ciclo já foi concluído — a jornada abaixo fica só como histórico.',
  }[state]

  const childFirst = firstName(cycle.children?.name) || 'a criança'

  // Cabeçalho estável (identidade da jornada) + área de conteúdo (body) +
  // card de pareamento como utilitário SEPARADO — pareamento não pertence ao
  // ato de atribuir jornada, é ação à parte sobre o aparelho da criança.
  const container = el('div', 'journey')
  const header = el('header', 'journey-head')
  const headerText = el('div', 'journey-head-text')
  headerText.append(el('h3', 'journey-title', `Jornada de ${childFirst}`))
  const headerSub = el('p', 'journey-sub')
  headerText.append(headerSub)
  const mascot = el('img', 'journey-mascot')
  mascot.src = mascoteUrl('planejar')
  mascot.alt = ''
  mascot.hidden = true // só no estado vazio — dá identidade Cognita aos dois caminhos

  const journeyActions = el('div', 'journey-head-actions')

  if (['planned', 'active', 'paused'].includes(cycle.status)) {
    journeyActions.append(
      kebabMenu([
        {
          label: 'Cancelar ciclo',
          tone: 'bad',
          run: async () => {
            const confirmed = window.confirm(
              `Cancelar o acompanhamento de ${childFirst}?\n\n` +
              'O ciclo deixará de aparecer como ativo, mas os registros já feitos serão preservados.'
            )

            if (!confirmed) return

            const { error } = await cancelTutorCycle(cycle.id)

            if (error) {
              console.error('Erro ao cancelar ciclo:', error)
              window.alert(
                'Não foi possível cancelar o ciclo agora. Nenhuma alteração foi feita.'
              )
              return
            }

            window.location.reload()
          },
        },
      ])
    )
  }

  header.append(headerText, journeyActions, mascot)
  const body = el('div', 'journey-body')
  const deviceCard = buildPairingCard(cycle.child_id)
  container.append(header, body, deviceCard)
  panel.append(container)

  function blockedNoteEl() {
    if (!bloqueadoMsg) return null
    const note = el('div', 'locked-note')
    note.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    note.append(document.createTextNode(bloqueadoMsg))
    return note
  }

  // Stepper dos módulos da criança (dado real): posição + status colorido.
  function renderStepper(modules, currentId) {
    const stepper = el('div', 'journey-stepper')
    modules.forEach((cm) => {
      const tm = cm.trail_modules
      const isCurrent = cm.id === currentId
      const node = el('div', `journey-step journey-step--${cm.status}${isCurrent ? ' journey-step--current' : ''}`)
      node.append(el('span', 'journey-step-dot', cm.status === 'concluido' ? '✓' : String(tm.position)))
      node.append(el('span', 'journey-step-label', tm.title))
      stepper.append(node)
    })
    return stepper
  }

  function renderErrorLine(container, message) {
    const err = el('p', 'card-copy', message)
    err.style.color = 'var(--bad)'
    container.append(err)
  }

  async function renderAssign() {
    mascot.hidden = false
    headerSub.textContent = 'Escolha um percurso recomendado ou monte um plano personalizado.'
    body.replaceChildren(el('p', 'card-copy journey-loading', 'Carregando percursos…'))

    const { data: templates, error } = await listPublishedTrailTemplates()
    if (error) {
      body.replaceChildren(el('p', 'card-copy', 'Não foi possível carregar os percursos agora.'))
      return
    }

    const choices = el('div', 'journey-choices')

    // Renderiza TODOS os percursos publicados (não só o primeiro) — quando
    // existir mais de uma jornada oficial, cada uma vira um card recomendado.
    // oficiais (todas) + privadas do tutor SÓ desta criança (defensivo — a
    // RLS já não devolve as de outra criança/outro tutor).
    const relevantes = (templates ?? []).filter((t) =>
      t.visibility !== 'private' || t.target_child_id === cycle.child_id)
    const comModulos = await Promise.all(
      relevantes.map((t) =>
        getTrailTemplateWithModules(t.id).then((r) => ({ template: t, modules: r.data ?? [] }))
      )
    )
    const renderaveis = comModulos.filter((x) => x.modules.length)

    if (!renderaveis.length) {
      const none = el('div', 'card journey-choice')
      none.append(el('h4', 'journey-choice-title', 'Nenhum percurso recomendado ainda'))
      none.append(el('p', 'journey-choice-desc', 'A equipe Cognita ainda não publicou um percurso — mas você pode montar uma jornada personalizada.'))
      choices.append(none, renderCustomJourneyCard())
      body.replaceChildren(choices)
      return
    }

    // oficiais (Recomendada) antes das privadas (Sua jornada)
    renderaveis.sort((a, b) =>
      (a.template.visibility === 'private' ? 1 : 0) - (b.template.visibility === 'private' ? 1 : 0))
    renderaveis.forEach(({ template, modules }) => {
      const badge = template.visibility === 'private' ? 'Sua jornada' : 'Recomendada'
      choices.append(renderRecommendedJourneyCard(template, modules, badge))
    })
    choices.append(renderCustomJourneyCard())
    body.replaceChildren(choices)
  }

  function renderRecommendedJourneyCard(template, modules, badgeLabel = 'Recomendada') {
    const card = el('div', 'card journey-choice journey-choice--recommended')
    card.append(el('span', 'journey-badge', badgeLabel))
    card.append(el('h4', 'journey-choice-title', template.title))
    if (template.description) card.append(el('p', 'journey-choice-desc', template.description))

    const totalMissoes = modules.reduce((s, m) => s + (m.mission_templates?.length || 0), 0)
    const meta = [
      `${modules.length} ${modules.length === 1 ? 'módulo' : 'módulos'}`,
      `${totalMissoes} ${totalMissoes === 1 ? 'missão' : 'missões'}`,
    ]
    if (template.age_min && template.age_max) meta.push(`${template.age_min}–${template.age_max} anos`)
    card.append(el('p', 'journey-choice-meta', meta.join(' · ')))

    card.append(el('p', 'journey-field-label', 'Começar em'))
    const radios = el('div', 'journey-radios')
    let selectedModuleId = modules[0]?.id
    modules.forEach((m, i) => {
      const opt = el('label', 'journey-radio')
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = `journey-start-module-${template.id}`
      input.value = m.id
      if (i === 0) input.checked = true
      input.addEventListener('change', () => { selectedModuleId = m.id })
      const visual = getModuleVisual(m.visual_key, i)
      const txt = el('span', 'journey-radio-text')
      txt.append(el('span', 'journey-radio-title', `Módulo ${m.position} — ${m.title}`))
      txt.append(el('span', 'journey-radio-sub', [visual.label, m.objective].filter(Boolean).join(' · ')))
      opt.append(input, txt)
      radios.append(opt)
    })
    card.append(radios)

    const bn = blockedNoteEl()
    if (bn) card.append(bn)

    if (podePreparar) {
      const btn = el('button', 'btn btn-accent journey-cta', `Começar jornada com ${childFirst}`)
      btn.type = 'button'
      btn.addEventListener('click', async () => {
        btn.disabled = true
        const { error: assignError } = await assignChildTrail({
          childId: cycle.child_id,
          cycleId: cycle.id,
          trailTemplateId: template.id,
          startingModuleId: selectedModuleId,
        })
        if (assignError) {
          btn.disabled = false
          renderErrorLine(card, assignError.message)
          return
        }
        load()
      })
      card.append(btn)
    }
    return card
  }

  // Porta pro builder (Fase 15). Faixa full-width abaixo dos percursos — é
  // uma AÇÃO (criar), não um percurso a atribuir, então não divide o grid.
  function renderCustomJourneyCard() {
    const card = el('div', 'card journey-choice journey-choice--custom')
    const txt = el('div', 'journey-custom-text')
    txt.append(el('h4', 'journey-choice-title', 'Criar jornada personalizada'))
    txt.append(el('p', 'journey-choice-desc', 'Organize suas atividades preparadas em módulos e missões.'))
    card.append(txt)
    const p = new URLSearchParams({ child_id: cycle.child_id ?? '', child_name: childFirst })
    if (cycle.id) p.set('cycle_id', cycle.id)
    const link = el('a', 'btn btn-ghost journey-cta', 'Criar jornada')
    link.href = `builder-jornada.html?${p.toString()}`
    card.append(link)
    return card
  }

  // Lista só os módulos CONCLUÍDOS como histórico compacto; o módulo atual
  // ganha um card próprio, único (antes o mesmo módulo aparecia duas vezes
  // — uma na lista "achatada" de todos os módulos, outra no card de
  // detalhe — o que ficava especialmente estranho quando só existe 1
  // módulo materializado, ex.: criança que começou direto no Módulo 2).
  async function renderTrail(childTrail) {
    const [{ data: modules, error }, { data: templateModules }] = await Promise.all([
      getChildTrailModules(childTrail.id),
      getTrailTemplateWithModules(childTrail.trail_template_id),
    ])
    if (error) {
      body.replaceChildren(el('p', 'card-copy', 'Não foi possível carregar os módulos.'))
      return
    }

    const totalModulos = templateModules?.length || modules.length

    body.replaceChildren()
    mascot.hidden = true
    headerSub.textContent = childTrail.trail_templates?.title || 'Jornada'

    if (childTrail.status === 'concluida') {
      body.append(el('p', 'trilha-complete-banner', 'Jornada concluída! 🎉'))
    } else if (childTrail.status === 'pausada') {
      body.append(el('p', 'card-copy', 'Esta jornada está pausada.'))
    }

    const bn = blockedNoteEl()
    if (bn) body.append(bn)

    const current = modules.find((cm) => cm.status !== 'concluido')

    // Progresso + stepper. A contagem de missões ("N de M") é preenchida
    // adiante, quando o módulo atual estiver liberado e as missões carregarem.
    const currentPos = current?.trail_modules?.position ?? totalModulos
    const progressEl = el('p', 'journey-progress', `Módulo ${currentPos} de ${totalModulos}`)
    body.append(progressEl)
    body.append(renderStepper(modules, current?.id))

    if (childTrail.status === 'concluida') {
      appendChildAppLink(body, cycle, 'Ver jornada concluída')
      // Só existe 1 jornada oficial hoje, então "de novo" = a mesma — variar
      // o que a criança refaz é decisão de currículo pra quando existir 2ª.
      if (podePreparar) {
        const denovoBtn = el('button', 'btn btn-accent btn-sm', 'Atribuir jornada de novo')
        denovoBtn.type = 'button'
        denovoBtn.addEventListener('click', () => renderAssign())
        body.append(denovoBtn)
      }
    }

    if (!current) return

    const tm = current.trail_modules
    const currentCard = el('div', 'trilha-current-card journey-current')
    const currentHead = el('div', 'trilha-current-head')
    currentHead.append(el('span', 'trilha-current-kicker', `Módulo atual · ${tm.position} de ${totalModulos}`))
    currentHead.append(el('span', `trilha-formal-status trilha-formal-status--${current.status}`, MODULE_STATUS_LABEL[current.status] || current.status))
    currentCard.append(currentHead)
    currentCard.append(el('h4', null, tm.title))
    if (tm.objective) currentCard.append(el('p', 'card-copy', tm.objective))

    if (current.status === 'bloqueado') {
      if (podePreparar) {
        // Jornada privada: as missões já carregam rodadas/nível definidos na
        // criação de cada atividade — perguntar de novo aqui duplicava a
        // configuração e criava conflito (qual valor vale, o da atividade ou
        // o da liberação?). Só a jornada oficial do Cognita mantém o ajuste
        // aqui, porque as missões dela não têm configuração própria por trás.
        const isPrivate = childTrail.trail_templates?.visibility === 'private'
        let rodadasInput = null
        let nivelInput = null

        if (!isPrivate) {
          const adaptRow = el('div', 'trilha-adapt-row')
          const rodadasField = el('div', 'trilha-adapt-field')
          rodadasField.append(el('label', null, 'Rodadas por missão'))
          rodadasInput = el('input')
          rodadasInput.type = 'number'
          rodadasInput.min = '1'
          rodadasInput.placeholder = 'Padrão'
          rodadasField.append(rodadasInput)
          adaptRow.append(rodadasField)

          const nivelField = el('div', 'trilha-adapt-field')
          nivelField.append(el('label', null, 'Nível'))
          nivelInput = el('input')
          nivelInput.type = 'number'
          nivelInput.min = '1'
          nivelInput.placeholder = 'Padrão'
          nivelField.append(nivelInput)
          adaptRow.append(nivelField)

          adaptRow.append(el('span', 'trilha-adapt-hint', 'Deixe vazio pra usar o padrão do currículo'))
          currentCard.append(adaptRow)
        }

        const btn = el('button', 'btn btn-accent btn-sm', 'Liberar módulo')
        btn.type = 'button'
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const adaptations = {}
          if (rodadasInput?.value) adaptations.rodadas = Number(rodadasInput.value)
          if (nivelInput?.value) adaptations.nivel = Number(nivelInput.value)
          const { error: releaseError } = await releaseChildModule({ childTrailModuleId: current.id, adaptations })
          if (releaseError) {
            btn.disabled = false
            renderErrorLine(currentCard, releaseError.message)
            return
          }
          load()
        })
        currentCard.append(btn)
      }
    } else {
      const { data: missions, error: missionsError } = await getChildTrailMissions(current.id)
      const podeReabrir = current.status === 'aguardando_revisao' && podePreparar
      let reopenPanel
      if (!missionsError && missions) {
        const missionsList = el('div', 'trilha-formal-missions')
        const concluidasN = missions.filter((m) => m.status === 'concluida').length
        progressEl.append(document.createTextNode(` · ${concluidasN} de ${missions.length} missões`))
        missions.forEach((cmi) => {
          const mt = cmi.mission_templates
          const row = el('div', 'trilha-formal-mission-row')
          const left = el('span', 'trilha-formal-mission-left')
          if (mt.emblema) {
            const emblem = el('img', 'journey-mission-emblem')
            emblem.src = emblemaUrl(mt.emblema)
            emblem.alt = ''
            left.append(emblem)
          }
          left.append(document.createTextNode(`${mt.position}. ${mt.title}`))
          row.append(left)
          row.append(el('span', `trilha-formal-status trilha-formal-status--${cmi.status}`, MISSION_STATUS_LABEL[cmi.status] || cmi.status))
          // Só faz sentido escolher uma missão pra repetir/adaptar quando o
          // módulo inteiro está em revisão (todas concluídas) — não durante
          // o módulo ainda em andamento.
          if (podeReabrir && cmi.status === 'concluida') {
            row.classList.add('trilha-formal-mission-row--selecionavel')
            row.tabIndex = 0
            row.setAttribute('role', 'button')
            row.addEventListener('click', () => abrirReopenPanel(cmi))
            row.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abrirReopenPanel(cmi) }
            })
          }
          missionsList.append(row)
        })
        currentCard.append(missionsList)
      }

      // Painel de repetir/adaptar — some até o tutor clicar numa missão
      // concluída da lista acima. Repetir/adaptar não são o caminho
      // principal (isso é "Avançar"); por isso ficam escondidos até
      // pedidos, não expostos por padrão.
      function abrirReopenPanel(missao) {
        reopenPanel.hidden = false
        reopenPanel.replaceChildren()
        reopenPanel.append(el('p', 'card-copy', `Repetir: ${missao.mission_templates.title}`))

        const adaptRow = el('div', 'trilha-adapt-row')
        const rodadasField = el('div', 'trilha-adapt-field')
        rodadasField.append(el('label', null, 'Rodadas'))
        const rodadasInput = el('input')
        rodadasInput.type = 'number'
        rodadasInput.min = '1'
        rodadasInput.placeholder = 'Padrão'
        rodadasField.append(rodadasInput)
        adaptRow.append(rodadasField)

        const nivelField = el('div', 'trilha-adapt-field')
        nivelField.append(el('label', null, 'Nível'))
        const nivelInput = el('input')
        nivelInput.type = 'number'
        nivelInput.min = '1'
        nivelInput.placeholder = 'Padrão'
        nivelField.append(nivelInput)
        adaptRow.append(nivelField)
        reopenPanel.append(adaptRow)

        const actionsRow = el('div', 'trilha-adapt-row')
        const repetirBtn = el('button', 'btn btn-ghost btn-sm', 'Repetir igual')
        repetirBtn.type = 'button'
        const adaptarBtn = el('button', 'btn btn-accent btn-sm', 'Adaptar e repetir')
        adaptarBtn.type = 'button'

        async function reabrir(adaptations) {
          repetirBtn.disabled = true
          adaptarBtn.disabled = true
          const { error: reopenError } = await reopenChildTrailMission({ missionId: missao.id, adaptations })
          if (reopenError) {
            repetirBtn.disabled = false
            adaptarBtn.disabled = false
            renderErrorLine(reopenPanel, reopenError.message)
            return
          }
          load()
        }

        repetirBtn.addEventListener('click', () => reabrir({}))
        adaptarBtn.addEventListener('click', () => {
          const adaptations = {}
          if (rodadasInput.value) adaptations.rodadas = Number(rodadasInput.value)
          if (nivelInput.value) adaptations.nivel = Number(nivelInput.value)
          reabrir(adaptations)
        })
        actionsRow.append(repetirBtn, adaptarBtn)
        reopenPanel.append(actionsRow)
      }

      if (podeReabrir) {
        reopenPanel = el('div', 'trilha-reopen-panel')
        reopenPanel.hidden = true
        currentCard.append(reopenPanel)
      }

      if (current.status === 'aguardando_revisao' && podePreparar) {
        const btn = el('button', 'btn btn-accent btn-sm', 'Avançar módulo')
        btn.type = 'button'
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const { error: advanceError } = await advanceChildTrailModule({ childTrailModuleId: current.id })
          if (advanceError) {
            btn.disabled = false
            renderErrorLine(currentCard, advanceError.message)
            return
          }
          load()
        })
        currentCard.append(btn)
      }
    }

    appendChildAppLink(currentCard, cycle, 'Pré-visualizar como criança')
    body.append(currentCard)
  }

  async function load() {
    body.replaceChildren(el('p', 'card-copy', 'Carregando…'))
    const { data: childTrail, error } = await getLatestChildTrail(cycle.child_id, cycle.id)
    if (error) {
      body.replaceChildren(el('p', 'card-copy', 'Não foi possível carregar a jornada agora.'))
      return
    }
    if (!childTrail) {
      await renderAssign()
      return
    }
    await renderTrail(childTrail)
  }

  panel.loadStatus = load

  return panel
}
