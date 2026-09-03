// Drawer mobile do rail — compartilhado entre tutor.js e atividades.js.
// O CSS (@media em cada página) já esconde o rail fora da tela em ≤940px;
// isto é só o toggle: no desktop o botão nem aparece (display:none fora da
// media query), então .open nunca é aplicada lá e o menu não muda.

export function openRailDrawer() {
  document.querySelector('[data-rail]')?.classList.add('open')
  document.querySelector('[data-rail-backdrop]')?.classList.add('open')
  document.querySelector('[data-rail-toggle]')?.setAttribute('aria-expanded', 'true')
  document.body.classList.add('rail-drawer-open')
  document.querySelector('[data-rail] .rail-link')?.focus()
}

// returnFocus:false quando fecha por ter escolhido um link/botão de verdade
// (a ação clicada já vai levar o foco pra outro lugar); true nos outros casos
// (backdrop, Escape, toggle) — aí faz sentido devolver o foco pro hambúrguer.
export function closeRailDrawer({ returnFocus = true } = {}) {
  document.querySelector('[data-rail]')?.classList.remove('open')
  document.querySelector('[data-rail-backdrop]')?.classList.remove('open')
  document.querySelector('[data-rail-toggle]')?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('rail-drawer-open')
  if (returnFocus) document.querySelector('[data-rail-toggle]')?.focus()
}

// Wire genérico — cada página chama isto uma vez. Delegado: qualquer link/
// botão dentro do rail fecha o drawer, sem precisar tocar nos handlers de
// navegação de cada item.
export function wireRailToggle() {
  document.querySelector('[data-rail-toggle]')?.addEventListener('click', () => {
    const rail = document.querySelector('[data-rail]')
    if (rail?.classList.contains('open')) closeRailDrawer()
    else openRailDrawer()
  })
  document.querySelector('[data-rail-backdrop]')?.addEventListener('click', () => closeRailDrawer())
  document.querySelector('[data-rail]')?.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) closeRailDrawer({ returnFocus: false })
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRailDrawer()
  })
}
