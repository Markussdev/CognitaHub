import { escapeHtml } from '../../utils/html.js'
import { getSchoolDemoState, hasPendingExecution, registerDemoSession } from '../school-demo-store.js'
import { DEMO_CHILD, formatDemoQuando } from '../school-demo-data.js'

// Perguntas e composição da devolutiva portadas de js/pages/tutor.js
// (PARTICIPACAO_OPTS … composeFamilySummary, "Registro de sessão"). Mesmas
// opções e mesmas frases da web — a demo não inventa texto pedagógico. Se o
// original mudar, isto precisa acompanhar (é uma cópia, não um import).
const PARTICIPACAO_OPTS = [
  { val: 'bem', label: 'Participou bem' },
  { val: 'oscilou', label: 'Oscilou durante a atividade' },
  { val: 'incentivo', label: 'Precisou de incentivo' },
  { val: 'nao_quis', label: 'Não quis participar' },
]
const APOIO_OPTS = [
  { val: 'autonomia', label: 'Fez com autonomia' },
  { val: 'pouco', label: 'Pouco apoio' },
  { val: 'frequente', label: 'Apoio frequente' },
  { val: 'nao_concluiu', label: 'Não foi possível concluir' },
]
const RESULTADO_OPTS = [
  { val: 'avancou', label: 'Avançou' },
  { val: 'manteve', label: 'Manteve o que já sabia' },
  { val: 'dificuldade', label: 'Teve dificuldade' },
  { val: 'retomar', label: 'Ficou para retomar' },
]

const QUESTIONS = [
  { key: 'participacao', title: `Como ${DEMO_CHILD.name} participou?`, options: PARTICIPACAO_OPTS },
  { key: 'apoio', title: 'Quanto apoio foi necessário?', options: APOIO_OPTS },
  { key: 'resultado', title: 'Como a atividade terminou?', options: RESULTADO_OPTS },
]

// A demo guarda uma execução pendente só; com mais de uma, cai na frase
// genérica que o original usa a partir de 3 atividades.
function fraseAtividades(titulo, total) {
  return total > 1 ? `das ${total} atividades de hoje` : `da atividade "${titulo}"`
}

// Devolutiva determinística: 2-3 frases curtas montadas a partir das
// respostas. O próximo passo NÃO entra aqui — a família já o vê como campo
// próprio. O mediador revisa e edita antes de compartilhar.
function composeFamilySummary({ nome, atividadeFrase, participacao, apoio, resultado }) {
  const primeira = {
    bem: `${nome} participou bem ${atividadeFrase}.`,
    oscilou: `${nome} participou ${atividadeFrase}, alternando momentos de mais e menos envolvimento.`,
    incentivo: `${nome} precisou de incentivo para participar ${atividadeFrase}.`,
    nao_quis: `${nome} não quis participar ${atividadeFrase} desta vez — tudo bem, isso também faz parte do processo.`,
  }[participacao] || `${nome} participou ${atividadeFrase}.`

  const segunda = participacao === 'nao_quis' ? '' : ({
    autonomia: 'Fez as propostas com autonomia.',
    pouco: 'Precisou de pouco apoio pelo caminho.',
    frequente: 'Contou com apoio frequente do tutor.',
    nao_concluiu: 'Não foi possível concluir a proposta desta vez.',
  }[apoio] || '')

  const terceira = {
    avancou: 'Avançou no que estava sendo trabalhado.',
    manteve: 'Manteve o que já vinha construindo.',
    dificuldade: 'Encontrou dificuldade em alguns pontos, que vamos retomar com calma.',
    retomar: 'A atividade ficou para ser retomada no próximo encontro.',
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
            <strong>Sessão registrada</strong>
            <p>A família já recebeu a devolutiva.</p>
          </div>
        </div>
      `
      : ''

    const timeline = pending
      ? `
        <section class="demo-card">
          <h2>${execution.total === 1 ? '1 atividade' : `${execution.total} atividades`} de ${escapeHtml(nome)} aguardando registro</h2>
          <p>Transforme o que a criança fez numa devolutiva para a família.</p>
          <ul class="demo-timeline">
            <li><span aria-hidden="true">✓</span> ${escapeHtml(execution.titulo)} · ${escapeHtml(formatDemoQuando(execution.completedAt))}</li>
          </ul>
          <div class="demo-actions">
            <button class="demo-primary" type="button" data-register>Registrar sessão</button>
          </div>
        </section>
      `
      : `
        <section class="demo-card">
          <h2>Nenhuma atividade aguardando registro.</h2>
          <p>Quando ${escapeHtml(nome)} concluir uma atividade, ela aparece aqui.</p>
        </section>
      `

    const history = session.exists
      ? `
        <section class="demo-card">
          <span class="demo-label">Última sessão registrada</span>
          <article class="demo-session">
            <div class="demo-session__head">
              <strong>${escapeHtml(session.activityTitle)}</strong>
              <span>${escapeHtml(formatDemoQuando(session.createdAt))}</span>
            </div>
            <p>${escapeHtml(session.familySummary)}</p>
            ${session.nextStep ? `<p><strong>Próximo passo:</strong> ${escapeHtml(session.nextStep)}</p>` : ''}
            ${session.notes ? `<p class="demo-private"><span aria-hidden="true">🔒</span> Nota interna — só você vê: ${escapeHtml(session.notes)}</p>` : ''}
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
        <h2>Registrar sessão de ${escapeHtml(nome)}</h2>

        <div class="demo-fact">
          <span class="demo-fact__check" aria-hidden="true">✓</span>
          <div>
            <strong>${escapeHtml(execution.titulo)}${execution.total > 1 ? ` e mais ${execution.total - 1}` : ''}</strong>
            <span>Feita ${escapeHtml(formatDemoQuando(execution.completedAt))}</span>
          </div>
        </div>

        ${QUESTIONS.map(questionHtml).join('')}

        <div class="demo-field">
          <label class="demo-q" for="demo-notes">Alguma observação importante? (opcional)</label>
          <textarea class="demo-textarea" id="demo-notes" rows="3" placeholder="Dúvidas técnicas, pontos para revisar com a equipe…">${escapeHtml(s.observacao)}</textarea>
          <p class="demo-lock"><span aria-hidden="true">🔒</span> Nota interna — a família nunca vê o que você escrever aqui.</p>
        </div>

        <details class="demo-details" ${s.proximoPasso ? 'open' : ''}>
          <summary>Adicionar planejamento (opcional)</summary>
          <textarea class="demo-textarea" id="demo-next" rows="3" placeholder="O que trabalhar na próxima sessão?">${escapeHtml(s.proximoPasso)}</textarea>
          <p class="demo-hint">A família vê isso como "próximo passo".</p>
        </details>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-cancel>Voltar</button>
          <button class="demo-primary" type="button" data-continue ${canContinue() ? '' : 'disabled'}>Continuar</button>
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
        <h2>Devolutiva para a família</h2>
        <p class="demo-hint">Montamos este resumo a partir das suas respostas — revise e deixe com a sua voz.</p>

        <div class="demo-field">
          <label class="demo-q" for="demo-family-text">O que a família vai receber</label>
          <textarea class="demo-textarea demo-textarea--tall" id="demo-family-text" maxlength="800">${escapeHtml(s.familyText)}</textarea>
          <div class="demo-count" id="demo-count">${s.familyText.length} / 800 caracteres</div>
          <button class="demo-ghost" type="button" data-regen>↻ Gerar sugestão novamente</button>
        </div>

        <div class="demo-preview demo-preview--family">
          <span class="demo-label">Como a família verá</span>
          <strong>${escapeHtml(nome)}: resumo da sessão</strong>
          <p id="demo-family-preview">${escapeHtml(s.familyText)}</p>
          ${next ? `<p>Próximo passo: ${escapeHtml(next)}</p>` : ''}
        </div>

        <label class="demo-check">
          <input type="checkbox" id="demo-reviewed" ${s.reviewed ? 'checked' : ''} />
          <span>Revisei a mensagem que será compartilhada com a família.</span>
        </label>
        <p class="demo-hint">Use linguagem simples, respeitosa e baseada no que você observou.</p>

        <div class="demo-actions demo-actions--split">
          <button class="demo-secondary" type="button" data-back>Voltar</button>
          <button class="demo-primary" type="button" data-save>Salvar e compartilhar</button>
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
      panel.querySelector('#demo-count').textContent = `${textarea.value.length} / 800 caracteres`
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
