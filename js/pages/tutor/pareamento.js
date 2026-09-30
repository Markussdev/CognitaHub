// Dispositivo da criança: status real dos aparelhos pareados e geração do código.
// Pareamento não pertence ao ato de atribuir jornada — é uma ação à parte.
import { createPairingCode, listPairedDevices } from '../../data/pareamento.js'
import { el } from '../../lib/ui.js'

export function renderDeviceCard(cycle) {
  const card = el('div', 'card journey-device')
  const row = el('div', 'journey-device-row')
  const info = el('div', 'journey-device-info')
  info.append(el('p', 'journey-device-label', 'Dispositivo da criança'))
  const statusEl = el('p', 'journey-device-status', 'Verificando dispositivo…')
  info.append(statusEl)
  // Status REAL, não fixo: a criança pode já ter um aparelho pareado.
  listPairedDevices(cycle.child_id).then(({ data, error }) => {
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
    const { data: codigo, error: pairError } = await createPairingCode(cycle.child_id)
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
