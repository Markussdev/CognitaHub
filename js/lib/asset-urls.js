// URLs das imagens de public/assets/ usadas direto pelo JS das páginas.
// public/ é a única pasta de imagens da web: o Vite serve /assets/* a partir
// dela. Por isso estas imagens não entram por `import ... from '../../assets'`
// — não existe uma segunda cópia em assets/ para importar.
// (As imagens da trilha, montadas por nome, ficam em trilha-assets.js.)

export const logoIconSrc = '/assets/logo-icon-transparent.png'
export const gatoMatematicoSrc = '/assets/gatomatematico-sem-fundo.png'
export const mascotHeroSrc = '/assets/mascot-hero-wave.png'

// Avatares Cognita da criança (chaves: astronauta, cientista, mago, pintor)
export const astronautaSrc = '/assets/cat-astronauta.png'
export const cientistaSrc = '/assets/cat-cientista.png'
export const magoSrc = '/assets/cat-mago.png'
export const pintorSrc = '/assets/cat-pintor.png'
