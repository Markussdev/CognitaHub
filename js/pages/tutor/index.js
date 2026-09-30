// Painel do tutor (pages/tutor.html) — ponto de montagem.
// Autentica, lê as entregas de outras telas, liga os atalhos globais da casca
// (rail, busca ⌘K, suporte, Esc) e dispara o primeiro render. Cada comportamento
// mora no seu módulo; este arquivo só os compõe, na mesma ordem de sempre.
import { requireRole, signOut } from '../../lib/auth.js'
import { closeRailDrawer, wireRailToggle } from '../../lib/rail.js'
import { session, setSession } from './state.js'
import { readHandoffs } from './handoffs.js'
import { fillIdentity, wireRail } from './shell.js'
import { bootstrap, goHome, goProfile, goRecord, stateBox } from './navegacao.js'
import { closeCommandPalette, openCommandPalette, wireCommandPalette } from './command-palette.js'
import { closeSupportDrawer, wireSupportDrawer } from './suporte.js'

export async function bootstrapTutor() {
  setSession(await requireRole('tutor'))
  await readHandoffs()

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => { e.preventDefault(); await signOut() })
  })

  wireRail({ goHome, goRecord, goProfile })

  // Drawer mobile do menu (rail) — wiring compartilhada em js/lib/rail.js (usada
  // também por atividades.js). closeRailDrawer é importada porque o Escape
  // abaixo precisa dela.
  wireRailToggle()

  wireCommandPalette()
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return }
    if (e.key === 'Escape') { closeSupportDrawer(); closeCommandPalette(); closeRailDrawer() }
  })

  wireSupportDrawer()

  if (session && stateBox) {
    fillIdentity()
    await bootstrap()
  }
}
