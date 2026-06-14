// Helpers de UI compartilhados pelas telas internas (sem libs).
// O Modo Foco usa a MESMA chave do app.js, então o estado é único
// entre os painéis que ainda usam app.js (admin) e os migrados (tutor,
// responsável).

const FOCUS_KEY = 'cognitahub-focus-mode'

export function setupFocusMode() {
  const apply = (on) => {
    document.body.classList.toggle('focus-mode', on)
    document.querySelectorAll('[data-focus-toggle]').forEach((button) => {
      button.setAttribute('aria-pressed', String(on))
      const label = button.querySelector('[data-focus-label]') || button
      label.textContent = on ? 'Modo Foco ativo' : 'Modo Foco'
    })
    localStorage.setItem(FOCUS_KEY, on ? '1' : '0')
  }

  apply(localStorage.getItem(FOCUS_KEY) === '1')

  document.querySelectorAll('[data-focus-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      apply(!document.body.classList.contains('focus-mode'))
    })
  })
}

export function greeting(name) {
  const first = (name ?? '').trim().split(/\s+/)[0] || ''
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  return first ? `${part}, ${first}` : part
}

export function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function ageFrom(birthDate) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
}

// createElement com classe e texto. textContent sempre (dado de usuário,
// nunca innerHTML interpolado).
export function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

// Normaliza valor para texto exibível (ou null se vazio).
export function asText(value) {
  if (value == null || value === '') return null
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  return String(value)
}

// Linha rótulo/valor para a lista de fatos hairline (.card-facts).
// Retorna null quando não há valor — quem monta a lista filtra os nulos.
export function fact(label, value) {
  const text = asText(value)
  if (!text) return null
  const row = el('div')
  row.append(el('dt', null, label), el('dd', null, text))
  return row
}

export function factList(facts) {
  const list = el('dl', 'card-facts')
  facts.forEach((row) => row && list.append(row))
  return list
}
