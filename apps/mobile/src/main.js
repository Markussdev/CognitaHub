import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import './styles/trail.css'
import './styles/modules.css'
import './styles/settings.css'
import { applySettings, getSettings } from './services/settings.js'

// Antes de qualquer tela renderizar — senão a primeira pintura ainda sai
// com animação/texto normal e só corrige depois, um flash visível.
applySettings(getSettings())

const root = document.querySelector('#app')

// Entrypoint temporário de Shipaton: ?school=1 testa a licença institucional
// (RevenueCat) isolada do Cognita infantil — importar app.js já importa
// auth.js/supabase.js, então o import de app.js só acontece no ramo normal.
// Não é o roteamento definitivo da entrada imediata (docs/MOBILE.md).
const isSchoolEntry =
  import.meta.env.VITE_SHIPATON_SCHOOL_DEMO === '1' ||
  new URLSearchParams(window.location.search).get('school') === '1'

if (isSchoolEntry) {
  import('./screens/school-license.js').then(({ renderSchoolLicense }) => renderSchoolLicense(root))
} else {
  import('./app.js').then(({ initApp }) => initApp(root))
}
