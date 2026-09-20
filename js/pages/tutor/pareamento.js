import { el } from '../../lib/ui.js'
import { listPairedDevices, createPairingCode } from '../../data/pareamento.js'

// Card de pareamento do dispositivo da criança — extraído de
// js/pages/tutor.js (buildPlanPanel/renderDeviceCard). Utilidade
// autocontida: não conhece Jornada, módulos, missões nem tutor.js — só o
// childId recebido por parâmetro. Nada do comportamento mudou nesta
// extração — só o arquivo que contém o código e o nome
// (renderDeviceCard → buildPairingCard, mesmo padrão build*Card/build*Panel
// usado nos outros módulos de tutor/).

export function buildPairingCard(childId) {
  const card = el('div', 'card journey-device')
  const row = el('div', 'journey-device-row')
  const info = el('div', 'journey-device-info')
  info.append(el('p', 'journey-device-label', 'Dispositivo da criança'))
  const statusEl = el('p', 'journey-device-status', 'Verificando dispositivo…')
  info.append(statusEl)
  // Status REAL, não fixo: a criança pode já ter um aparelho pareado.
  listPairedDevices(childId).then(({ data, error }) => {
    if (error) { statusEl.textContent = 'Conecte ou gerencie o dispositivo infantil'; return }
    const ativos = (data ?? []).filter((d) => !d.revoked_at)
    if (!ativos.length) { statusEl.textContent = 'Nenhum dispositivo conectado'; return }
    statusEl.textContent = ativos.length > 1
      ? `${ativos.length} dispositivos conectados`
      : `${ativos[0].device_name || 'Dispositivo'} conectado`
  })
  const pairBtn = el('button', 'btn btn-ghost btn-sm', 'Conectar dispositivo')
  pairBtn.type = 'button'
  row.append(info, pairBtn)
  card.append(row)

  const pairResult = el('div', 'trilha-pair-result')
  pairResult.hidden = true
  card.append(pairResult)

  pairBtn.addEventListener('click', async () => {
    pairBtn.disabled = true
    pairResult.hidden = true
    const { data: codigo, error: pairError } = await createPairingCode(childId)
    pairBtn.disabled = false
    pairResult.hidden = false
    pairResult.replaceChildren()
    if (pairError) {
      const err = el('p', 'card-copy', 'Não foi possível gerar o código agora.')
      err.style.color = 'var(--bad)'
      pairResult.append(err)
      return
    }
    pairResult.append(el('p', 'trilha-pair-label', 'Código de pareamento — válido por 10 minutos'))
    pairResult.append(el('p', 'trilha-pair-code', codigo))
    pairResult.append(el('p', 'trilha-pair-hint', 'Digite este código na tela de pareamento do aparelho da criança.'))
  })
  return card
}
