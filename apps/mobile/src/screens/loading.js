import logoImg from '../assets/logo-icon-transparent.webp'
import { mascotHtml } from '../components/mascot.js'

export function renderLoading(root) {
  root.innerHTML = `
    <div class="screen screen--loading">
      <img class="logo" src="${logoImg}" alt="" />
      ${mascotHtml()}
      <h1 class="title">Cognita</h1>
      <div class="loading-spinner" role="status" aria-label="Carregando"></div>
    </div>
  `
}
