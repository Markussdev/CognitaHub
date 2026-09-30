import { mountActivity } from '../../activities/activity-runner.js'
import { escapeHtml } from '../../utils/html.js'
import { getDemoSlotState, getSchoolDemoState, updateDemoActivity } from '../school-demo-store.js'
import {
  DEFAULT_JOURNEY_ID,
  DEMO_CHILD,
  DEMO_MOLDES,
  buildDemoActivity,
  describeDemoActivity,
} from '../school-demo-data.js'

const STEPS = ['Experience', 'Customize', 'Review']

// O que acontece com a atividade preparada agora (ver getDemoSlotState).
const SLOT_HINT = {
  waiting: (nome) => `waiting for ${nome}`,
  done: (nome) => `completed by ${nome}`,
  library: () => 'saved to your library (the "Prepared now" mission was already completed)',
}

// Só controles que mudam de fato a atividade que a criança recebe — os limites
// vêm de activities/counting.js (3 a 8 itens) e identifying.js (config.maiorNumero).
const RANGES = {
  contar: {
    key: 'quantidade',
    label: 'Number of items',
    min: 3,
    max: 8,
    hint: 'Demo theme: Dinosaurs.',
  },
  identificar: {
    key: 'maiorNumero',
    label: 'Highest number',
    min: 3,
    max: 9,
    hint: 'The activity uses numbers from 1 up to this value.',
  },
}

const ROUNDS = [1, 2, 3, 4, 5]

// Aba Atividades do mediador (demo da Cognita Escola): assistente de 3 passos.
// "Liberar" troca a atividade preparada no store local — é o que a criança
// abre em demo-child.js. Nada disso chama Supabase.
export function renderAtividadesTab(panel, { goTab, onOpenChild, scrollToTop }) {
  const { molde, quantidade, maiorNumero, rodadas } = getSchoolDemoState().activity
  const draft = { molde, quantidade, maiorNumero, rodadas }
  let step = 1
  let released = false

  render()

  function stepsHtml() {
    return `
      <ol class="demo-steps" aria-label="Preparation steps">
        ${STEPS.map((label, index) => {
          const number = index + 1
          const state = number < step ? 'done' : number === step ? 'current' : 'todo'

          return `
            <li class="demo-steps__item demo-steps__item--${state}" ${state === 'current' ? 'aria-current="step"' : ''}>
              <span class="demo-steps__dot" aria-hidden="true">${state === 'done' ? '✓' : number}</span>
              ${label}
            </li>
          `
        }).join('')}
      </ol>
    `
  }

  function experienceStepHtml() {
    const current = getSchoolDemoState().activity

    return `
      <section class="demo-card">
        <h2>Which experience?</h2>
        <p class="demo-hint">
          Prepared now: ${escapeHtml(describeDemoActivity(current))} —
          ${escapeHtml(SLOT_HINT[getDemoSlotState()](DEMO_CHILD.name))}.
        </p>
        <div class="demo-choices" role="group" aria-label="Experience">
          ${DEMO_MOLDES.map(
            (item) => `
              <button class="demo-choice" type="button" data-molde="${item.key}" aria-pressed="${draft.molde === item.key}">
                <strong>${item.label}</strong>
                <span>${item.hint}</span>
              </button>
            `,
          ).join('')}
        </div>
        <div class="demo-actions">
          <button class="demo-primary" type="button" data-next>Continue</button>
        </div>
      </section>
    `
  }

  function adjustStepHtml() {
    const range = RANGES[draft.molde]

    return `
      <section class="demo-card">
        <h2>Customize for ${escapeHtml(DEMO_CHILD.name)}</h2>

        <div class="demo-field">
          <div class="demo-field__row">
            <label class="demo-label" for="demo-range">${range.label}</label>
            <output class="demo-field__value" id="demo-range-out" for="demo-range">${draft[range.key]}</output>
          </div>
          <input class="demo-range" id="demo-range" type="range" min="${range.min}" max="${range.max}" step="1" value="${draft[range.key]}" />
          <p class="demo-hint">${range.hint}</p>
        </div>

        <div class="demo-field">
          <span class="demo-label" id="demo-rounds-label">Rounds</span>
          <div class="demo-seg" role="group" aria-labelledby="demo-rounds-label">
            ${ROUNDS.map(
              (rounds) => `
                <button class="demo-seg__btn" type="button" data-rounds="${rounds}" aria-pressed="${draft.rodadas === rounds}">${rounds}</button>
              `,
            ).join('')}
          </div>
        </div>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-prev>Back</button>
          <button class="demo-primary" type="button" data-next>Continue</button>
        </div>
      </section>
    `
  }

  function reviewStepHtml() {
    const activity = buildDemoActivity(draft, 'demo-activity-preview')

    return `
      <section class="demo-card">
        <h2>Review</h2>
        <p class="demo-summary">${escapeHtml(describeDemoActivity(draft))}</p>

        <div class="demo-preview">
          <span class="demo-label">Preview · what the child sees</span>
          <h3>${escapeHtml(activity.titulo)}</h3>
          <p>${escapeHtml(activity.instrucao)}</p>
          <div class="demo-preview__stage" id="demo-preview-stage" inert></div>
        </div>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-prev>Back</button>
          <button class="demo-primary" type="button" data-release>Assign to ${escapeHtml(DEMO_CHILD.name)}</button>
        </div>
      </section>
    `
  }

  // A missão "Preparada agora" vive na jornada inicial. Enquanto ela espera a
  // criança e a jornada inicial é a ativa, liberar muda o que ela recebe;
  // nos outros casos (missão já concluída, ou outra jornada ativa) a atividade
  // só vai pro acervo e precisa entrar numa jornada.
  function releasedHtml() {
    const nome = escapeHtml(DEMO_CHILD.name)
    const initialActive = getSchoolDemoState().activeJourneyId === DEFAULT_JOURNEY_ID
    const reachesChild = getDemoSlotState() === 'waiting' && initialActive

    const message = reachesChild
      ? `<p>${nome}'s experience has been updated.</p>`
      : getDemoSlotState() === 'library'
        ? `<p>Add this activity to a journey to assign it to ${nome}.</p>`
        : `<p>Add this activity to a journey to assign it to ${nome}.</p>`

    const primary =
      reachesChild && onOpenChild
        ? `<button class="demo-primary" type="button" data-open-child>Open child experience →</button>`
        : `<button class="demo-primary" type="button" data-go-jornada>View journeys</button>`

    return `
      <section class="demo-card demo-done" role="status">
        <span class="demo-done__check" aria-hidden="true">✓</span>
        <h2>${reachesChild ? 'Activity assigned' : 'Saved to your activity library'}</h2>
        ${message}
        <p class="demo-summary">${escapeHtml(describeDemoActivity(draft))}</p>
        <div class="demo-actions">
          ${primary}
          <button class="demo-secondary" type="button" data-go-resumo>View Overview</button>
        </div>
      </section>
    `
  }

  function render() {
    panel.innerHTML = released
      ? releasedHtml()
      : `${stepsHtml()}${step === 1 ? experienceStepHtml() : step === 2 ? adjustStepHtml() : reviewStepHtml()}`

    panel.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
    panel.querySelector('[data-go-resumo]')?.addEventListener('click', () => goTab('resumo'))
    panel.querySelector('[data-go-jornada]')?.addEventListener('click', () => goTab('jornada'))

    panel.querySelector('[data-prev]')?.addEventListener('click', () => {
      step -= 1
      render()
      scrollToTop()
    })

    panel.querySelector('[data-next]')?.addEventListener('click', () => {
      step += 1
      render()
      scrollToTop()
    })

    // Escolhas atualizam no lugar (sem re-render) pra tela não voltar ao topo
    // no meio do ajuste.
    panel.querySelectorAll('[data-molde]').forEach((button) => {
      button.addEventListener('click', () => {
        draft.molde = button.dataset.molde
        panel.querySelectorAll('[data-molde]').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button))
        })
      })
    })

    const range = panel.querySelector('#demo-range')
    range?.addEventListener('input', () => {
      draft[RANGES[draft.molde].key] = Number(range.value)
      panel.querySelector('#demo-range-out').textContent = range.value
    })

    panel.querySelectorAll('[data-rounds]').forEach((button) => {
      button.addEventListener('click', () => {
        draft.rodadas = Number(button.dataset.rounds)
        panel.querySelectorAll('[data-rounds]').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button))
        })
      })
    })

    // Prévia com o mesmo molde da criança, montada só pra olhar: o palco é
    // inerte e onSuccess não faz nada.
    const previewStage = panel.querySelector('#demo-preview-stage')
    if (previewStage) {
      mountActivity(buildDemoActivity(draft, 'demo-activity-preview'), {
        stageEl: previewStage,
        onSuccess: () => {},
      })
    }

    panel.querySelector('[data-release]')?.addEventListener('click', () => {
      updateDemoActivity(draft)
      released = true
      render()
      scrollToTop()
    })
  }
}
