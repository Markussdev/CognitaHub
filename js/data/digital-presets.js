// Ponte Biblioteca → Modo Criança: quais atividades da Biblioteca (tabela
// `activities`, docs/activities-seed.sql) já têm um equivalente digital
// pronto no Modo Criança, e com qual configuração inicial abrir o
// assistente de Atividades (js/pages/tutor.js#renderActivityWizard).
//
// Client-side de propósito — não precisa de coluna nova em `activities`.
// Chave = activities.slug (estável, já é o identificador natural do
// catálogo). Se um dia o catálogo crescer o bastante pra isso pesar,
// vira uma coluna `digital_preset jsonb`; até lá, uma verdade só aqui.
//
// molde/tema precisam existir em MOLDES_REGISTRO (js/data/moldes-registro.js)
// — só 'contar' e 'identificar' estão disponíveis hoje, então só as
// atividades da Biblioteca com equivalente nesses dois moldes entram aqui.
// 'onde-tem-mais' (comparar) e 'leve-os-peixes' (associar) ficam de fora até
// esses moldes existirem — continuam só como roteiro guiado (Modo Condução).
export const DIGITAL_PRESETS = {
  'conte-os-dinossauros': {
    molde: 'contar',
    tema: 'dinossauros',
    config: { quantidade: 5, nivel: 1, rodadas: 3 },
  },
  'toque-no-numero': {
    molde: 'identificar',
    tema: 'numeros',
    config: { maiorNumero: 5, opcoes: 4, nivel: 1, rodadas: 3 },
  },
}

export function hasDigitalPreset(slug) {
  return Object.prototype.hasOwnProperty.call(DIGITAL_PRESETS, slug)
}
