import brandMark from '../assets/logo-cognita-hub-mark.webp'

// A janela (.loading-brand__window) corta o espaço transparente enorme ao
// redor do arquivo original — em vez de reprocessar o asset, a imagem é
// ampliada via CSS (scale) até só a marca de verdade aparecer.
export function renderLoading(root) {
  root.innerHTML = `
    <div class="screen screen--loading">
      <div class="loading-brand" role="status" aria-live="polite">
        <div class="loading-brand__window">
          <img
            class="loading-brand__logo"
            src="${brandMark}"
            alt="Cognita Hub"
          />
        </div>

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
