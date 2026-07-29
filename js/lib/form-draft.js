// Rascunho de formulário de cadastro (tutor/responsável): guarda o que a
// pessoa já digitou pra sobreviver a fechar a aba ou atualizar a página no
// meio do preenchimento. Nunca guarda senha — só campos de texto/data/
// select, radios, checkboxes e chips (aria-pressed). localStorage (não
// sessionStorage) porque "fechar a aba" precisa sobreviver, não só "F5".

function serializeForm(formEl) {
  const data = { fields: {}, radios: {}, checkboxes: {}, chips: {} }

  formEl.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.type === 'password') return

    if (el.type === 'radio') {
      if (el.checked && el.name) data.radios[el.name] = el.value
      return
    }

    if (el.type === 'checkbox') {
      const key = el.id || el.name || el.dataset.naosabe || el.dataset.naosabeField
      if (key) data.checkboxes[key] = el.checked
      return
    }

    if (el.id) data.fields[el.id] = el.value
  })

  formEl.querySelectorAll('.chip-group[id]').forEach((group) => {
    const pressed = Array.from(group.querySelectorAll('.chip'))
      .map((chip, i) => (chip.getAttribute('aria-pressed') === 'true' ? i : -1))
      .filter((i) => i >= 0)
    data.chips[group.id] = pressed
  })

  return data
}

function fireEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function applyDraft(formEl, draft) {
  if (!draft) return

  Object.entries(draft.fields || {}).forEach(([id, value]) => {
    const el = formEl.querySelector('#' + CSS.escape(id))
    if (el && el.type !== 'password') {
      el.value = value
      fireEvents(el)
    }
  })

  Object.entries(draft.radios || {}).forEach(([name, value]) => {
    const el = formEl.querySelector(
      `input[type="radio"][name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
    )
    if (el) {
      el.checked = true
      fireEvents(el)
    }
  })

  Object.entries(draft.checkboxes || {}).forEach(([key, checked]) => {
    const el =
      formEl.querySelector('#' + CSS.escape(key)) ||
      formEl.querySelector(`[data-naosabe="${CSS.escape(key)}"]`) ||
      formEl.querySelector(`[data-naosabe-field="${CSS.escape(key)}"]`) ||
      formEl.querySelector(`[name="${CSS.escape(key)}"]`)
    if (el) {
      el.checked = checked
      fireEvents(el)
    }
  })

  Object.entries(draft.chips || {}).forEach(([groupId, indexes]) => {
    const group = formEl.querySelector('#' + CSS.escape(groupId))
    if (!group) return
    const chips = group.querySelectorAll('.chip')
    indexes.forEach((i) => chips[i]?.setAttribute('aria-pressed', 'true'))
  })
}

function loadDraft(key) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function saveDraft(key, formEl, extra) {
  const data = { ...serializeForm(formEl), ...extra }
  localStorage.setItem(key, JSON.stringify(data))
}

function clearDraft(key) {
  localStorage.removeItem(key)
}

// getExtra() roda a cada save pra incluir estado que não vive no DOM (ex.:
// a etapa atual do wizard). Debounce curto: input contínuo não deve gravar
// a cada tecla, mas fechar a aba logo depois de digitar não pode perder o
// último caractere.
function wireDraftAutosave(key, formEl, getExtra) {
  let timer = null
  const save = () => saveDraft(key, formEl, getExtra ? getExtra() : {})
  const debouncedSave = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 250)
  }

  formEl.addEventListener('input', debouncedSave)
  formEl.addEventListener('change', debouncedSave)
  formEl.addEventListener('click', debouncedSave)
  window.addEventListener('pagehide', save)
}

export { loadDraft, saveDraft, applyDraft, clearDraft, wireDraftAutosave }
