import '../styles/school-demo.css'

import { mountActivity } from '../activities/activity-runner.js'
import { escapeHtml } from '../utils/html.js'
import { getSchoolDemoState, updateDemoActivity } from './school-demo-store.js'
import { DEMO_CHILD, buildDemoActivity } from './school-demo-data.js'

const STEPS = ['Experiência', 'Ajustar', 'Revisar']

const MOLDES = [
  { key: 'contar', label: 'Contagem visual', hint: 'A criança toca em cada dinossauro para contar.' },
  { key: 'identificar', label: 'Identificar números', hint: 'A criança toca no número que a atividade pedir.' },
]

// Só controles que mudam de fato a atividade que a criança recebe — os limites
// vêm de activities/counting.js (3 a 8 itens) e identifying.js (config.maiorNumero).
const RANGES = {
  contar: {
    key: 'quantidade',
    label: 'Quantos itens',
    min: 3,
    max: 8,
    hint: 'Único tema disponível por enquanto: dinossauros.',
  },
  identificar: {
    key: 'maiorNumero',
    label: 'Maior número',
    min: 3,
    max: 9,
    hint: 'Os números da atividade vão de 1 até esse valor.',
  },
}

const ROUNDS = [1, 2, 3, 4, 5]

function summaryLine(draft) {
  const molde = MOLDES.find((item) => item.key === draft.molde)
  const range = RANGES[draft.molde]
  const detail = draft.molde === 'contar' ? `${draft[range.key]} itens` : `números até ${draft[range.key]}`
  const rounds = `${draft.rodadas} ${draft.rodadas === 1 ? 'rodada' : 'rodadas'}`

  return `${molde.label} · ${detail} · ${rounds}`
}

// Preparo de uma atividade pelo mediador (demo da Cognita Escola). "Liberar"
// grava no store local — é o que a criança abre em demo-child.js. Nada disso
// chama Supabase.
export function renderDemoTutorExperience(root, { onExit, onOpenChild } = {}) {
  const draft = { ...getSchoolDemoState().activity }
  let step = 1
  let released = false

  render()

  function stepsHtml() {
    return `
      <ol class="demo-steps" aria-label="Etapas do preparo">
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
    return `
      <section class="demo-card">
        <h2>Qual experiência?</h2>
        <div class="demo-choices" role="group" aria-label="Experiência">
          ${MOLDES.map(
            (molde) => `
              <button class="demo-choice" type="button" data-molde="${molde.key}" aria-pressed="${draft.molde === molde.key}">
                <strong>${molde.label}</strong>
                <span>${molde.hint}</span>
              </button>
            `,
          ).join('')}
        </div>
        <div class="demo-actions">
          <button class="demo-primary" type="button" data-next>Continuar</button>
        </div>
      </section>
    `
  }

  function adjustStepHtml() {
    const range = RANGES[draft.molde]

    return `
      <section class="demo-card">
        <h2>Ajustar para ${escapeHtml(DEMO_CHILD.name)}</h2>

        <div class="demo-field">
          <div class="demo-field__row">
            <label class="demo-label" for="demo-range">${range.label}</label>
            <output class="demo-field__value" id="demo-range-out" for="demo-range">${draft[range.key]}</output>
          </div>
          <input class="demo-range" id="demo-range" type="range" min="${range.min}" max="${range.max}" step="1" value="${draft[range.key]}" />
          <p class="demo-hint">${range.hint}</p>
        </div>

        <div class="demo-field">
          <span class="demo-label" id="demo-rounds-label">Rodadas</span>
          <div class="demo-seg" role="group" aria-labelledby="demo-rounds-label">
            ${ROUNDS.map(
              (rounds) => `
                <button class="demo-seg__btn" type="button" data-rounds="${rounds}" aria-pressed="${draft.rodadas === rounds}">${rounds}</button>
              `,
            ).join('')}
          </div>
        </div>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-prev>Anterior</button>
          <button class="demo-primary" type="button" data-next>Continuar</button>
        </div>
      </section>
    `
  }

  function reviewStepHtml() {
    const activity = buildDemoActivity(draft, 'demo-activity-preview')

    return `
      <section class="demo-card">
        <h2>Revisar</h2>
        <p class="demo-summary">${escapeHtml(summaryLine(draft))}</p>

        <div class="demo-preview">
          <span class="demo-label">Prévia · o que a criança vê</span>
          <h3>${escapeHtml(activity.titulo)}</h3>
          <p>${escapeHtml(activity.instrucao)}</p>
          <div class="demo-preview__stage" id="demo-preview-stage" inert></div>
        </div>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-prev>Anterior</button>
          <button class="demo-primary" type="button" data-release>Liberar para ${escapeHtml(DEMO_CHILD.name)}</button>
        </div>
      </section>
    `
  }

  function releasedHtml() {
    return `
      <section class="demo-card demo-done" role="status">
        <span class="demo-done__check" aria-hidden="true">✓</span>
        <h2>Atividade preparada</h2>
        <p>A experiência de ${escapeHtml(DEMO_CHILD.name)} foi atualizada.</p>
        <p class="demo-summary">${escapeHtml(summaryLine(draft))}</p>
        <div class="demo-actions">
          ${
            onOpenChild
              ? `<button class="demo-primary" type="button" data-open-child>Ver experiência da criança →</button>`
              : ''
          }
          <button class="demo-secondary" type="button" data-exit>Voltar ao Cognita Escola</button>
        </div>
      </section>
    `
  }

  function render() {
    root.innerHTML = `
      <div class="demo-screen">
        <header class="demo-header">
          <button class="demo-back" type="button" data-demo-back aria-label="Voltar ao Cognita Escola">
            <span aria-hidden="true">‹</span> Cognita Escola
          </button>
          <span class="demo-eyebrow">Mediador</span>
          <h1>Preparar para ${escapeHtml(DEMO_CHILD.name)}</h1>
          <p>${DEMO_CHILD.age} anos · ciclo ativo</p>
        </header>

        ${
          released
            ? releasedHtml()
            : `${stepsHtml()}${step === 1 ? experienceStepHtml() : step === 2 ? adjustStepHtml() : reviewStepHtml()}`
        }

        <p class="demo-note">Demonstração com dados fictícios.</p>
      </div>
    `

    root.querySelector('[data-demo-back]')?.addEventListener('click', () => onExit?.())
    root.querySelector('[data-exit]')?.addEventListener('click', () => onExit?.())
    root.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())

    root.querySelector('[data-prev]')?.addEventListener('click', () => {
      step -= 1
      render()
    })

    root.querySelector('[data-next]')?.addEventListener('click', () => {
      step += 1
      render()
    })

    // Escolhas atualizam no lugar (sem re-render) pra tela não voltar ao topo
    // no meio do ajuste.
    root.querySelectorAll('[data-molde]').forEach((button) => {
      button.addEventListener('click', () => {
        draft.molde = button.dataset.molde
        root.querySelectorAll('[data-molde]').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button))
        })
      })
    })

    const range = root.querySelector('#demo-range')
    range?.addEventListener('input', () => {
      draft[RANGES[draft.molde].key] = Number(range.value)
      root.querySelector('#demo-range-out').textContent = range.value
    })

    root.querySelectorAll('[data-rounds]').forEach((button) => {
      button.addEventListener('click', () => {
        draft.rodadas = Number(button.dataset.rounds)
        root.querySelectorAll('[data-rounds]').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button))
        })
      })
    })

    // Prévia com o mesmo molde da criança, montada só pra olhar: o palco é
    // inerte e onSuccess não faz nada.
    const previewStage = root.querySelector('#demo-preview-stage')
    if (previewStage) {
      mountActivity(buildDemoActivity(draft, 'demo-activity-preview'), {
        stageEl: previewStage,
        onSuccess: () => {},
      })
    }

    root.querySelector('[data-release]')?.addEventListener('click', () => {
      updateDemoActivity(draft)
      released = true
      render()
    })
  }
}
