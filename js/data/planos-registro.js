import { getCycleSessions } from './sessions.js'
import { listChildActivities } from './child-activities.js'

// Dado pedagógico da trilha do tutor — não é navegação livre da criança, é o
// tutor decidindo a próxima etapa. Trilha fixa em JS (sem tabela nova ainda):
// cada etapa sugere molde+tema+config, e "Preparar atividade desta etapa" só
// joga esses valores no form de composição da aba Atividades preparadas
// (mesmo prefillCompose que Duplicar/Editar já usam) — o tutor ainda revisa
// e decide salvar.
export const PLANOS_REGISTRO = {
  primeiros_numeros: {
    id: 'primeiros_numeros',
    titulo: 'Primeiros Números',
    descricao: 'Sequência guiada para reconhecimento e contagem dos números iniciais.',
    etapas: [
      {
        id: 'identificar-1-5',
        titulo: 'Identificar números de 1 a 5',
        resumo: 'Identificar 1–5',
        objetivo: 'Reconhecer e apontar números de 1 a 5.',
        molde: 'identificar',
        tema: 'numeros',
        emblema: 'identificar',
        config: { maiorNumero: 5, opcoes: 4, nivel: 1, rodadas: 3 },
        instrucao: 'Toque no número que eu disser.',
      },
      {
        id: 'contar-1-5',
        titulo: 'Contar objetos até 5',
        resumo: 'Contar até 5',
        objetivo: 'Contar de 1 a 5 itens com apoio visual.',
        molde: 'contar',
        tema: 'dinossauros',
        emblema: 'contar',
        config: { quantidade: 5, nivel: 1, rodadas: 3 },
        instrucao: 'Toque em cada dinossauro para contar.',
      },
      {
        id: 'identificar-1-10',
        titulo: 'Identificar números de 1 a 10',
        resumo: 'Identificar 1–10',
        objetivo: 'Reconhecer números um pouco maiores, até 10.',
        molde: 'identificar',
        tema: 'numeros',
        emblema: 'identificar',
        config: { maiorNumero: 10, opcoes: 5, nivel: 1, rodadas: 3 },
        instrucao: 'Toque no número que eu disser.',
      },
      {
        id: 'contar-1-10',
        titulo: 'Contar objetos até 10',
        resumo: 'Contar até 10',
        objetivo: 'Contar até 10 itens, aumentando aos poucos.',
        molde: 'contar',
        tema: 'dinossauros',
        emblema: 'contar',
        config: { quantidade: 10, nivel: 1, rodadas: 3 },
        instrucao: 'Toque em cada dinossauro para contar.',
      },
      {
        id: 'revisao-calma',
        titulo: 'Revisão calma',
        resumo: 'Revisão calma',
        objetivo: 'Revisar contagem e identificação, sem conteúdo novo.',
        molde: 'contar',
        tema: 'dinossauros',
        emblema: 'revisar',
        config: { quantidade: 3, nivel: 1, rodadas: 2 },
        instrucao: 'Toque em cada dinossauro para contar, sem pressa.',
      },
    ],
  },
}

export const STATUS_ETAPA = {
  concluida: { label: 'Concluída' },
  em_andamento: { label: 'Em andamento' },
  a_fazer: { label: 'A fazer' },
}

// Reconhece se uma child_activity já preparada corresponde a uma etapa da
// trilha — por molde+tema e um "número-chave" da config (o que muda entre
// "até 5" e "até 10" pra cada molde). Aproximado de propósito: não há
// vínculo formal plano↔atividade ainda, é inferência sobre dado existente.
export function etapaBateComAtividade(row, etapa) {
  if (row.molde !== etapa.molde || row.tema !== etapa.tema) return false
  if (etapa.molde === 'identificar') return Number(row.config?.maiorNumero) === Number(etapa.config.maiorNumero)
  if (etapa.molde === 'contar') return Number(row.config?.quantidade) === Number(etapa.config.quantidade)
  return true
}

// Cruza child_activities (o que já foi preparado) com sessions.child_activity_id
// (o que já virou registro) — sem query nova, as duas já existem pra outras
// telas. "Em andamento" também cobre a primeira etapa ainda não concluída
// mesmo sem nada preparado, pra sempre haver um "próximo passo" visível.
export async function computeStatusEtapas(plano, childId, cycleId) {
  const [{ data: atividades, error: e1 }, { data: sessoes, error: e2 }] = await Promise.all([
    listChildActivities(childId),
    getCycleSessions(cycleId),
  ])
  if (e1 || e2) return null

  const idsComSessao = new Set((sessoes ?? []).map((s) => s.child_activity_id).filter(Boolean))

  const bruto = plano.etapas.map((etapa) => {
    const match = (atividades ?? []).find((row) => etapaBateComAtividade(row, etapa))
    if (match && idsComSessao.has(match.id)) return 'concluida'
    if (match) return 'em_andamento'
    return 'a_fazer'
  })

  const primeiraNaoConcluidaIdx = bruto.findIndex((s) => s !== 'concluida')
  return bruto.map((s, i) => (i === primeiraNaoConcluidaIdx && s === 'a_fazer' ? 'em_andamento' : s))
}
