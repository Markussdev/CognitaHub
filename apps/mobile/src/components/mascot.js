import mascotImg from '../assets/mascot-hero-wave.webp'

export function mascotHtml({ size = '' } = {}) {
  const sizeClass = size ? ` mascot--${size}` : ''
  return `<img class="mascot${sizeClass}" src="${mascotImg}" alt="Mascote do Cognita acenando" />`
}
