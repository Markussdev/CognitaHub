import { getActivityGuide, hasActivityGuide } from '../data/activity-guides.js'

const DEFAULT_REVIEW = {
  author: 'Equipe Cognita',
  sources: [],
  specialist: null,
  reviewedAt: null,
}

let guideState = null
let previousFocus = null

const h = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

const isPresent = (value) => {
  if (Array.isArray(value)) return value.length > 0
  return value != null && String(value).trim() !== ''
}

const topic = (id, label, type, data) => ({ id, label, type, data })

export function createGuideModel(activity) {
  const extra = getActivityGuide(activity.slug) || {}
  const sections = [
    {
      id: 'understand',
      label: 'Entender',
      topics: [
        (isPresent(activity.objetivo) || isPresent(activity.skillLabel))
          ? topic('objective', 'Objetivo e habilidade', 'objective', {
            objective: activity.objetivo,
            skillLabel: activity.skillLabel,
            learningObjectives: extra.learningObjectives || [],
          })
          : null,
        extra.caseStudy ? topic('case', 'Caso prático', 'case', extra.caseStudy) : null,
        extra.checkpoint ? topic('checkpoint', 'Checagem rápida', 'quiz', extra.checkpoint) : null,
      ].filter(Boolean),
    },
    {
      id: 'prepare',
      label: 'Preparar',
      topics: [
        isPresent(activity.antesDeComecar)
          ? topic('before', 'Antes de começar', 'text', activity.antesDeComecar)
          : null,
        (isPresent(activity.dizer) || isPresent(activity.evitar))
          ? topic('guidance', 'Orientações', 'sayAvoid', {
            say: activity.dizer || [],
            avoid: activity.evitar || [],
          })
          : null,
      ].filter(Boolean),
    },
    {
      id: 'apply',
      label: 'Aplicar',
      topics: [
        isPresent(activity.passosAtividade)
          ? topic('steps', 'Passo a passo', 'steps', activity.passosAtividade)
          : null,
        (isPresent(activity.seDificil) || isPresent(activity.seFacil))
          ? topic('adapt', 'Adaptar', 'adapt', {
            hard: activity.seDificil,
            easy: activity.seFacil,
          })
          : null,
      ].filter(Boolean),
    },
    {
      id: 'follow',
      label: 'Acompanhar',
      topics: [
        (isPresent(activity.sinalSucesso) || isPresent(activity.obsTEA))
          ? topic('success', 'O que observar', 'success', {
            signal: activity.sinalSucesso,
            teaNote: activity.obsTEA,
          })
          : null,
        topic('review', 'Fontes e revisão', 'review', {
          ...DEFAULT_REVIEW,
          ...(extra.review || {}),
        }),
      ].filter(Boolean),
    },
  ].filter((section) => section.topics.length)

  return sections
}

export function canOpenActivityGuide(activity) {
  return Boolean(activity?.slug && hasActivityGuide(activity.slug))
}

function getHost() {
  return document.querySelector('#activity-guide')
}

function getFlatTopics() {
  return guideState.sections.flatMap((section) => (
    section.topics.map((item) => ({ ...item, sectionId: section.id, sectionLabel: section.label }))
  ))
}

function getCurrentTopic() {
  return getFlatTopics()[guideState.currentTopic]
}

function makeIconButton(label, path) {
  const button = h('button', 'ag-icon-button')
  button.type = 'button'
  button.setAttribute('aria-label', label)
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`
  return button
}

function renderHeader(host) {
  const header = h('header', 'ag-header')
  const menu = makeIconButton('Abrir tópicos do guia', '<path d="M4 6h16M4 12h16M4 18h16"/>')
  menu.classList.add('ag-menu-button')
  menu.setAttribute('aria-controls', 'activity-guide-sidebar')
  menu.setAttribute('aria-expanded', String(guideState.menuOpen))
  menu.addEventListener('click', () => {
    guideState.menuOpen = !guideState.menuOpen
    renderGuide()
  })

  const identity = h('div', 'ag-identity')
  identity.append(h('span', 'ag-activity-icon', guideState.options.icon || '🦕'))
  const titleWrap = h('div', 'ag-title-wrap')
  const title = h('h1', null, guideState.activity.title)
  title.id = 'activity-guide-title'
  titleWrap.append(title, h('p', null, 'Guia da atividade'))
  identity.append(titleWrap)

  const progress = progressValue()
  const mobileProgress = h('div', 'ag-mobile-progress')
  const mobileBar = h('span')
  mobileBar.style.width = `${progress}%`
  mobileProgress.append(mobileBar)

  const progressText = h('span', 'ag-header-progress', `${progress}%`)
  const close = makeIconButton('Fechar guia', '<path d="M18 6L6 18M6 6l12 12"/>')
  close.addEventListener('click', closeActivityGuide)

  header.append(menu, identity, mobileProgress, progressText, close)
  host.append(header)
}

function progressValue() {
  const total = getFlatTopics().length
  return total ? Math.round((guideState.completed.size / total) * 100) : 0
}

function closeMobileMenu() {
  if (!guideState?.menuOpen) return
  guideState.menuOpen = false
  renderGuide()
}

function goToTopic(index, { completeCurrent = true } = {}) {
  const topics = getFlatTopics()
  if (index < 0 || index >= topics.length) return
  if (completeCurrent) guideState.completed.add(topics[guideState.currentTopic].id)
  guideState.currentTopic = index
  guideState.menuOpen = false
  renderGuide()
  document.querySelector('.ag-content')?.focus()
}

function renderSidebar(main) {
  const backdrop = h('button', 'ag-sidebar-backdrop')
  backdrop.type = 'button'
  backdrop.setAttribute('aria-label', 'Fechar tópicos do guia')
  backdrop.addEventListener('click', closeMobileMenu)
  main.append(backdrop)

  const sidebar = h('aside', 'ag-sidebar thin-scroll')
  sidebar.id = 'activity-guide-sidebar'
  sidebar.setAttribute('aria-label', 'Tópicos do guia')

  const sidebarTop = h('div', 'ag-sidebar-top')
  const sidebarTitle = h('div')
  sidebarTitle.append(h('strong', null, 'Guia da atividade'), h('span', null, `${progressValue()}% concluído`))
  const menuClose = makeIconButton('Fechar tópicos', '<path d="M18 6L6 18M6 6l12 12"/>')
  menuClose.classList.add('ag-sidebar-close')
  menuClose.addEventListener('click', closeMobileMenu)
  sidebarTop.append(sidebarTitle, menuClose)
  sidebar.append(sidebarTop)

  const progress = h('div', 'ag-progress')
  progress.setAttribute('role', 'progressbar')
  progress.setAttribute('aria-valuemin', '0')
  progress.setAttribute('aria-valuemax', '100')
  progress.setAttribute('aria-valuenow', String(progressValue()))
  const bar = h('span')
  bar.style.width = `${progressValue()}%`
  progress.append(bar)
  sidebar.append(progress)

  const flat = getFlatTopics()
  guideState.sections.forEach((section) => {
    const group = h('div', 'ag-nav-group')
    group.append(h('h2', null, section.label))
    section.topics.forEach((item) => {
      const index = flat.findIndex((flatItem) => flatItem.id === item.id)
      const current = index === guideState.currentTopic
      const completed = guideState.completed.has(item.id)
      const button = h('button', `ag-topic-link${current ? ' is-current' : ''}${completed ? ' is-complete' : ''}`)
      button.type = 'button'
      if (current) button.setAttribute('aria-current', 'step')
      const marker = h('span', 'ag-topic-marker', completed ? '✓' : '')
      marker.setAttribute('aria-hidden', 'true')
      button.append(marker, h('span', null, item.label))
      button.addEventListener('click', () => goToTopic(index))
      group.append(button)
    })
    sidebar.append(group)
  })

  main.classList.toggle('is-menu-open', guideState.menuOpen)
  main.append(sidebar)
}

function renderPageIntro(topicItem, container) {
  container.append(h('p', 'ag-eyebrow', topicItem.sectionLabel))
  container.append(h('h2', 'ag-page-title', topicItem.label))
}

function renderObjective(data) {
  const wrap = h('div', 'ag-stack')
  if (isPresent(data.skillLabel)) {
    const skill = h('div', 'ag-skill-card')
    skill.append(h('span', null, 'Habilidade trabalhada'), h('strong', null, data.skillLabel))
    wrap.append(skill)
  }
  if (isPresent(data.objective)) wrap.append(h('p', 'ag-lead', data.objective))
  if (isPresent(data.learningObjectives)) {
    const block = h('div', 'ag-soft-card')
    block.append(h('h3', null, 'Ao final deste guia, você vai conseguir:'))
    const list = h('ul', 'ag-check-list')
    data.learningObjectives.forEach((item) => {
      const li = h('li')
      li.append(h('span', null, '✓'), document.createTextNode(item))
      list.append(li)
    })
    block.append(list)
    wrap.append(block)
  }
  return wrap
}

function renderText(data) {
  const wrap = h('div', 'ag-stack')
  wrap.append(h('p', 'ag-lead', data))
  return wrap
}

function renderCaseStudy(data) {
  const wrap = h('div', 'ag-stack')
  const meta = h('div', 'ag-case-meta')
  if (data.learner) meta.append(h('span', null, data.learner))
  if (data.disclaimer) meta.append(h('span', 'ag-disclaimer', data.disclaimer))
  const card = h('article', 'ag-case-card')
  card.append(meta, h('h3', null, data.title || 'Um exemplo'), h('p', null, data.text || ''))
  wrap.append(card)
  return wrap
}

function renderSayAvoid(data) {
  const grid = h('div', 'ag-guidance-grid')
  if (isPresent(data.say)) {
    const say = h('section', 'ag-guidance-card is-say')
    say.append(h('span', 'ag-card-label', 'O que dizer'))
    data.say.forEach((item) => say.append(h('p', null, `“${item}”`)))
    grid.append(say)
  }
  if (isPresent(data.avoid)) {
    const avoid = h('section', 'ag-guidance-card is-avoid')
    avoid.append(h('span', 'ag-card-label', 'O que evitar'))
    const list = h('ul')
    data.avoid.forEach((item) => list.append(h('li', null, item)))
    avoid.append(list)
    grid.append(avoid)
  }
  return grid
}

function renderSteps(data) {
  const list = h('ol', 'ag-step-list')
  data.forEach((item, index) => {
    const li = h('li')
    li.append(h('span', null, String(index + 1)), h('p', null, item))
    list.append(li)
  })
  return list
}

function renderAdapt(data) {
  const grid = h('div', 'ag-adapt-grid')
  if (isPresent(data.hard)) {
    const hard = h('section', 'ag-adapt-card is-hard')
    hard.append(h('span', 'ag-card-label', 'Se estiver difícil'), h('p', null, data.hard))
    grid.append(hard)
  }
  if (isPresent(data.easy)) {
    const easy = h('section', 'ag-adapt-card is-easy')
    easy.append(h('span', 'ag-card-label', 'Se estiver fácil'), h('p', null, data.easy))
    grid.append(easy)
  }
  return grid
}

function renderSuccess(data) {
  const wrap = h('div', 'ag-stack')
  if (isPresent(data.signal)) {
    const signal = h('div', 'ag-success-card')
    signal.append(h('span', null, '✓'), h('div'))
    signal.lastElementChild.append(h('strong', null, 'Sinal de sucesso'), h('p', null, data.signal))
    wrap.append(signal)
  }
  if (isPresent(data.teaNote)) {
    const note = h('div', 'ag-note-card')
    note.append(h('strong', null, 'Nota de acessibilidade'), h('p', null, data.teaNote))
    wrap.append(note)
  }
  return wrap
}

function renderQuiz(data, topicItem) {
  const wrap = h('div', 'ag-stack')
  wrap.append(h('p', 'ag-lead', data.question))
  const form = h('form', 'ag-quiz')
  const saved = guideState.answers[topicItem.id]

  data.options.forEach((option, index) => {
    const label = h('label', `ag-quiz-option${saved?.selected === index ? ' is-selected' : ''}`)
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = `guide-${topicItem.id}`
    input.value = String(index)
    input.checked = saved?.selected === index
    input.addEventListener('change', () => {
      guideState.answers[topicItem.id] = { selected: index, checked: false }
      form.querySelectorAll('.ag-quiz-option').forEach((optionNode, optionIndex) => {
        optionNode.classList.toggle('is-selected', optionIndex === index)
      })
      submit.disabled = false
      submit.textContent = 'Responder'
    })
    label.append(input, h('span', 'ag-radio-mark'), document.createTextNode(option))
    form.append(label)
  })

  const submit = h('button', 'ag-secondary-button', saved?.checked ? 'Respondido' : 'Responder')
  submit.type = 'submit'
  submit.disabled = saved?.selected == null || saved?.checked
  form.append(submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const answer = guideState.answers[topicItem.id]
    if (!answer || answer.selected == null) return
    answer.checked = true
    answer.correct = answer.selected === data.correctIndex
    guideState.completed.add(topicItem.id)
    renderGuide()
    document.querySelector('.ag-quiz-feedback')?.focus()
  })
  wrap.append(form)

  if (saved?.checked) {
    const feedback = h('div', `ag-quiz-feedback ${saved.correct ? 'is-correct' : 'is-retry'}`)
    feedback.tabIndex = -1
    feedback.append(
      h('strong', null, saved.correct ? 'Isso mesmo.' : 'Vale revisar essa escolha.'),
      h('p', null, saved.correct
        ? (data.feedback || 'Você identificou a adaptação prevista pelo guia.')
        : `A alternativa prevista pelo guia é: ${data.options[data.correctIndex]}`),
    )
    wrap.append(feedback)
  }
  return wrap
}

function renderReview(data) {
  const wrap = h('div', 'ag-stack')
  const review = h('dl', 'ag-review-card')

  const row = (label, value, className = '') => {
    const item = h('div', className)
    item.append(h('dt', null, label), h('dd', null, value))
    review.append(item)
  }
  row('Conteúdo elaborado por', data.author || 'Equipe Cognita')
  row('Fontes pedagógicas', isPresent(data.sources) ? data.sources.join(' · ') : 'Ainda não cadastradas', !isPresent(data.sources) ? 'is-pending' : '')
  row('Revisão por especialista', data.specialist || 'Pendente', !data.specialist ? 'is-pending' : '')
  if (data.reviewedAt) row('Última revisão', data.reviewedAt)
  wrap.append(review)

  const ready = h('section', 'ag-ready-card')
  ready.append(h('span', 'ag-ready-icon', '✓'))
  const copy = h('div')
  copy.append(
    h('h3', null, 'Pronto para aplicar?'),
    h('p', null, 'Você revisou como preparar, conduzir, adaptar e acompanhar esta atividade.'),
  )
  const start = h('button', 'ag-primary-button', guideState.options.startLabel || `Aplicar ${guideState.activity.title}`)
  start.type = 'button'
  start.disabled = Boolean(guideState.options.startDisabled)
  if (guideState.options.startDisabledReason) start.title = guideState.options.startDisabledReason
  start.addEventListener('click', () => {
    const { activity, options } = guideState
    closeActivityGuide({ restoreFocus: false })
    options.onStart?.(activity)
  })
  ready.append(copy, start)
  wrap.append(ready)
  return wrap
}

const RENDERERS = {
  objective: renderObjective,
  text: renderText,
  case: renderCaseStudy,
  sayAvoid: renderSayAvoid,
  steps: renderSteps,
  adapt: renderAdapt,
  success: renderSuccess,
  quiz: renderQuiz,
  review: renderReview,
}

function renderContent(main) {
  const topicItem = getCurrentTopic()
  const content = h('main', 'ag-content thin-scroll')
  content.tabIndex = -1
  const inner = h('article', 'ag-content-inner')
  renderPageIntro(topicItem, inner)
  const renderer = RENDERERS[topicItem.type]
  inner.append(renderer ? renderer(topicItem.data, topicItem) : h('p', 'ag-lead', 'Conteúdo em preparação.'))
  content.append(inner)
  main.append(content)
}

function renderFooter(host) {
  const topics = getFlatTopics()
  const atFirst = guideState.currentTopic === 0
  const atLast = guideState.currentTopic === topics.length - 1
  const guideComplete = guideState.completed.size === topics.length
  const footer = h('footer', 'ag-footer')

  const counter = h('span', 'ag-counter', `${guideState.currentTopic + 1} de ${topics.length}`)
  const actions = h('div', 'ag-footer-actions')
  const previous = h('button', 'ag-nav-button', '← Anterior')
  previous.type = 'button'
  previous.disabled = atFirst
  previous.addEventListener('click', () => goToTopic(guideState.currentTopic - 1, { completeCurrent: false }))
  const next = h('button', 'ag-primary-button', atLast ? (guideComplete ? 'Concluído ✓' : 'Concluir guia') : 'Próximo →')
  next.type = 'button'
  next.disabled = atLast && guideComplete
  next.addEventListener('click', () => {
    guideState.completed.add(getCurrentTopic().id)
    if (atLast) {
      renderGuide()
      return
    }
    goToTopic(guideState.currentTopic + 1, { completeCurrent: false })
  })
  actions.append(previous, next)
  footer.append(counter, actions)
  host.append(footer)
}

function renderGuide() {
  const host = getHost()
  if (!host || !guideState) return
  host.replaceChildren()
  renderHeader(host)
  const main = h('div', 'ag-main')
  renderSidebar(main)
  renderContent(main)
  host.append(main)
  renderFooter(host)
}

export function openActivityGuide(activity, options = {}) {
  const host = getHost()
  if (!host || !activity) return false
  const sections = createGuideModel(activity)
  if (!sections.length) return false

  previousFocus = document.activeElement
  guideState = {
    activity,
    sections,
    currentTopic: 0,
    completed: new Set(),
    answers: {},
    menuOpen: false,
    options,
  }
  host.hidden = false
  host.setAttribute('aria-hidden', 'false')
  document.body.classList.add('activity-guide-open')
  renderGuide()
  host.focus()
  return true
}

export function closeActivityGuide({ restoreFocus = true } = {}) {
  const host = getHost()
  if (!host || host.hidden) return
  host.hidden = true
  host.setAttribute('aria-hidden', 'true')
  host.replaceChildren()
  document.body.classList.remove('activity-guide-open')
  guideState = null
  if (restoreFocus && previousFocus instanceof HTMLElement) previousFocus.focus()
  previousFocus = null
}

export function isActivityGuideOpen() {
  return Boolean(guideState && !getHost()?.hidden)
}

document.addEventListener('keydown', (event) => {
  if (!isActivityGuideOpen()) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (guideState.menuOpen) closeMobileMenu()
    else closeActivityGuide()
    return
  }
  if (event.key !== 'Tab') return
  const host = getHost()
  const focusable = [...host.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === host)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
})
