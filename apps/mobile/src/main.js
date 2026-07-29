import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import './styles/trail.css'
import './styles/modules.css'
import './styles/settings.css'
import { applySettings, getSettings } from './services/settings.js'
import { initApp } from './app.js'

// Antes de qualquer tela renderizar — senão a primeira pintura ainda sai
// com animação/texto normal e só corrige depois, um flash visível.
applySettings(getSettings())
initApp(document.querySelector('#app'))
