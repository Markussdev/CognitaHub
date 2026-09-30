// Ponte com a Biblioteca de atividades: o link com o contexto da criança e a
// sugestão local de atividade (regra explícita, sem IA).
import { ageFrom } from '../../lib/ui.js'
import { firstName, toList } from './helpers.js'

// Href pra Biblioteca com o contexto completo da criança — usado pelo link
// do rail e pelo atalho "Abrir biblioteca de atividades" do ⌘K (antes cada
// um montava um subconjunto diferente de params; child_id sozinho já
// quebrava "Personalizar para Mateus"/recomendações se faltasse).
export function buildLibraryHref(cycle) {
  if (!cycle) return 'atividades.html'
  const child = cycle.children ?? {}
  const lp = child.learning_profiles ?? {}
  const params = new URLSearchParams()
  const childFirst = firstName(child.name)
  if (childFirst) params.set('child', childFirst)
  if (child.id) params.set('child_id', child.id)
  if (cycle.id) params.set('cycle_id', cycle.id)
  const age = ageFrom(child.birth_date)
  if (age != null) params.set('age', String(age))
  // Sinais pra "Recomendadas" da Biblioteca (regra explícita, sem IA) — dado
  // que o painel já carregou, zero query extra em atividades.js.
  const difficulties = toList(lp.math_difficulties).length ? toList(lp.math_difficulties) : toList(child.main_difficulties)
  if (difficulties.length) params.set('focus', difficulties.join(','))
  const formats = toList(lp.preferred_formats)
  if (formats.length) params.set('pref', formats.join(','))
  return 'atividades.html?' + params.toString()
}

// Biblioteca local enxuta: a sugestão muda conforme o foco do ciclo em vez
// de ser sempre a mesma atividade fixa. TODO(wiring:activities): trocar por
// consulta à tabela activities quando ela existir.
export const ACTIVITY_LIBRARY = {
  contagem: {
    title: 'Blocos de contagem coloridos', skill: 'contagem até 10',
    focus: 'contagem, adição simples e comparação de quantidades', time: '15-20 min',
    materials: 'blocos, tampinhas ou objetos pequenos',
    why: 'Combina com apoio visual e dura pouco — bom para sessões curtas.',
    nextStep: 'Repetir contagem até 10 com apoio visual e comparar dois grupos pequenos.',
  },
  'adição simples': {
    title: 'Soma com objetos concretos', skill: 'adição até 10',
    focus: 'adição simples com apoio visual', time: '15-20 min',
    materials: 'objetos pequenos ou desenhos',
    why: 'Trabalha a adição de forma concreta antes do cálculo abstrato.',
    nextStep: 'Avançar para somas com dois dígitos quando estiver confiante.',
  },
  'comparação de quantidades': {
    title: 'Qual grupo tem mais?', skill: 'comparação de quantidades',
    focus: 'comparar dois grupos de objetos', time: '10-15 min',
    materials: 'objetos pequenos de duas cores',
    why: 'Prepara o terreno para maior/menor antes da adição e subtração.',
    nextStep: 'Introduzir os símbolos de maior e menor depois da comparação visual.',
  },
  'sequência numérica': {
    title: 'Trilha numérica', skill: 'sequência de 1 a 10',
    focus: 'ordem numérica e reconhecimento dos números', time: '15-20 min',
    materials: 'cartões numerados ou trilha desenhada',
    why: 'Reforça a ordem dos números com movimento, bom para manter o foco.',
    nextStep: 'Aumentar a trilha até 20 quando a sequência até 10 estiver firme.',
  },
  subtração: {
    title: 'Tirando da coleção', skill: 'subtração até 10',
    focus: 'subtração simples com apoio concreto', time: '15-20 min',
    materials: 'objetos pequenos para retirar do grupo',
    why: 'Mostra a subtração como ação física antes do símbolo no papel.',
    nextStep: 'Registrar a subtração por escrito quando a ação concreta estiver clara.',
  },
}
const DEFAULT_ACTIVITY = ACTIVITY_LIBRARY.contagem

export function pickSuggestedActivity(difficulties) {
  const list = toList(difficulties).map((d) => d.toLowerCase())
  const match = Object.keys(ACTIVITY_LIBRARY).find((key) =>
    list.some((d) => d.includes(key) || key.includes(d))
  )
  return match ? ACTIVITY_LIBRARY[match] : DEFAULT_ACTIVITY
}
