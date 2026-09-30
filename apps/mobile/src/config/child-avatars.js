import astronautaImg from '../assets/avatars/astronauta.webp'
import cientistaImg from '../assets/avatars/cientista.webp'
import magoImg from '../assets/avatars/mago.webp'
import pintorImg from '../assets/avatars/pintor.webp'

// Chaves exatamente iguais ao check constraint de children.avatar_key no
// banco — mudar uma dessas strings sem trocar lá quebra o save silenciosamente
// (a RPC rejeita a chave, ver services/personalization.js).
export const CHILD_AVATARS = [
  { key: 'astronauta', label: 'Astronaut', image: astronautaImg },
  { key: 'cientista', label: 'Scientist', image: cientistaImg },
  { key: 'mago', label: 'Wizard', image: magoImg },
  { key: 'pintor', label: 'Artist', image: pintorImg },
]

// Fallback pra criança que ainda não escolheu avatar (avatar_key null) —
// não precisamos preencher registros antigos no banco por causa disso.
export function getChildAvatar(key) {
  return CHILD_AVATARS.find((avatar) => avatar.key === key) ?? CHILD_AVATARS[0]
}
