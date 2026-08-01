import brandMark from '../assets/logo-cognita-hub-mark.webp'

// Marca sem fundo (só texto + gato) dentro de um bloco colorido em CSS —
// assim a cor do bloco é uma variável, não um arquivo de imagem. Teste
// rápido: troque --loading-badge-bg em screens.css.
export function renderLoading(root) {
  root.innerHTML = `
    <div class="screen screen--loading">
      <div class="loading-brand" role="status" aria-live="polite">
        <div class="loading-brand__badge">
          <img class="loading-brand__logo" src="${brandMark}" alt="Cognita Hub" />
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
