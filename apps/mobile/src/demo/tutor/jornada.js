import { escapeHtml } from '../../utils/html.js'
import { LANDMARK_PRESETS } from '../../config/module-visuals.js'
import {
  advanceDemoModule,
  assignDemoJourney,
  getDemoActivityLibrary,
  getDemoJourney,
  getDemoJourneys,
  getJourneyProgress,
  getSchoolDemoState,
  publishDemoJourney,
  saveDemoJourneyDraft,
} from '../school-demo-store.js'
import { getDemoJourneyView, resolveMissionActivity } from '../build-demo-journey.js'
import {
  DEMO_CHILD,
  DEMO_MAX_MISSIONS,
  DEMO_MAX_MODULES,
  DEMO_SCENES,
  describeDemoDetail,
} from '../school-demo-data.js'
import { countCompleted, countMissions, isMissionDone } from '../journey-logic.js'

const MODULE_STATUS_TEXT = {
  concluido: 'Concluído',
  liberado: 'Em andamento',
  aguardando_revisao: 'Concluído — aguardando sua decisão',
  bloqueado: 'Ainda não liberado',
}
const MODULE_STATUS_ICON = { concluido: '✓', liberado: '●', aguardando_revisao: '●', bloqueado: '○' }

// A jornada inicial é um ponto de partida da biblioteca, não uma recomendação
// do sistema (o PRODUCT.md deixa a decisão pedagógica com o mediador).
const originLabel = (journey) => (journey.origin === 'default' ? 'Jornada inicial' : 'Criada por você')

const sceneOf = (key) => LANDMARK_PRESETS.find((preset) => preset.key === key)

let seq = 0
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${++seq}`

function move(list, index, direction) {
  const target = index + direction
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target], list[index]]
}

// Aba Jornada do mediador (demo da Cognita Escola): as jornadas de Mateus e
// o builder. Porta a experiência de js/pages/builder-jornada.js, não a
// infraestrutura: nada de RPC, template privado ou updated_at. Tudo vive no
// school-demo-store.js. Regras que vieram da web: jornada publicada é somente
// leitura (pra mudar, cria outra); salvar e publicar validam a mesma coisa;
// o avanço de módulo é decisão do mediador. Extensões só da demo: escolha de
// cenário por módulo (trail_modules.visual_key existe no banco e o app da
// criança já sabe renderizar) e os limites de tamanho.
export function renderJornadaTab(panel, { goTab, onOpenChild, scrollToTop }) {
  const nome = DEMO_CHILD.name

  let mode = 'overview' // overview | view | editor | assigned
  let viewId = null
  let draft = null
  let pickerFor = null // índice do módulo com o seletor de atividade aberto
  let notice = null // { kind: 'ok' | 'err', text } mostrado na tela de leitura
  let assignedHadProgress = false

  render()

  function go(nextMode) {
    mode = nextMode
    render()
    scrollToTop()
  }

  function render() {
    if (mode === 'view') renderView()
    else if (mode === 'editor') renderEditor()
    else if (mode === 'assigned') renderAssigned()
    else renderOverview()
  }

  // ── visão geral ──────────────────────────────────────────────────────
  function progressLine(journey) {
    const progress = getJourneyProgress(journey.id)
    if (!progress) return 'Ainda não iniciada'
    return `${countCompleted(journey, progress)} de ${countMissions(journey)} missões concluídas`
  }

  // Só jornadas do mediador (rascunho ou publicada). A jornada inicial fica
  // guardada no store, mas não aparece aqui.
  function listItemHtml(journey) {
    const isDraft = journey.status === 'draft'
    const badge = isDraft
      ? '<span class="demo-badge demo-badge--draft">Rascunho</span>'
      : '<span class="demo-badge demo-badge--published">Publicada</span>'

    const hint = isDraft
      ? `${journey.modules.length} ${journey.modules.length === 1 ? 'módulo' : 'módulos'} · só você vê`
      : progressLine(journey)

    const actions = isDraft
      ? `<button class="demo-secondary demo-secondary--small" type="button" data-edit="${journey.id}">Continuar editando</button>`
      : `
        <button class="demo-secondary demo-secondary--small" type="button" data-view="${journey.id}">Ver</button>
        <button class="demo-primary demo-primary--small" type="button" data-assign="${journey.id}">Atribuir para ${escapeHtml(nome)}</button>
      `

    return `
      <div class="demo-list-item">
        <div class="demo-row"><strong>${escapeHtml(journey.title)}</strong>${badge}</div>
        <p class="demo-hint">${escapeHtml(hint)}</p>
        <div class="demo-list-item__actions">${actions}</div>
      </div>
    `
  }

  function renderOverview() {
    const activeId = getSchoolDemoState().activeJourneyId
    const active = getDemoJourney(activeId)
    const view = getDemoJourneyView(activeId)
    const customs = getDemoJourneys().filter((journey) => journey.origin !== 'default')
    const others = customs.filter((journey) => journey.id !== activeId)
    const awaiting = view.summary.releasedStatus === 'aguardando_revisao'

    // Primeira abertura: "Outras jornadas" vazia. Depois que o mediador cria a
    // sua: "Suas jornadas" só com as que não são a ativa (e nada, se não houver).
    const othersCard = others.length
      ? `<section class="demo-card">
           <span class="demo-label">Suas jornadas</span>
           ${others.map(listItemHtml).join('')}
         </section>`
      : customs.length
        ? ''
        : `<section class="demo-card">
             <span class="demo-label">Outras jornadas</span>
             <p class="demo-hint">Você ainda não criou nenhuma jornada.</p>
           </section>`

    panel.innerHTML = `
      <section class="demo-card">
        <span class="demo-label">Ativa</span>
        <h2>${escapeHtml(active.title)}</h2>
        <p class="demo-hint">${originLabel(active)} · ${view.summary.moduleCount} ${view.summary.moduleCount === 1 ? 'módulo' : 'módulos'} · ${escapeHtml(progressLine(active))}</p>
        <ol class="demo-modlist" aria-label="Módulos da jornada ativa">
          ${view.modules
            .map(
              (mod) => `
            <li class="demo-modlist__item demo-modlist__item--${mod.status}">
              <span class="demo-modlist__dot" aria-hidden="true">${MODULE_STATUS_ICON[mod.status]}</span>
              <span>
                <strong>Módulo ${mod.trail_modules.position} · ${escapeHtml(mod.trail_modules.title)}</strong>
                <small>${MODULE_STATUS_TEXT[mod.status]}</small>
              </span>
            </li>`,
            )
            .join('')}
        </ol>
        ${
          awaiting
            ? `<p class="demo-hint">Avançar para o próximo módulo é uma decisão sua.</p>
               <div class="demo-actions"><button class="demo-primary" type="button" data-advance>Avançar para o módulo ${view.summary.releasedModule.position + 1} · ${escapeHtml(view.summary.nextModuleTitle)}</button></div>`
            : ''
        }
        <div class="demo-actions">
          <button class="demo-secondary" type="button" data-view="${active.id}">Ver jornada</button>
        </div>
      </section>

      ${othersCard}

      <button class="demo-primary" type="button" data-new>+ Nova jornada</button>
    `

    panel.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        viewId = button.dataset.view
        notice = null
        go('view')
      })
    })
    panel.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => openEditor(button.dataset.edit))
    })
    panel.querySelectorAll('[data-assign]').forEach((button) => {
      button.addEventListener('click', () => assign(button.dataset.assign))
    })
    panel.querySelector('[data-new]').addEventListener('click', () => openEditor(null))
    panel.querySelector('[data-advance]')?.addEventListener('click', () => {
      advanceDemoModule()
      render()
    })
  }

  function assign(id) {
    const before = getJourneyProgress(id)
    if (!assignDemoJourney(id)) return

    viewId = id
    assignedHadProgress = Boolean(before) && countCompleted(getDemoJourney(id), before) > 0
    go('assigned')
  }

  // ── leitura (jornada publicada é somente leitura) ────────────────────
  function missionRowHtml(mission, index, progress) {
    const { title, config, isSlot } = resolveMissionActivity(mission)
    const done = progress && isMissionDone(progress, mission.id)

    return `
      <div class="demo-mission">
        <span class="demo-mission__pos">${progress ? (done ? '✓' : index + 1) : index + 1}</span>
        <div class="demo-mission__body">
          <strong>${escapeHtml(title)}</strong>
          <span>${isSlot ? 'Preparada agora · ' : ''}${escapeHtml(describeDemoDetail(config))}</span>
        </div>
      </div>
    `
  }

  function renderView() {
    const journey = getDemoJourney(viewId)
    const progress = getJourneyProgress(journey.id)
    const isActive = journey.id === getSchoolDemoState().activeJourneyId

    panel.innerHTML = `
      <button class="demo-link" type="button" data-back>‹ Jornadas</button>

      ${
        notice
          ? `<div class="demo-flash" role="status"><span class="demo-flash__check" aria-hidden="true">✓</span><div><strong>${escapeHtml(notice.text)}</strong></div></div>`
          : ''
      }

      <section class="demo-card">
        <span class="demo-label">${isActive ? 'Ativa' : originLabel(journey)}</span>
        <h2>${escapeHtml(journey.title)}</h2>
        ${journey.objective ? `<p>${escapeHtml(journey.objective)}</p>` : ''}
        <p class="demo-hint">${originLabel(journey)} · ${escapeHtml(progressLine(journey))}</p>

        ${journey.modules
          .map(
            (mod, index) => `
          <div class="demo-module">
            <div class="demo-module__head">
              <span class="demo-label">Módulo ${index + 1}</span>
              <span class="demo-hint">${escapeHtml(sceneOf(mod.visualKey)?.label ?? '')}</span>
            </div>
            <strong class="demo-module__title">${escapeHtml(mod.title)}</strong>
            ${mod.missions.map((mission, missionIndex) => missionRowHtml(mission, missionIndex, progress)).join('')}
          </div>`,
          )
          .join('')}

        <p class="demo-hint">Jornada publicada é somente leitura — para mudar, crie outra.</p>
        ${
          isActive
            ? `<p class="demo-hint"><strong>Esta é a jornada ativa de ${escapeHtml(nome)}.</strong></p>`
            : `<div class="demo-actions"><button class="demo-primary" type="button" data-assign="${journey.id}">Atribuir para ${escapeHtml(nome)}</button></div>`
        }
      </section>
    `

    panel.querySelector('[data-back]').addEventListener('click', () => go('overview'))
    panel.querySelector('[data-assign]')?.addEventListener('click', () => assign(journey.id))
  }

  // ── jornada atribuída ────────────────────────────────────────────────
  function renderAssigned() {
    const journey = getDemoJourney(viewId)

    panel.innerHTML = `
      <section class="demo-card demo-done" role="status">
        <span class="demo-done__check" aria-hidden="true">✓</span>
        <h2>Jornada atribuída</h2>
        <p>"${escapeHtml(journey.title)}" é a jornada ativa de ${escapeHtml(nome)}.</p>
        ${assignedHadProgress ? '<p>O progresso desta jornada foi mantido.</p>' : ''}
        <div class="demo-actions">
          ${onOpenChild ? '<button class="demo-primary" type="button" data-open-child>Ver experiência da criança →</button>' : ''}
          <button class="demo-secondary" type="button" data-back>Voltar às jornadas</button>
        </div>
      </section>
    `

    panel.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
    panel.querySelector('[data-back]').addEventListener('click', () => go('overview'))
  }

  // ── editor ───────────────────────────────────────────────────────────
  function openEditor(journeyId) {
    draft = journeyId
      ? structuredClone(getDemoJourney(journeyId))
      : { id: null, title: '', objective: '', modules: [] }
    pickerFor = null
    go('editor')
  }

  // Muda a estrutura e redesenha; o que foi digitado já está em `draft`
  // (os inputs atualizam a cada tecla).
  function mutate(change) {
    change()
    render()
  }

  function iconButton(glyph, label, attrs, extra = '') {
    return `<button class="demo-iconbtn ${extra}" type="button" aria-label="${label}" ${attrs}>${glyph}</button>`
  }

  function pickerHtml(moduleIndex) {
    return `
      <div class="demo-picker" role="group" aria-label="Atividades preparadas">
        <p class="demo-hint">Escolha uma atividade preparada para virar missão:</p>
        ${getDemoActivityLibrary()
          .map(
            (item) => `
          <button class="demo-picker__item" type="button" data-pick="${item.id}" data-mod="${moduleIndex}">
            <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}${item.source === 'prepared' ? ' · preparada por você' : ''}</small></span>
            <span class="demo-picker__add">Adicionar</span>
          </button>`,
          )
          .join('')}
      </div>
    `
  }

  function moduleHtml(mod, index) {
    const missionsFull = mod.missions.length >= DEMO_MAX_MISSIONS

    return `
      <div class="demo-module">
        <div class="demo-module__head">
          <span class="demo-label">Módulo ${index + 1}</span>
          <div class="demo-tools">
            ${iconButton('↑', 'Subir módulo', `data-mod-move="${index}:-1"`)}
            ${iconButton('↓', 'Descer módulo', `data-mod-move="${index}:1"`)}
            ${iconButton('✕', 'Remover módulo', `data-mod-remove="${index}"`, 'demo-iconbtn--bad')}
          </div>
        </div>

        <div class="demo-field">
          <label class="demo-label" for="jr-mtitle-${index}">Título do módulo</label>
          <input class="demo-input" id="jr-mtitle-${index}" type="text" maxlength="60" data-mtitle="${index}"
            placeholder="Ex.: Reconhecer" value="${escapeHtml(mod.title)}" />
        </div>

        <div class="demo-field">
          <span class="demo-label">Cenário</span>
          <div class="demo-scenes" role="group" aria-label="Cenário do módulo ${index + 1}">
            ${DEMO_SCENES.map((key) => {
              const preset = sceneOf(key)
              return `
              <button class="demo-scene" type="button" data-scene="${key}" data-mod="${index}" aria-pressed="${mod.visualKey === key}">
                <img src="${preset.image}" alt="" />
                <span>${escapeHtml(preset.label)}</span>
              </button>`
            }).join('')}
          </div>
        </div>

        <span class="demo-label">Missões</span>
        ${
          mod.missions.length
            ? mod.missions
                .map((mission, missionIndex) => {
                  const { title, config } = resolveMissionActivity(mission)
                  return `
              <div class="demo-mission">
                <span class="demo-mission__pos">${missionIndex + 1}</span>
                <div class="demo-mission__body">
                  <strong>${escapeHtml(title)}</strong>
                  <span>${escapeHtml(describeDemoDetail(config))}</span>
                </div>
                <div class="demo-tools">
                  ${iconButton('↑', 'Subir missão', `data-mis-move="${index}:${missionIndex}:-1"`)}
                  ${iconButton('↓', 'Descer missão', `data-mis-move="${index}:${missionIndex}:1"`)}
                  ${iconButton('✕', 'Remover missão', `data-mis-remove="${index}:${missionIndex}"`, 'demo-iconbtn--bad')}
                </div>
              </div>`
                })
                .join('')
            : '<p class="demo-hint">Sem missões neste módulo ainda.</p>'
        }

        <button class="demo-ghost" type="button" data-add-mission="${index}" ${missionsFull ? 'disabled' : ''}>+ Adicionar missão</button>
        ${missionsFull ? `<p class="demo-hint">Demonstração: até ${DEMO_MAX_MISSIONS} missões por módulo.</p>` : ''}
        ${pickerFor === index ? pickerHtml(index) : ''}
      </div>
    `
  }

  function renderEditor() {
    const modulesFull = draft.modules.length >= DEMO_MAX_MODULES

    panel.innerHTML = `
      <button class="demo-link" type="button" data-cancel>‹ Jornadas</button>

      <section class="demo-card">
        <h2>${draft.id ? 'Editar jornada' : 'Nova jornada'}</h2>
        <p class="demo-hint">Monte o percurso de ${escapeHtml(nome)} com as atividades que você já preparou.</p>

        <div class="demo-field">
          <label class="demo-q" for="jr-title">Título</label>
          <input class="demo-input" id="jr-title" type="text" maxlength="80" placeholder="Ex.: Revisão de números" value="${escapeHtml(draft.title)}" />
        </div>
        <div class="demo-field">
          <label class="demo-q" for="jr-objective">Objetivo (opcional)</label>
          <textarea class="demo-textarea" id="jr-objective" rows="2" maxlength="200" placeholder="Ex.: reforço leve antes do próximo módulo">${escapeHtml(draft.objective)}</textarea>
        </div>
      </section>

      <section class="demo-card">
        <div class="demo-row demo-row--between">
          <h2>Módulos</h2>
          <button class="demo-ghost" type="button" data-add-module ${modulesFull ? 'disabled' : ''}>+ Módulo</button>
        </div>
        ${
          draft.modules.length
            ? ''
            : '<p class="demo-hint">Nenhum módulo ainda. Adicione o primeiro módulo e depois as missões.</p>'
        }
        ${draft.modules.map(moduleHtml).join('')}
        <p class="demo-hint">Demonstração: até ${DEMO_MAX_MODULES} módulos e ${DEMO_MAX_MISSIONS} missões por módulo.</p>
      </section>

      <div id="jr-msg" role="status"></div>

      <div class="demo-journey-actions">
        <button class="demo-primary" type="button" data-publish>Publicar jornada</button>
        <button class="demo-secondary" type="button" data-save-draft>Salvar como rascunho</button>
      </div>
      <p class="demo-hint">Salvar guarda como rascunho (só você vê). Publicar congela a jornada para você atribuir a ${escapeHtml(nome)}.</p>
    `

    bindEditor()
  }

  function setMessage(text, kind) {
    const box = panel.querySelector('#jr-msg')
    box.className = text ? `demo-msg demo-msg--${kind}` : ''
    box.textContent = text ?? ''
  }

  // Mesmas regras (e mensagens) de buildPayload() em js/pages/builder-jornada.js.
  function validate() {
    if (!draft.title.trim()) return 'Dê um título para a jornada.'
    if (!draft.modules.length) return 'Adicione pelo menos 1 módulo.'

    for (const [index, mod] of draft.modules.entries()) {
      if (!mod.title.trim()) return `O módulo ${index + 1} precisa de um título.`
      if (!mod.missions.length) return `O módulo ${index + 1} precisa de pelo menos 1 missão.`
    }

    return null
  }

  function cleanedDraft() {
    return {
      ...draft,
      title: draft.title.trim(),
      objective: draft.objective.trim(),
      modules: draft.modules.map((mod) => ({ ...mod, title: mod.title.trim() })),
    }
  }

  function bindEditor() {
    panel.querySelector('[data-cancel]').addEventListener('click', () => go('overview'))

    panel.querySelector('#jr-title').addEventListener('input', (event) => {
      draft.title = event.target.value
    })
    panel.querySelector('#jr-objective').addEventListener('input', (event) => {
      draft.objective = event.target.value
    })
    panel.querySelectorAll('[data-mtitle]').forEach((input) => {
      input.addEventListener('input', () => {
        draft.modules[Number(input.dataset.mtitle)].title = input.value
      })
    })

    panel.querySelector('[data-add-module]').addEventListener('click', () => {
      if (draft.modules.length >= DEMO_MAX_MODULES) return
      mutate(() => draft.modules.push({ id: uid('module'), title: '', visualKey: DEMO_SCENES[0], missions: [] }))
    })

    panel.querySelectorAll('[data-mod-move]').forEach((button) => {
      button.addEventListener('click', () => {
        const [index, direction] = button.dataset.modMove.split(':').map(Number)
        mutate(() => {
          pickerFor = null
          move(draft.modules, index, direction)
        })
      })
    })
    panel.querySelectorAll('[data-mod-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        mutate(() => {
          pickerFor = null
          draft.modules.splice(Number(button.dataset.modRemove), 1)
        })
      })
    })

    // Cenário: atualiza no lugar (sem redesenhar) pra tela não pular.
    panel.querySelectorAll('[data-scene]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.mod)
        draft.modules[index].visualKey = button.dataset.scene
        panel.querySelectorAll(`[data-scene][data-mod="${index}"]`).forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button))
        })
      })
    })

    panel.querySelectorAll('[data-add-mission]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.addMission)
        mutate(() => {
          pickerFor = pickerFor === index ? null : index
        })
      })
    })
    panel.querySelectorAll('[data-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.mod)
        const item = getDemoActivityLibrary().find((entry) => entry.id === button.dataset.pick)
        if (!item || draft.modules[index].missions.length >= DEMO_MAX_MISSIONS) return

        // A missão guarda uma cópia da atividade de agora — mudar a atividade
        // preparada depois não mexe numa jornada já montada.
        mutate(() => {
          pickerFor = null
          draft.modules[index].missions.push({ id: uid('mission'), title: item.title, config: structuredClone(item.config) })
        })
      })
    })
    panel.querySelectorAll('[data-mis-move]').forEach((button) => {
      button.addEventListener('click', () => {
        const [moduleIndex, missionIndex, direction] = button.dataset.misMove.split(':').map(Number)
        mutate(() => move(draft.modules[moduleIndex].missions, missionIndex, direction))
      })
    })
    panel.querySelectorAll('[data-mis-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const [moduleIndex, missionIndex] = button.dataset.misRemove.split(':').map(Number)
        mutate(() => draft.modules[moduleIndex].missions.splice(missionIndex, 1))
      })
    })

    panel.querySelector('[data-save-draft]').addEventListener('click', () => {
      const error = validate()
      if (error) return setMessage(error, 'err')

      const id = saveDemoJourneyDraft(cleanedDraft())
      if (!id) return setMessage('Esta jornada já foi publicada.', 'err')

      draft.id = id
      setMessage('Rascunho salvo.', 'ok')
    })

    panel.querySelector('[data-publish]').addEventListener('click', () => {
      const error = validate()
      if (error) return setMessage(error, 'err')

      const id = publishDemoJourney(cleanedDraft())
      if (!id) return setMessage('Esta jornada já foi publicada.', 'err')

      viewId = id
      notice = { kind: 'ok', text: `Jornada publicada! Você já pode atribuí-la a ${nome}.` }
      go('view')
    })
  }
}
