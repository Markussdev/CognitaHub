import { renderLoading } from './screens/loading.js'
import { renderPairing } from './screens/pairing.js'
import { renderJourney } from './screens/journey.js'

// Etapa 1: só o ciclo visual (carregando -> pareamento -> jornada demo).
// Nada de Supabase ainda — o pareamento real entra na etapa 3, e a leitura
// da jornada de verdade entra na etapa 4.
export function initApp(root) {
  renderLoading(root)

  setTimeout(() => {
    const pairing = renderPairing(root, {
      onSubmit(code) {
        if (code.length !== 8) return
        renderJourney(root)
      },
    })
    void pairing
  }, 900)
}
