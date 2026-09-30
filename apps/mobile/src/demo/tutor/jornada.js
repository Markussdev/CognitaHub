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
  concluido: 'Completed',
  liberado: 'In progress',
  aguardando_revisao: 'Completed — awaiting your decision',
  bloqueado: 'Not yet unlocked',
}
const MODULE_STATUS_ICON = { concluido: '✓', liberado: '●', aguardando_revisao: '●', bloqueado: '○' }

// A jornada inicial é um ponto de partida da biblioteca, não uma recomendação
// do sistema (o PRODUCT.md deixa a decisão pedagógica com o mediador).
const originLabel = (journey) => (journey.origin === 'default' ? 'Starter journey' : 'Created by you')

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
    if (!progress) return 'Not started yet'
    return `${countCompleted(journey, progress)} of ${countMissions(journey)} missions completed`
  }

  // Só jornadas do mediador (rascunho ou publicada). A jornada inicial fica
  // guardada no store, mas não aparece aqui.
  function listItemHtml(journey) {
    const isDraft = journey.status === 'draft'
    const badge = isDraft
      ? '<span class="demo-badge demo-badge--draft">Draft</span>'
      : '<span class="demo-badge demo-badge--published">Published</span>'

    const hint = isDraft
      ? `${journey.modules.length} ${journey.modules.length === 1 ? 'module' : 'modules'} · only you can see this`
      : progressLine(journey)

    const actions = isDraft
      ? `<button class="demo-secondary demo-secondary--small" type="button" data-edit="${journey.id}">Keep editing</button>`
      : `
        <button class="demo-secondary demo-secondary--small" type="button" data-view="${journey.id}">View</button>
        <button class="demo-primary demo-primary--small" type="button" data-assign="${journey.id}">Assign to ${escapeHtml(nome)}</button>
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
           <span class="demo-label">Your journeys</span>
           ${others.map(listItemHtml).join('')}
         </section>`
      : customs.length
        ? ''
        : `<section class="demo-card">
             <span class="demo-label">Your journeys</span>
             <p class="demo-hint">You haven't created a custom journey yet.</p>
           </section>`

    panel.innerHTML = `
      <section class="demo-card">
        <span class="demo-label">Active</span>
        <h2>${escapeHtml(active.title)}</h2>
        <p class="demo-hint">${originLabel(active)} · ${view.summary.moduleCount} ${view.summary.moduleCount === 1 ? 'module' : 'modules'} · ${escapeHtml(progressLine(active))}</p>
        <ol class="demo-modlist" aria-label="Modules in the active journey">
          ${view.modules
            .map(
              (mod) => `
            <li class="demo-modlist__item demo-modlist__item--${mod.status}">
              <span class="demo-modlist__dot" aria-hidden="true">${MODULE_STATUS_ICON[mod.status]}</span>
              <span>
                <strong>Module ${mod.trail_modules.position} · ${escapeHtml(mod.trail_modules.title)}</strong>
                <small>${MODULE_STATUS_TEXT[mod.status]}</small>
              </span>
            </li>`,
            )
            .join('')}
        </ol>
        ${
          awaiting
            ? `<p class="demo-hint">Moving on to the next module is your call.</p>
               <div class="demo-actions"><button class="demo-primary" type="button" data-advance>Advance to module ${view.summary.releasedModule.position + 1} · ${escapeHtml(view.summary.nextModuleTitle)}</button></div>`
            : ''
        }
        <div class="demo-actions">
          <button class="demo-secondary" type="button" data-view="${active.id}">View journey</button>
        </div>
      </section>

      ${othersCard}

      <button class="demo-primary" type="button" data-new>+ New journey</button>
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
          <span>${isSlot ? 'Prepared now · ' : ''}${escapeHtml(describeDemoDetail(config))}</span>
        </div>
      </div>
    `
  }

  function renderView() {
    const journey = getDemoJourney(viewId)
    const progress = getJourneyProgress(journey.id)
    const isActive = journey.id === getSchoolDemoState().activeJourneyId

    panel.innerHTML = `
      <button class="demo-link" type="button" data-back>‹ Journeys</button>

      ${
        notice
          ? `<div class="demo-flash" role="status"><span class="demo-flash__check" aria-hidden="true">✓</span><div><strong>${escapeHtml(notice.text)}</strong></div></div>`
          : ''
      }

      <section class="demo-card">
        <span class="demo-label">${isActive ? 'Active' : originLabel(journey)}</span>
        <h2>${escapeHtml(journey.title)}</h2>
        ${journey.objective ? `<p>${escapeHtml(journey.objective)}</p>` : ''}
        <p class="demo-hint">${originLabel(journey)} · ${escapeHtml(progressLine(journey))}</p>

        ${journey.modules
          .map(
            (mod, index) => `
          <div class="demo-module">
            <div class="demo-module__head">
              <span class="demo-label">Module ${index + 1}</span>
              <span class="demo-hint">${escapeHtml(sceneOf(mod.visualKey)?.label ?? '')}</span>
            </div>
            <strong class="demo-module__title">${escapeHtml(mod.title)}</strong>
            ${mod.missions.map((mission, missionIndex) => missionRowHtml(mission, missionIndex, progress)).join('')}
          </div>`,
          )
          .join('')}

        <p class="demo-hint">Published journeys are read-only. Create a new journey to make changes.</p>
        ${
          isActive
            ? `<p class="demo-hint"><strong>This is ${escapeHtml(nome)}'s active journey.</strong></p>`
            : `<div class="demo-actions"><button class="demo-primary" type="button" data-assign="${journey.id}">Assign to ${escapeHtml(nome)}</button></div>`
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
        <h2>Journey assigned</h2>
        <p>"${escapeHtml(journey.title)}" is now ${escapeHtml(nome)}'s active journey.</p>
        ${assignedHadProgress ? '<p>Previous progress was preserved.</p>' : ''}
        <div class="demo-actions">
          ${onOpenChild ? '<button class="demo-primary" type="button" data-open-child>Open child experience →</button>' : ''}
          <button class="demo-secondary" type="button" data-back>Back to journeys</button>
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
      <div class="demo-picker" role="group" aria-label="Prepared activities">
        <p class="demo-hint">Choose a prepared activity to turn into a mission:</p>
        ${getDemoActivityLibrary()
          .map(
            (item) => `
          <button class="demo-picker__item" type="button" data-pick="${item.id}" data-mod="${moduleIndex}">
            <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}${item.source === 'prepared' ? ' · prepared by you' : ''}</small></span>
            <span class="demo-picker__add">Add</span>
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
          <span class="demo-label">Module ${index + 1}</span>
          <div class="demo-tools">
            ${iconButton('↑', 'Move module up', `data-mod-move="${index}:-1"`)}
            ${iconButton('↓', 'Move module down', `data-mod-move="${index}:1"`)}
            ${iconButton('✕', 'Remove module', `data-mod-remove="${index}"`, 'demo-iconbtn--bad')}
          </div>
        </div>

        <div class="demo-field">
          <label class="demo-label" for="jr-mtitle-${index}">Module title</label>
          <input class="demo-input" id="jr-mtitle-${index}" type="text" maxlength="60" data-mtitle="${index}"
            placeholder="e.g. Recognize" value="${escapeHtml(mod.title)}" />
        </div>

        <div class="demo-field">
          <span class="demo-label">Scene</span>
          <div class="demo-scenes" role="group" aria-label="Scene for module ${index + 1}">
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

        <span class="demo-label">Missions</span>
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
                  ${iconButton('↑', 'Move mission up', `data-mis-move="${index}:${missionIndex}:-1"`)}
                  ${iconButton('↓', 'Move mission down', `data-mis-move="${index}:${missionIndex}:1"`)}
                  ${iconButton('✕', 'Remove mission', `data-mis-remove="${index}:${missionIndex}"`, 'demo-iconbtn--bad')}
                </div>
              </div>`
                })
                .join('')
            : '<p class="demo-hint">No missions in this module yet.</p>'
        }

        <button class="demo-ghost" type="button" data-add-mission="${index}" ${missionsFull ? 'disabled' : ''}>+ Add mission</button>
        ${missionsFull ? `<p class="demo-hint">Demo limit: up to ${DEMO_MAX_MISSIONS} missions per module.</p>` : ''}
        ${pickerFor === index ? pickerHtml(index) : ''}
      </div>
    `
  }

  function renderEditor() {
    const modulesFull = draft.modules.length >= DEMO_MAX_MODULES

    panel.innerHTML = `
      <button class="demo-link" type="button" data-cancel>‹ Journeys</button>

      <section class="demo-card">
        <h2>${draft.id ? 'Edit journey' : 'New journey'}</h2>
        <p class="demo-hint">Build ${escapeHtml(nome)}'s learning path using activities you've already prepared.</p>

        <div class="demo-field">
          <label class="demo-q" for="jr-title">Title</label>
          <input class="demo-input" id="jr-title" type="text" maxlength="80" placeholder="e.g. Number review" value="${escapeHtml(draft.title)}" />
        </div>
        <div class="demo-field">
          <label class="demo-q" for="jr-objective">Objective (optional)</label>
          <textarea class="demo-textarea" id="jr-objective" rows="2" maxlength="200" placeholder="e.g. reinforce counting before the next module">${escapeHtml(draft.objective)}</textarea>
        </div>
      </section>

      <section class="demo-card">
        <div class="demo-row demo-row--between">
          <h2>Modules</h2>
          <button class="demo-ghost" type="button" data-add-module ${modulesFull ? 'disabled' : ''}>+ Module</button>
        </div>
        ${
          draft.modules.length
            ? ''
            : '<p class="demo-hint">No modules yet. Add the first module, then its missions.</p>'
        }
        ${draft.modules.map(moduleHtml).join('')}
        <p class="demo-hint">Demo limit: up to ${DEMO_MAX_MODULES} modules and ${DEMO_MAX_MISSIONS} missions per module.</p>
      </section>

      <div id="jr-msg" role="status"></div>

      <div class="demo-journey-actions">
        <button class="demo-primary" type="button" data-publish>Publish journey</button>
        <button class="demo-secondary" type="button" data-save-draft>Save draft</button>
      </div>
      <p class="demo-hint">Saving keeps the journey private as a draft. Publishing locks it so it can be assigned to ${escapeHtml(nome)}.</p>
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
    if (!draft.title.trim()) return 'Give the journey a title.'
    if (!draft.modules.length) return 'Add at least 1 module.'

    for (const [index, mod] of draft.modules.entries()) {
      if (!mod.title.trim()) return `Module ${index + 1} needs a title.`
      if (!mod.missions.length) return `Module ${index + 1} needs at least 1 mission.`
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
      if (!id) return setMessage('This journey has already been published.', 'err')

      draft.id = id
      setMessage('Draft saved.', 'ok')
    })

    panel.querySelector('[data-publish]').addEventListener('click', () => {
      const error = validate()
      if (error) return setMessage(error, 'err')

      const id = publishDemoJourney(cleanedDraft())
      if (!id) return setMessage('This journey has already been published.', 'err')

      viewId = id
      notice = { kind: 'ok', text: `Journey published! You can now assign it to ${nome}.` }
      go('view')
    })
  }
}
