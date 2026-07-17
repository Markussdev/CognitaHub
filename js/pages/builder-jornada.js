import { requireRole } from '../lib/auth.js'
import { el } from '../lib/ui.js'
import { listChildActivities } from '../data/child-activities.js'
import { MOLDES_REGISTRO, formatConfigResumo } from '../data/moldes-registro.js'
import {
  createPrivateJourney, saveJourneyDraft, publishJourney,
  listMyPrivateJourneys, getPrivateJourneyStructure,
} from '../data/journey-builder.js'

// Builder de jornada privada do tutor (Fase 15). Duas telas: lista das
// jornadas privadas da criança e o editor (título → módulos → missões de
// atividades avulsas). Escrita só via RPC; snapshot é feito no servidor.

const root = document.getElementById('builder-root')
const params = new URLSearchParams(location.search)
const childId = params.get('child_id')
const cycleId = params.get('cycle_id')
const childName = params.get('child_name') || 'a criança'
const PLAN_HREF = 'tutor.html?view=record&tab=plan'

const session = await requireRole('tutor')
if (session) main()

let avulsas = [] // child_activities avulsas (child_trail_mission_id null)

async function main() {
  if (!childId) return renderError('Faltou identificar a criança — abra pelo painel.')
  const { data, error } = await listChildActivities(childId)
  if (error) return renderError('Não foi possível carregar as atividades preparadas.')
  avulsas = (data ?? []).filter((a) => !a.child_trail_mission_id && a.status !== 'archived')

  const templateId = params.get('template')
  if (templateId) return openEditor(templateId)
  renderList()
}

// ── Helpers de exibição de atividade ──────────────────────────────────────
function activityById(id) { return avulsas.find((a) => a.id === id) || null }

function activityLabel(ca) {
  if (!ca) return 'Atividade'
  const molde = MOLDES_REGISTRO[ca.molde]
  const temaLabel = molde?.temas.find((t) => t.id === ca.tema)?.label || ca.tema
  return ca.titulo || molde?.tituloPadrao?.(temaLabel) || `${molde?.label || ca.molde} · ${temaLabel}`
}

function activityMeta(ca) {
  if (!ca) return ''
  const molde = MOLDES_REGISTRO[ca.molde]
  const temaLabel = molde?.temas.find((t) => t.id === ca.tema)?.label || ca.tema
  const resumo = formatConfigResumo?.(ca.molde, ca.config) || ''
  return [molde?.label || ca.molde, temaLabel, resumo].filter(Boolean).join(' · ')
}

function topbar() {
  const bar = el('div', 'bj-topbar')
  const back = el('a', 'bj-back', '← Voltar ao painel')
  back.href = PLAN_HREF
  bar.append(back)
  return bar
}

function renderError(message) {
  root.replaceChildren(topbar(), el('div', 'bj-card', message))
}

// ── Tela: lista das jornadas da criança ───────────────────────────────────
async function renderList() {
  root.replaceChildren()
  root.append(topbar())

  const head = el('div')
  head.append(el('h1', 'bj-title', `Jornadas de ${childName}`))
  head.append(el('p', 'bj-sub', 'Percursos personalizados que você montou com as atividades preparadas.'))
  root.append(head)

  const novaBtn = el('button', 'btn btn-accent', '+ Nova jornada')
  novaBtn.type = 'button'
  novaBtn.style.marginTop = '16px'
  novaBtn.addEventListener('click', () => openEditor(null))
  root.append(novaBtn)

  const card = el('div', 'bj-card')
  card.append(el('h3', null, 'Suas jornadas'))
  root.append(card)

  const { data, error } = await listMyPrivateJourneys(childId)
  if (error) { card.append(el('p', 'bj-msg bj-msg--err', 'Não foi possível carregar suas jornadas.')); return }
  const jornadas = data ?? []
  if (!jornadas.length) {
    card.append(el('p', 'bj-empty', `Você ainda não criou nenhuma jornada para ${childName}. Comece por "Nova jornada".`))
    return
  }

  jornadas.forEach((j) => {
    const item = el('div', 'bj-list-item')
    const info = el('div')
    const line = el('div', 'bj-row')
    line.append(el('strong', null, j.title))
    line.append(el('span', `bj-badge bj-badge--${j.status === 'published' ? 'published' : 'draft'}`,
      j.status === 'published' ? 'Publicada' : 'Rascunho'))
    info.append(line)
    if (j.description) info.append(el('p', 'bj-hint', j.description))
    item.append(info)

    const btn = el('button', 'btn btn-ghost btn-sm', j.status === 'published' ? 'Ver' : 'Continuar editando')
    btn.type = 'button'
    btn.addEventListener('click', () => openEditor(j.id))
    item.append(btn)
    card.append(item)
  })
}

// ── Tela: editor ──────────────────────────────────────────────────────────
// state.modules: [{ title, objective, missions: [{ activityId }] }]
let state = null

async function openEditor(templateId) {
  if (!templateId) {
    state = { templateId: null, title: '', objective: '', status: 'draft', updatedAt: null, modules: [] }
    return renderEditor()
  }
  root.replaceChildren(topbar(), el('div', 'bj-card', 'Carregando jornada…'))
  const { data, error } = await getPrivateJourneyStructure(templateId)
  if (error || !data) return renderError('Não foi possível abrir esta jornada.')
  const modules = (data.trail_modules ?? [])
    .slice().sort((a, b) => a.position - b.position)
    .map((m) => ({
      title: m.title,
      objective: m.objective || '',
      missions: (m.mission_templates ?? [])
        .slice().sort((a, b) => a.position - b.position)
        .map((mt) => ({ activityId: mt.source_child_activity_id, snapshotTitle: mt.title })),
    }))
  state = { templateId: data.id, title: data.title, objective: data.description || '', status: data.status, updatedAt: data.updated_at, modules }
  renderEditor()
}

// Lê os inputs do DOM pra dentro do state antes de qualquer re-render
// (senão add/remover/reordenar perderia o que o tutor digitou).
function syncFromDOM() {
  const t = root.querySelector('[data-jfield="title"]'); if (t) state.title = t.value
  const o = root.querySelector('[data-jfield="objective"]'); if (o) state.objective = o.value
  state.modules.forEach((m, i) => {
    const mt = root.querySelector(`[data-mfield="title"][data-mod="${i}"]`); if (mt) m.title = mt.value
    const mo = root.querySelector(`[data-mfield="objective"][data-mod="${i}"]`); if (mo) m.objective = mo.value
  })
}

function mutate(fn) { syncFromDOM(); fn(); renderEditor() }

function move(arr, i, dir) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

function renderEditor() {
  const published = state.status === 'published'
  root.replaceChildren()
  root.append(topbar())

  const head = el('div')
  head.append(el('h1', 'bj-title', state.templateId ? 'Editar jornada' : 'Nova jornada'))
  head.append(el('p', 'bj-sub', published
    ? 'Esta jornada já foi publicada — para mudar, duplique numa nova versão (em breve).'
    : `Monte o percurso de ${childName} com as atividades que você já preparou.`))
  root.append(head)

  // Dados da jornada
  const infoCard = el('div', 'bj-card')
  infoCard.append(el('h3', null, 'A jornada'))
  infoCard.append(field('Título', 'title', state.title, published, 'Ex.: Revisão de números'))
  infoCard.append(field('Objetivo (opcional)', 'objective', state.objective, published, 'Ex.: reforço leve antes do próximo módulo', true))
  root.append(infoCard)

  // Módulos
  const modsCard = el('div', 'bj-card')
  const modsHead = el('div', 'bj-row')
  modsHead.style.justifyContent = 'space-between'
  modsHead.append(el('h3', null, 'Módulos'))
  if (!published) {
    const addMod = el('button', 'btn btn-ghost btn-sm', '+ Módulo')
    addMod.type = 'button'
    addMod.addEventListener('click', () => mutate(() => state.modules.push({ title: '', objective: '', missions: [] })))
    modsHead.append(addMod)
  }
  modsCard.append(modsHead)

  if (!state.modules.length) {
    modsCard.append(el('p', 'bj-empty', 'Nenhum módulo ainda. Adicione o primeiro módulo e depois as missões.'))
  }
  state.modules.forEach((mod, i) => modsCard.append(renderModule(mod, i, published)))
  root.append(modsCard)

  // Mensagens + ações
  const msg = el('div'); msg.id = 'bj-editor-msg'
  root.append(msg)

  if (!published) {
    const actions = el('div', 'bj-actions')
    const saveBtn = el('button', 'btn btn-primary', 'Salvar rascunho')
    saveBtn.type = 'button'
    saveBtn.addEventListener('click', () => onSave(saveBtn))
    const pubBtn = el('button', 'btn btn-accent', 'Publicar jornada')
    pubBtn.type = 'button'
    pubBtn.addEventListener('click', () => onPublish(pubBtn))
    actions.append(saveBtn, pubBtn)
    root.append(actions)
    root.append(el('p', 'bj-hint', 'Salvar guarda como rascunho (só você vê). Publicar congela a jornada para você atribuir à criança no painel.'))
  } else {
    const backToPlan = el('a', 'btn btn-accent', 'Ir ao painel para atribuir')
    backToPlan.href = PLAN_HREF
    const actions = el('div', 'bj-actions'); actions.append(backToPlan)
    root.append(actions)
  }
}

function field(labelText, key, value, disabled, placeholder, textarea = false) {
  const wrap = el('div', 'bj-field')
  wrap.append(el('label', null, labelText))
  const input = textarea ? document.createElement('textarea') : document.createElement('input')
  input.dataset.jfield = key
  input.value = value || ''
  input.placeholder = placeholder || ''
  input.disabled = disabled
  wrap.append(input)
  return wrap
}

function renderModule(mod, i, published) {
  const card = el('div', 'bj-module')
  const head = el('div', 'bj-module-head')
  head.append(el('span', 'bj-module-kicker', `Módulo ${i + 1}`))
  if (!published) {
    const tools = el('div', 'bj-module-tools')
    tools.append(iconBtn('↑', 'Subir', () => mutate(() => move(state.modules, i, -1))))
    tools.append(iconBtn('↓', 'Descer', () => mutate(() => move(state.modules, i, 1))))
    tools.append(iconBtn('✕', 'Remover módulo', () => mutate(() => state.modules.splice(i, 1)), 'btn-bad'))
    head.append(tools)
  }
  card.append(head)

  const tWrap = el('div', 'bj-field')
  const tin = document.createElement('input')
  tin.dataset.mfield = 'title'; tin.dataset.mod = String(i)
  tin.value = mod.title || ''; tin.placeholder = 'Título do módulo (ex.: Reconhecer)'; tin.disabled = published
  tWrap.append(tin); card.append(tWrap)

  // Missões
  mod.missions.forEach((mis, j) => card.append(renderMission(mod, i, mis, j, published)))
  if (!mod.missions.length) card.append(el('p', 'bj-empty', 'Sem missões neste módulo ainda.'))

  if (!published) {
    const addMis = el('button', 'btn btn-ghost btn-sm', '+ Adicionar missão')
    addMis.type = 'button'
    addMis.style.marginTop = '8px'
    addMis.addEventListener('click', () => togglePicker(card, i))
    card.append(addMis)
  }
  return card
}

function renderMission(mod, modIdx, mis, j, published) {
  const ca = activityById(mis.activityId)
  const row = el('div', 'bj-mission')
  row.append(el('span', 'bj-mission-pos', String(j + 1)))
  const body = el('div', 'bj-mission-body')
  body.append(el('div', 'bj-mission-title', ca ? activityLabel(ca) : (mis.snapshotTitle || 'Atividade')))
  const meta = ca ? activityMeta(ca) : 'Atividade não está mais disponível — remova e escolha outra'
  body.append(el('div', 'bj-mission-meta', meta))
  row.append(body)
  if (!published) {
    const tools = el('div', 'bj-mission-tools')
    tools.append(iconBtn('↑', 'Subir', () => mutate(() => move(mod.missions, j, -1))))
    tools.append(iconBtn('↓', 'Descer', () => mutate(() => move(mod.missions, j, 1))))
    tools.append(iconBtn('✕', 'Remover', () => mutate(() => mod.missions.splice(j, 1)), 'btn-bad'))
    row.append(tools)
  }
  return row
}

function iconBtn(glyph, title, onClick, extra = '') {
  const b = el('button', `btn btn-ghost btn-icon ${extra}`.trim(), glyph)
  b.type = 'button'; b.title = title; b.setAttribute('aria-label', title)
  b.addEventListener('click', onClick)
  return b
}

// Seletor de atividade avulsa — inline, abre/fecha no módulo.
function togglePicker(moduleCard, modIdx) {
  const existing = moduleCard.querySelector('.bj-picker')
  if (existing) { existing.remove(); return }
  const picker = el('div', 'bj-picker')
  if (!avulsas.length) {
    picker.append(el('p', 'bj-empty', 'Nenhuma atividade avulsa preparada. Crie atividades na aba Atividades primeiro.'))
    moduleCard.append(picker)
    return
  }
  picker.append(el('p', 'bj-hint', 'Escolha uma atividade preparada para virar missão:'))
  avulsas.forEach((ca) => {
    const opt = el('div', 'bj-picker-item')
    const info = el('div')
    info.append(el('div', 'bj-mission-title', activityLabel(ca)))
    info.append(el('div', 'bj-mission-meta', activityMeta(ca)))
    opt.append(info)
    opt.append(el('span', 'btn btn-ghost btn-sm', 'Adicionar'))
    opt.addEventListener('click', () => mutate(() => state.modules[modIdx].missions.push({ activityId: ca.id })))
    picker.append(opt)
  })
  moduleCard.append(picker)
}

function setMsg(text, kind) {
  const box = document.getElementById('bj-editor-msg')
  if (!box) return
  box.replaceChildren(text ? el('p', `bj-msg bj-msg--${kind}`, text) : document.createDocumentFragment())
}

// Valida o state e devolve o payload de módulos, ou null (com msg de erro).
function buildPayload() {
  syncFromDOM()
  if (!state.title.trim()) { setMsg('Dê um título para a jornada.', 'err'); return null }
  if (!state.modules.length) { setMsg('Adicione pelo menos 1 módulo.', 'err'); return null }
  for (const [i, m] of state.modules.entries()) {
    if (!m.title.trim()) { setMsg(`O módulo ${i + 1} precisa de um título.`, 'err'); return null }
    if (!m.missions.length) { setMsg(`O módulo ${i + 1} precisa de pelo menos 1 missão.`, 'err'); return null }
  }
  return state.modules.map((m) => ({
    title: m.title.trim(),
    objective: m.objective?.trim() || null,
    missions: m.missions.map((mi) => ({ source_child_activity_id: mi.activityId })),
  }))
}

async function onSave(btn) {
  const modules = buildPayload()
  if (!modules) return
  btn.disabled = true; btn.textContent = 'Salvando…'
  try {
    // Cria o template na primeira gravação (title já validado).
    if (!state.templateId) {
      const { data: id, error } = await createPrivateJourney({ title: state.title.trim(), objective: state.objective.trim(), childId })
      if (error) { setMsg('Não foi possível criar a jornada agora.', 'err'); return }
      state.templateId = id
      const { data: struct } = await getPrivateJourneyStructure(id)
      state.updatedAt = struct?.updated_at ?? null
    }
    const { data: newUpdated, error } = await saveJourneyDraft({ templateId: state.templateId, title: state.title.trim(), objective: state.objective.trim(), modules, expectedUpdatedAt: state.updatedAt })
    if (error) {
      setMsg(error.message || 'Não foi possível salvar agora.', 'err')
      return
    }
    state.updatedAt = newUpdated
    setMsg('Rascunho salvo.', 'ok')
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar rascunho'
  }
}

async function onPublish(btn) {
  const modules = buildPayload()
  if (!modules) return
  btn.disabled = true; btn.textContent = 'Publicando…'
  try {
    // Garante que o rascunho está salvo antes de publicar.
    if (!state.templateId) {
      const { data: id, error } = await createPrivateJourney({ title: state.title.trim(), objective: state.objective.trim(), childId })
      if (error) { setMsg('Não foi possível criar a jornada agora.', 'err'); return }
      state.templateId = id
      const { data: struct } = await getPrivateJourneyStructure(id)
      state.updatedAt = struct?.updated_at ?? null
    }
    const { data: newUpdated, error: saveErr } = await saveJourneyDraft({ templateId: state.templateId, title: state.title.trim(), objective: state.objective.trim(), modules, expectedUpdatedAt: state.updatedAt })
    if (saveErr) { setMsg(saveErr.message || 'Não foi possível salvar antes de publicar.', 'err'); return }
    state.updatedAt = newUpdated

    const { error: pubErr } = await publishJourney(state.templateId)
    if (pubErr) { setMsg(pubErr.message || 'Não foi possível publicar agora.', 'err'); return }
    state.status = 'published'
    renderEditor()
    setMsg('Jornada publicada! Vá ao painel (aba Jornada) para atribuí-la à criança.', 'ok')
  } finally {
    btn.disabled = false; btn.textContent = 'Publicar jornada'
  }
}
