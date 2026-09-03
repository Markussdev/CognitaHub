import baseSrc from '../../assets/landmarks/base.png'
import abacoSrc from '../../assets/landmarks/abaco.png'
import observationSrc from '../../assets/landmarks/observation.png'
import biblioSrc from '../../assets/landmarks/biblio.png'
import cinemaSrc from '../../assets/landmarks/cinema.png'
import dinossauroSrc from '../../assets/landmarks/dinossauro.png'
import parqueSrc from '../../assets/landmarks/parque.png'

// Identidade visual dos módulos (trail_modules.visual_key) — fonte única
// entre site e banco (mesmas 7 chaves da constraint trail_modules_visual_key_ck).
// O site só usa miniatura +
// nome; a composição completa (céu, terreno, animação) é só do app da criança.
export const MODULE_VISUALS = [
  { key: 'base', label: 'Base Espacial', description: 'Espaço, lua e exploração', image: baseSrc },
  { key: 'abaco', label: 'Escola do Ábaco', description: 'Ambiente escolar claro e acolhedor', image: abacoSrc },
  { key: 'observation', label: 'Observatório', description: 'Noite, estrelas e descobertas', image: observationSrc },
  { key: 'biblio', label: 'Biblioteca', description: 'Leitura e fim de tarde tranquilo', image: biblioSrc },
  { key: 'cinema', label: 'Cinema', description: 'Estreia, luzes e tapete vermelho', image: cinemaSrc },
  { key: 'dinossauro', label: 'Museu dos Dinossauros', description: 'Natureza e exploração paleontológica', image: dinossauroSrc },
  { key: 'parque', label: 'Parque de Diversões', description: 'Cores, brincadeiras e celebração', image: parqueSrc },
]

// Mesmo fallback por posição que o mobile já usava antes de visual_key
// existir, e que a migration usa pra preencher módulos antigos (((position
// - 1) % 7) + 1 → base/abaco/observation/biblio/cinema/dinossauro/parque).
export function defaultModuleVisualKey(index = 0) {
  return MODULE_VISUALS[index % MODULE_VISUALS.length].key
}

export function getModuleVisual(key, fallbackIndex = 0) {
  return MODULE_VISUALS.find((visual) => visual.key === key)
    ?? MODULE_VISUALS[fallbackIndex % MODULE_VISUALS.length]
}
