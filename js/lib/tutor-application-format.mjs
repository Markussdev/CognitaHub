const FORMATION_LABELS = {
  em: 'Ensino Médio',
  'est-lic': 'Estudante de licenciatura',
  'lic-mat': 'Licenciatura em Matemática',
  ped: 'Pedagogia',
  mat: 'Matemática',
  'outra-grad': 'Outra graduação',
  outra: 'Outra formação',
}

const SITUATION_LABELS = {
  cursando: 'cursando',
  concluido: 'concluído',
}

export function formatTutorFormation(value) {
  if (!value) return null

  const [formationRaw = '', situationRaw = ''] = String(value).split(' / ')
  const formation = FORMATION_LABELS[formationRaw.trim()] ?? formationRaw.trim()
  const situation = SITUATION_LABELS[situationRaw.trim()] ?? situationRaw.trim()

  return [formation, situation].filter(Boolean).join(' — ') || null
}
