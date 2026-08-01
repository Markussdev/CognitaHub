import brandMark from '../assets/logo-cognita-hub-transparent.webp'

export function renderLoading(root) {
  root.innerHTML = `
    <div class="screen screen--loading">
      <div class="loading-brand" role="status" aria-live="polite">
        <img
          class="loading-brand__logo"
          src="${brandMark}"
          alt="Cognita Hub"
        />

        <div class="loading-indicator" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <span class="sr-only">Carregando o Cognita Hub</span>
      </div>
    </div>
  `
}
