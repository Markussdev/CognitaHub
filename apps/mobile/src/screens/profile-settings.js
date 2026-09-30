import { escapeHtml } from '../utils/html.js'
import { statusMessageHtml } from '../components/status-message.js'
import { CHILD_AVATARS, getChildAvatar } from '../config/child-avatars.js'
import { saveChildPersonalization } from '../services/personalization.js'

const MAX_NAME_LENGTH = 24

function isValidName(name) {
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= MAX_NAME_LENGTH
}

// Tela "Meu perfil": nome + gato, com prévia ao vivo. onSaved só dispara
// depois do toque em "Continuar" na tela de sucesso — nada de fechar
// sozinho sem a criança confirmar que viu o feedback.
export function renderProfileSettings(root, { childId, currentName, currentAvatarKey, onBack, onSaved }) {
  let name = currentName ?? ''
  let avatarKey = getChildAvatar(currentAvatarKey).key
  let status = 'idle' // idle | saving | error

  function renderSavedScreen(finalName, finalAvatarKey) {
    const avatar = getChildAvatar(finalAvatarKey)
    root.innerHTML = `
      <div class="screen screen--settings screen--profile-saved">
        <div class="profile-saved">
          <img class="profile-saved__avatar" src="${avatar.image}" alt="" />
          <h1 class="title">Profile updated!</h1>
          <p class="subtitle">Hi, ${escapeHtml(finalName)}!</p>
          <button class="btn-primary" type="button" data-profile-continue>Continue</button>
        </div>
      </div>
    `
    root.querySelector('[data-profile-continue]')?.addEventListener('click', () => {
      onSaved?.({ name: finalName, avatarKey: finalAvatarKey })
    })
  }

  function renderForm() {
    const trimmed = name.trim()
    const valid = isValidName(name)
    const saveDisabled = !valid || status === 'saving'
    const currentAvatar = getChildAvatar(avatarKey)

    const avatarsHtml = CHILD_AVATARS.map(
      (a) => `
        <button
          class="profile-avatar-option${a.key === avatarKey ? ' is-selected' : ''}"
          type="button"
          data-avatar-key="${a.key}"
          aria-pressed="${a.key === avatarKey}"
        >
          <img src="${a.image}" alt="" />
          <span>${escapeHtml(a.label)}</span>
        </button>
      `,
    ).join('')

    const errorHtml =
      status === 'error' ? statusMessageHtml({ type: 'error', text: "Couldn't save. Please try again." }) : ''

    root.innerHTML = `
      <div class="screen screen--settings screen--profile">
        <header class="settings-header">
          <button class="settings-header__back" type="button" aria-label="Back">‹</button>
          <h1 class="title">My profile</h1>
        </header>

        <div class="profile-preview">
          <img class="profile-preview__avatar" src="${currentAvatar.image}" alt="" data-preview-avatar />
          <p class="profile-preview__greeting" data-preview-greeting>Hi, ${escapeHtml(trimmed || '...')}!</p>
        </div>

        <label class="profile-field">
          <span class="profile-field__label">What should we call you?</span>
          <input
            class="profile-field__input"
            type="text"
            maxlength="${MAX_NAME_LENGTH}"
            value="${escapeHtml(name)}"
            placeholder="Your name"
            data-name-input
          />
          <span class="profile-field__hint">Up to ${MAX_NAME_LENGTH} characters</span>
        </label>

        <div class="profile-avatars">
          <span class="profile-field__label">Choose your avatar</span>
          <div class="profile-avatars__grid">
            ${avatarsHtml}
          </div>
        </div>

        ${errorHtml}

        <button class="btn-primary" type="button" data-save-btn ${saveDisabled ? 'disabled' : ''}>
          ${status === 'saving' ? 'Saving…' : 'Save my profile'}
        </button>
      </div>
    `

    root.querySelector('.settings-header__back')?.addEventListener('click', () => onBack?.())

    const input = root.querySelector('[data-name-input]')
    const preview = root.querySelector('[data-preview-greeting]')
    const saveBtn = root.querySelector('[data-save-btn]')

    // Atualiza a prévia diretamente no DOM em vez de re-renderizar a tela
    // inteira a cada tecla — um innerHTML novo aqui perderia o cursor/foco
    // do input no meio da digitação.
    input?.addEventListener('input', () => {
      name = input.value
      const t = name.trim()
      preview.textContent = `Hi, ${t || '...'}!`
      saveBtn.disabled = !isValidName(name) || status === 'saving'
    })

    root.querySelectorAll('[data-avatar-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        avatarKey = btn.dataset.avatarKey
        renderForm()
      })
    })

    saveBtn?.addEventListener('click', handleSave)
  }

  async function handleSave() {
    if (!isValidName(name) || status === 'saving') return

    status = 'saving'
    renderForm()

    const trimmedName = name.trim()

    try {
      const result = await saveChildPersonalization({ childId, preferredName: trimmedName, avatarKey })
      renderSavedScreen(result?.nome_exibicao ?? trimmedName, result?.avatar_key ?? avatarKey)
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
      status = 'error'
      renderForm()
    }
  }

  renderForm()
}
