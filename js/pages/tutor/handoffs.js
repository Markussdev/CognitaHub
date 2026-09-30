// Entregas vindas de outras telas (Biblioteca, Modo Condução). Lidas uma vez, no
// carregamento, e guardadas em state.js; quem renderiza o acompanhamento
// (record.js) consome cada uma. A volta de trilha.html (?plan=&step=) é lida em
// navegacao.js, junto da escolha da view.
import { getActivityById } from '../../data/activities.js'
import { DIGITAL_PRESETS } from '../../data/digital-presets.js'
import { session, handoffs } from './state.js'

export async function readHandoffs() {
  // Detecta ?activity=<uuid> e pré-busca a atividade (vem da Biblioteca via "Usar no registro")
  {
    const _actParam = new URLSearchParams(location.search).get('activity')
    if (session && _actParam) {
      const { data: _actData } = await getActivityById(_actParam)
      if (_actData) {
        handoffs.activity = {
          id: _actData.id,
          title: _actData.title,
          focus: _actData.skills?.label || '',
          nextStep: '',
        }
      }
    }
  }

  // Detecta ?preset=<slug> (vem da Biblioteca via "Personalizar para Mateus")
  // — resolvido contra o registro local (js/data/digital-presets.js), sem
  // round-trip ao banco. Consumido em renderRecord, abre o assistente de
  // Atividades já no passo 2 com molde/tema/config prontos.
  {
    const _presetSlug = new URLSearchParams(location.search).get('preset')
    if (_presetSlug && DIGITAL_PRESETS[_presetSlug]) handoffs.preset = DIGITAL_PRESETS[_presetSlug]
  }

  // Detecta o retorno do Modo Condução (Biblioteca, atividade "com o tutor",
  // js/pages/atividades.js) — handoff por sessionStorage, não URL: o payload
  // pode ter texto livre (observação) e é consumo único (removido na leitura).
  // Preenche o MESMO handoffs.activity que "Usar no registro" já usa — só que
  // com foco/próximo passo/duração vindos do que o tutor observou ao conduzir,
  // não um fetch novo de activities.
  {
    const _condKey = 'cognita:conducao-result'
    const _raw = sessionStorage.getItem(_condKey)
    if (_raw) {
      sessionStorage.removeItem(_condKey)
      try {
        const payload = JSON.parse(_raw)
        handoffs.activity = {
          id: payload.activityId || null,
          title: payload.title || '',
          focus: payload.focus || '',
          nextStep: payload.nextStep || '',
          durationMinutes: payload.durationMinutes || null,
          observacaoInterna: payload.observacaoInterna || '',
        }
      } catch {
        // payload corrompido — ignora, o tutor cai no fluxo normal de registro.
      }
    }
  }
}
