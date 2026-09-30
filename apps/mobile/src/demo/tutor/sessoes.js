import { escapeHtml } from '../../utils/html.js'
import { getSchoolDemoState, hasPendingExecution, registerDemoSession } from '../school-demo-store.js'
import { DEMO_CHILD, formatDemoQuando } from '../school-demo-data.js'

// Perguntas e composição da devolutiva portadas de js/pages/tutor/sessao-wizard.js
// (PARTICIPACAO_OPTS … composeFamilySummary, "Registro de sessão"). Mesmas
// opções e mesmas frases da web — a demo não inventa texto pedagógico. Se o
// original mudar, isto precisa acompanhar (é uma cópia, não um import).
const PARTICIPACAO_OPTS = [
  { val: 'bem', label: 'Engaged well' },
  { val: 'oscilou', label: 'Engagement varied' },
  { val: 'incentivo', label: 'Needed encouragement' },
  { val: 'nao_quis', label: 'Chose not to participate' },
]
const APOIO_OPTS = [
  { val: 'autonomia', label: 'Worked independently' },
  { val: 'pouco', label: 'Light support' },
  { val: 'frequente', label: 'Frequent support' },
  { val: 'nao_concluiu', label: 'Could not be completed' },
]
const RESULTADO_OPTS = [
  { val: 'avancou', label: 'Made progress' },
  { val: 'manteve', label: 'Held steady' },
  { val: 'dificuldade', label: 'Found it difficult' },
  { val: 'retomar', label: 'To revisit' },
]

const QUESTIONS = [
  { key: 'participacao', title: `How did ${DEMO_CHILD.name} engage?`, options: PARTICIPACAO_OPTS },
  { key: 'apoio', title: 'How much support was needed?', options: APOIO_OPTS },
  { key: 'resultado', title: 'How did the activity end?', options: RESULTADO_OPTS },
]

// A demo guarda uma execução pendente só; com mais de uma, cai na frase
// genérica que o original usa a partir de 3 atividades.
function fraseAtividades(titulo, total) {
  return total > 1 ? `the ${total} activities from today` : `the activity "${titulo}"`
}

// Devolutiva determinística: 2-3 frases curtas montadas a partir das
// respostas. O próximo passo NÃO entra aqui — a família já o vê como campo
// próprio. O mediador revisa e edita antes de compartilhar.
function composeFamilySummary({ nome, atividadeFrase, participacao, apoio, resultado }) {
  const primeira = {
    bem: `${nome} engaged well in ${atividadeFrase}.`,
    oscilou: `${nome} took part in ${atividadeFrase}, with moments of more and less engagement.`,
    incentivo: `${nome} needed some encouragement to take part in ${atividadeFrase}.`,
    nao_quis: `${nome} chose not to take part in ${atividadeFrase} this time — that's okay, it's part of the process.`,
  }[participacao] || `${nome} took part in ${atividadeFrase}.`

  const segunda = participacao === 'nao_quis' ? '' : ({
    autonomia: 'Worked through the tasks independently.',
    pouco: 'Needed only light support along the way.',
    frequente: 'Relied on frequent support from the tutor.',
    nao_concluiu: 'It was not possible to complete the task this time.',
  }[apoio] || '')

  const terceira = {
    avancou: 'Made progress on what was being worked on.',
    manteve: 'Held on to what has been built so far.',
    dificuldade: 'Found some parts difficult, which we will revisit calmly.',
    retomar: 'The activity will be revisited at the next session.',
  }[resultado] || ''

  return [primeira, segunda, terceira].filter(Boolean).join(' ')
}

// Aba Sessões do mediador (demo da Cognita Escola): transforma a execução
// pendente de Mateus numa sessão. O que sai daqui é o que a família lê em
// demo-family.js — só o nível 2 (resumo) e o próximo passo; a nota interna
// (nível 3) fica no store e nunca é lida pela tela da família.
export function renderSessoesTab(panel, { goTab, scrollToTop, options = {} }) {
  const nome = DEMO_CHILD.name

  const s = {
    step: 1,
    participacao: '',
    apoio: '',
    resultado: '',
    observacao: '',
    proximoPasso: '',
    familyText: '',
    familyEdited: false,
    reviewed: false,
  }

  // ── linha do tempo ───────────────────────────────────────────────────
  function renderList() {
    const { execution, session } = getSchoolDemoState()
    const pending = hasPendingExecution()

    const flash = options.flash
      ? `
        <div class="demo-flash" role="status">
          <span class="demo-flash__check" aria-hidden="true">✓</span>
          <div>
            <strong>Session saved</strong>
            <p>The reviewed feedback is now available to ${escapeHtml(nome)}'s family.</p>
          </div>
        </div>
      `
      : ''

    const timeline = pending
      ? `
        <section class="demo-card">
          <h2>${escapeHtml(nome)} completed ${execution.total === 1 ? 'an activity' : `${execution.total} activities`}</h2>
          <p>Turn what the child did into feedback for the family.</p>
          <ul class="demo-timeline">
            <li><span aria-hidden="true">✓</span> ${escapeHtml(execution.titulo)} · ${escapeHtml(formatDemoQuando(execution.completedAt))}</li>
          </ul>
          <div class="demo-actions">
            <button class="demo-primary" type="button" data-register>Review session</button>
          </div>
        </section>
      `
      : `
        <section class="demo-card">
          <h2>No activities awaiting review.</h2>
          <p>When ${escapeHtml(nome)} completes an activity, it will appear here.</p>
        </section>
      `

    const history = session.exists
      ? `
        <section class="demo-card">
          <span class="demo-label">Latest saved session</span>
          <article class="demo-session">
            <div class="demo-session__head">
              <strong>${escapeHtml(session.activityTitle)}</strong>
              <span>${escapeHtml(formatDemoQuando(session.createdAt))}</span>
            </div>
            <p>${escapeHtml(session.familySummary)}</p>
            ${session.nextStep ? `<p><strong>Next step:</strong> ${escapeHtml(session.nextStep)}</p>` : ''}
            ${session.notes ? `<p class="demo-private"><span aria-hidden="true">🔒</span> Internal note — only tutors can see this: ${escapeHtml(session.notes)}</p>` : ''}
          </article>
        </section>
      `
      : ''

    panel.innerHTML = `${flash}${timeline}${history}`
    panel.querySelector('[data-register]')?.addEventListener('click', () => {
      renderStep1()
      scrollToTop()
    })
  }

  // ── passo 1: como foi ────────────────────────────────────────────────
  function questionHtml({ key, title, options: choices }) {
    return `
      <div class="demo-block">
        <h3 class="demo-q" id="demo-q-${key}">${escapeHtml(title)}</h3>
        <div class="demo-options" role="radiogroup" aria-labelledby="demo-q-${key}">
          ${choices
            .map(
              ({ val, label }) => `
                <button class="demo-option" type="button" role="radio" aria-checked="${s[key] === val}" data-q="${key}" data-val="${val}">
                  <span class="demo-option__dot" aria-hidden="true"></span>${label}
                </button>
              `,
            )
            .join('')}
        </div>
      </div>
    `
  }

  const canContinue = () => Boolean(s.participacao && s.apoio && s.resultado)

  function renderStep1() {
    s.step = 1
    const { execution } = getSchoolDemoState()

    panel.innerHTML = `
      <section class="demo-card">
        <h2>Record session for ${escapeHtml(nome)}</h2>

        <div class="demo-fact">
          <span class="demo-fact__check" aria-hidden="true">✓</span>
          <div>
            <strong>${escapeHtml(execution.titulo)}${execution.total > 1 ? ` and ${execution.total - 1} more` : ''}</strong>
            <span>Completed ${escapeHtml(formatDemoQuando(execution.completedAt))}</span>
          </div>
        </div>

        ${QUESTIONS.map(questionHtml).join('')}

        <div class="demo-field">
          <label class="demo-q" for="demo-notes">Anything important to note? (optional)</label>
          <textarea class="demo-textarea" id="demo-notes" rows="3" placeholder="Questions, points to review with the team…">${escapeHtml(s.observacao)}</textarea>
          <p class="demo-lock"><span aria-hidden="true">🔒</span> Internal note — the family never sees what you write here.</p>
        </div>

        <details class="demo-details" ${s.proximoPasso ? 'open' : ''}>
          <summary>Add a plan (optional)</summary>
          <textarea class="demo-textarea" id="demo-next" rows="3" placeholder="What should be worked on next session?">${escapeHtml(s.proximoPasso)}</textarea>
          <p class="demo-hint">Families see this as the "next step".</p>
        </details>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-cancel>Back</button>
          <button class="demo-primary" type="button" data-continue ${canContinue() ? '' : 'disabled'}>Review feedback</button>
        </div>
      </section>
    `

    const continueBtn = panel.querySelector('[data-continue]')

    panel.querySelectorAll('[data-q]').forEach((button) => {
      button.addEventListener('click', () => {
        s[button.dataset.q] = button.dataset.val
        panel.querySelectorAll(`[data-q="${button.dataset.q}"]`).forEach((other) => {
          other.setAttribute('aria-checked', String(other === button))
        })
        continueBtn.disabled = !canContinue()
      })
    })

    panel.querySelector('#demo-notes').addEventListener('input', (event) => {
      s.observacao = event.target.value
    })
    panel.querySelector('#demo-next').addEventListener('input', (event) => {
      s.proximoPasso = event.target.value
    })

    panel.querySelector('[data-cancel]').addEventListener('click', () => goTab('sessoes'))
    continueBtn.addEventListener('click', () => {
      if (!canContinue()) return
      renderStep2()
      scrollToTop()
    })
  }

  // ── passo 2: o que a família recebe ──────────────────────────────────
  function suggestedSummary() {
    const { execution } = getSchoolDemoState()

    return composeFamilySummary({
      nome,
      atividadeFrase: fraseAtividades(execution.titulo, execution.total),
      participacao: s.participacao,
      apoio: s.apoio,
      resultado: s.resultado,
    })
  }

  function renderStep2() {
    s.step = 2

    if (!s.familyEdited || !s.familyText.trim()) {
      s.familyText = suggestedSummary()
      s.familyEdited = false
    }

    const next = s.proximoPasso.trim()

    panel.innerHTML = `
      <section class="demo-card">
        <h2>Feedback for the family</h2>
        <p class="demo-hint">We drafted this summary from your answers — review it and make it your own.</p>

        <div class="demo-field">
          <label class="demo-q" for="demo-family-text">What the family will receive</label>
          <textarea class="demo-textarea demo-textarea--tall" id="demo-family-text" maxlength="800">${escapeHtml(s.familyText)}</textarea>
          <div class="demo-count" id="demo-count">${s.familyText.length} / 800 characters</div>
          <button class="demo-ghost" type="button" data-regen>↻ Regenerate suggestion</button>
        </div>

        <div class="demo-preview demo-preview--family">
          <span class="demo-label">How the family will see it</span>
          <strong>${escapeHtml(nome)}: session summary</strong>
          <p id="demo-family-preview">${escapeHtml(s.familyText)}</p>
          ${next ? `<p>Next step: ${escapeHtml(next)}</p>` : ''}
        </div>

        <label class="demo-check">
          <input type="checkbox" id="demo-reviewed" ${s.reviewed ? 'checked' : ''} />
          <span>I reviewed the message that will be shared with the family.</span>
        </label>
        <p class="demo-hint">Use simple, respectful language based on what you observed.</p>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-back>Back</button>
          <button class="demo-primary" type="button" data-save>Save session</button>
        </div>
      </section>
    `

    const saveBtn = panel.querySelector('[data-save]')
    const textarea = panel.querySelector('#demo-family-text')
    const canSave = () => Boolean(s.familyText.trim() && s.reviewed)
    const updateSave = () => {
      saveBtn.disabled = !canSave()
    }
    updateSave()

    textarea.addEventListener('input', () => {
      s.familyText = textarea.value
      s.familyEdited = true
      panel.querySelector('#demo-count').textContent = `${textarea.value.length} / 800 characters`
      panel.querySelector('#demo-family-preview').textContent = textarea.value.trim() || '…'
      updateSave()
    })

    panel.querySelector('#demo-reviewed').addEventListener('change', (event) => {
      s.reviewed = event.target.checked
      updateSave()
    })

    panel.querySelector('[data-regen]').addEventListener('click', () => {
      s.familyEdited = false
      s.familyText = ''
      renderStep2()
    })

    panel.querySelector('[data-back]').addEventListener('click', () => {
      renderStep1()
      scrollToTop()
    })

    saveBtn.addEventListener('click', () => {
      if (!canSave()) return

      const saved = registerDemoSession({
        participacao: s.participacao,
        apoio: s.apoio,
        resultado: s.resultado,
        familySummary: s.familyText.trim(),
        notes: s.observacao.trim(),
        nextStep: s.proximoPasso.trim(),
      })

      goTab('sessoes', { flash: saved })
    })
  }

  // Por último: as funções acima e canContinue precisam já estar definidas.
  if (options.openWizard && hasPendingExecution()) {
    renderStep1()
  } else {
    renderList()
  }
}
