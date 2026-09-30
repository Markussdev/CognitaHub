// Tela Meu perfil (configurações do tutor) e upload da foto.
import { getAvatarUrl, setAvatarImage } from '../../lib/avatar.js'
import { supabase } from '../../lib/supabase.js'
import { initials, el } from '../../lib/ui.js'
import { REVIEW_STATUSES } from './estados.js'
import { simpleHead } from './helpers.js'
import { session } from './state.js'

const profileReturn = new URLSearchParams(location.search).get('return') || ''

// ── Avatar (Supabase Storage, bucket privado) ─────────────────────────────────

function getFileExt(file) {
  return file.name.split('.').pop()?.toLowerCase() || 'png'
}

function validateAvatarFile(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WEBP.')
  if (file.size > 2 * 1024 * 1024) throw new Error('A imagem precisa ter até 2MB.')
}

async function uploadTutorAvatar(file) {
  validateAvatarFile(file)
  const filePath = `${session.user.id}/avatar-${Date.now()}.${getFileExt(file)}`
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(filePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_path: filePath })
    .eq('id', session.user.id)
  if (profileError) throw profileError
  session.profile.avatar_path = filePath
  return filePath
}

// ── Tela Meu perfil (configurações do tutor) ──────────────────────────────────
// V1: só rascunho local. TODO(wiring:profiles): persistir nome/telefone/
// apresentação/formação/disponibilidade/preferências quando o schema existir.

function buildProfileField(labelText, { textarea = false, value = '', placeholder = '', type = 'text' } = {}) {
  const field = el('div', 'field')
  const label = document.createElement('label')
  label.textContent = labelText
  const input = textarea ? document.createElement('textarea') : document.createElement('input')
  if (!textarea) input.type = type
  input.value = value
  input.placeholder = placeholder
  field.append(label, input)
  return field
}

// Perfil deve vender identidade validada, não parecer formulário de cadastro:
// preview (como a família/equipe veem) à esquerda, edição dividida em
// público-pra-família vs. interno-da-equipe à direita.
export function buildProfileView() {
  const panel = el('section', 'profile-page')
  const name = session.profile.name || 'Tutor'
  const isPending = REVIEW_STATUSES.includes(session.profile.status)

  const head = el('div', 'profile-head')
  const headCopy = el('div')
  headCopy.append(el('p', 'kicker', 'Meu perfil'), el('h1', null, 'Identidade do tutor'))
  head.append(headCopy)
  if (profileReturn && !profileReturn.startsWith('//') && !/^https?:\/\//i.test(profileReturn)) {
    const backLink = el('a', 'btn btn-ghost btn-sm', 'Voltar para Biblioteca')
    backLink.href = profileReturn
    head.append(backLink)
  }
  panel.append(head)

  const grid = el('div', 'profile-grid')

  const preview = el('div', 'card profile-preview')

  // Linha de foto: avatar (squircle) + controles de troca
  const previewAvatar = el('div', 'profile-avatar')
  previewAvatar.setAttribute('data-profile-avatar', '')
  previewAvatar.textContent = initials(name)
  if (session.profile.avatar_path) {
    getAvatarUrl(session.profile.avatar_path).then((url) => {
      if (!url) return
      previewAvatar.textContent = ''
      const img = document.createElement('img'); img.src = url; img.alt = ''; previewAvatar.append(img)
    })
  }

  const photoCopy = el('p')
  const avatarInput = document.createElement('input')
  avatarInput.type = 'file'; avatarInput.accept = 'image/png,image/jpeg,image/webp'; avatarInput.hidden = true
  const avatarBtn = el('button', 'btn btn-ghost btn-sm', 'Alterar foto')
  avatarBtn.type = 'button'
  const avatarError = el('p', 'form-error'); avatarError.hidden = true; avatarError.style.marginTop = '6px'
  const photoInfo = el('div')
  photoInfo.append(el('strong', null, 'Foto de perfil'), photoCopy, avatarInput, avatarBtn, avatarError)
  const photoRow = el('div', 'profile-photo-row')
  photoRow.append(previewAvatar, photoInfo)
  preview.append(photoRow)

  const previewName = el('div', 'nm', name)
  preview.append(previewName, el('div', 'rl', 'Tutor voluntário · Cognita Hub'))

  const quote = el('div', 'quote')
  const quoteEyebrow = el('div', 'quote-eyebrow')
  quoteEyebrow.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
  quoteEyebrow.append(document.createTextNode('Prévia para a família'))
  const quoteText = el('span', 'quote-text', '')
  quote.append(quoteEyebrow, quoteText)
  preview.append(quote)

  const chips = el('div', 'profile-chips')
  const statusChip = el('span', 'meta-chip')
  statusChip.append(el('span', `dot ${isPending ? 'warn' : 'ok'}`), document.createTextNode(isPending ? 'Em análise pela equipe' : 'Validado pela equipe'))
  const visibleChip = el('span', 'meta-chip')
  visibleChip.append(el('span', 'dot info'), document.createTextNode('Visível após pareamento'))
  const privateChip = el('span', 'meta-chip', 'Contato privado')
  chips.append(statusChip, visibleChip, privateChip)
  preview.append(chips)
  grid.append(preview)

  const stack = el('div', 'stack')

  const publicCard = el('div', 'card')
  publicCard.append(simpleHead('Informações públicas para a família'))
  const publicBody = el('div', 'card-b')

  const nameField = buildProfileField('Nome exibido', { value: name })
  const nameInput = nameField.querySelector('input')
  publicBody.append(nameField)

  const guide = el('div', 'guide')
  guide.style.marginTop = '12px'
  guide.innerHTML = '<strong>A família verá essa apresentação apenas após o pareamento e validação da equipe Cognita.</strong> Não inclua telefone, redes sociais ou contato pessoal direto.'
  publicBody.append(guide)

  const presField = buildProfileField('Como a família verá você', {
    textarea: true,
    value: session.profile.tutor_presentation || '',
    placeholder: 'Olá, sou tutor voluntário no Cognita Hub. Meu foco é apoiar atividades de matemática inicial com calma, previsibilidade e respeito ao ritmo da criança.',
  })
  presField.style.marginTop = '12px'
  const presInput = presField.querySelector('textarea')
  publicBody.append(presField)

  const formField = buildProfileField('Formação / experiência resumida', {
    value: session.profile.tutor_formation || '',
    placeholder: 'Ex.: Pedagogia, 2 anos de experiência com alfabetização matemática.',
  })
  const formInput = formField.querySelector('input')
  formField.style.marginTop = '12px'
  publicBody.append(formField)

  publicCard.append(publicBody)
  stack.append(publicCard)

  const internalCard = el('div', 'card')
  internalCard.append(simpleHead('Informações internas da equipe'))
  const internalBody = el('div', 'card-b')
  const row = el('div', 'row')
  const phoneField = buildProfileField('Telefone de contato', {
    type: 'tel',
    value: session.profile.phone || '',
    placeholder: 'Só a equipe Cognita vê',
  })
  const phoneInput = phoneField.querySelector('input')
  const emailField = buildProfileField('E-mail de contato', {
    type: 'email',
    value: session.user.email ?? '',
  })
  const emailInput = emailField.querySelector('input')
  emailInput.disabled = true
  row.append(phoneField, emailField)
  internalBody.append(row)
  const availField = buildProfileField('Disponibilidade semanal', {
    value: session.profile.tutor_availability || '',
    placeholder: 'Ex.: Terças e quintas, à noite',
  })
  const availInput = availField.querySelector('input')
  availField.style.marginTop = '12px'
  internalBody.append(availField)
  const prefField = buildProfileField('Preferências de atuação', {
    textarea: true,
    value: session.profile.tutor_preferences || '',
    placeholder: 'Ex.: Prefiro crianças mais novas, com apoio visual forte.',
  })
  const prefInput = prefField.querySelector('textarea')
  prefField.style.marginTop = '12px'
  internalBody.append(prefField)
  internalCard.append(internalBody)
  stack.append(internalCard)

  const okBox = el('p', 'form-ok'); okBox.hidden = true
  const saveBtnBottom = el('button', 'btn btn-brand', 'Salvar alterações')
  saveBtnBottom.type = 'button'
  const actions = el('div', 'form-actions')
  actions.append(okBox, saveBtnBottom)
  stack.append(actions)

  grid.append(stack)
  panel.append(grid)

  const updateQuote = () => {
    const text = presInput.value.trim()
    quoteText.textContent = text ? `"${text}"` : 'Escreva como você se apresenta — a prévia aparece aqui.'
    quoteText.classList.toggle('filled', !!text)
  }
  presInput.addEventListener('input', updateQuote)
  updateQuote()

  nameInput.addEventListener('input', () => {
    const v = nameInput.value.trim() || name
    previewName.textContent = v
    if (!previewAvatar.querySelector('img')) previewAvatar.textContent = initials(v)
  })

  avatarBtn.addEventListener('click', () => avatarInput.click())
  avatarInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    avatarError.hidden = true
    try {
      avatarBtn.disabled = true; avatarBtn.textContent = 'Enviando…'
      const objectUrl = URL.createObjectURL(file)
      previewAvatar.textContent = ''
      const previewImg = document.createElement('img'); previewImg.src = objectUrl; previewImg.alt = ''; previewAvatar.append(previewImg)
      setAvatarImage('[data-account-avatar]', objectUrl)
      setAvatarImage('[data-topbar-avatar]', objectUrl)
      setAvatarImage('[data-profile-avatar]', objectUrl)
      // TODO(wiring:storage): requer bucket 'profile-photos' e coluna avatar_path em profiles.
      await uploadTutorAvatar(file)
      avatarBtn.textContent = 'Foto salva'
    } catch (err) {
      avatarError.textContent = err.message || 'Não foi possível enviar a foto.'
      avatarError.hidden = false
      avatarBtn.textContent = 'Alterar foto'
    } finally {
      avatarBtn.disabled = false
      avatarInput.value = ''
    }
  })

  const doSave = async () => {
    okBox.hidden = true
    const payload = {
      name: nameInput.value.trim() || name,
      phone: phoneInput.value.trim() || null,
      tutor_presentation: presInput.value.trim() || null,
      tutor_formation: formInput.value.trim() || null,
      tutor_availability: availInput.value.trim() || null,
      tutor_preferences: prefInput.value.trim() || null,
    }
    saveBtnBottom.disabled = true; saveBtnBottom.textContent = 'Salvando…'
    const { error } = await supabase.from('profiles').update(payload).eq('id', session.user.id)
    saveBtnBottom.disabled = false; saveBtnBottom.textContent = 'Salvar alterações'
    if (error) {
      okBox.textContent = 'Não conseguimos salvar agora. Tente novamente.'
      okBox.className = 'form-error'
      okBox.hidden = false
      console.error('Erro ao salvar perfil:', error)
      return
    }
    Object.assign(session.profile, payload)
    const nameEl = document.querySelector('[data-account-name]')
    if (nameEl) nameEl.textContent = payload.name
    previewName.textContent = payload.name
    if (!previewAvatar.querySelector('img')) previewAvatar.textContent = initials(payload.name)
    okBox.textContent = 'Perfil atualizado com sucesso.'
    okBox.className = 'form-ok'
    okBox.hidden = false
  }
  saveBtnBottom.addEventListener('click', doSave)

  return panel
}
