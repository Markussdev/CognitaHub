const SCHOOL_YEAR_LABELS = {
  pre: 'Pré-escola',
  ef1: '1º ano do Ensino Fundamental',
  ef2: '2º ano do Ensino Fundamental',
  ef3: '3º ano do Ensino Fundamental',
  ef4: '4º ano do Ensino Fundamental',
}

export function formatSchoolYear(value) {
  return SCHOOL_YEAR_LABELS[value] ?? value ?? 'Não informado'
}
