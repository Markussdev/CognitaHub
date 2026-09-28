import { statusMessageHtml } from '../components/status-message.js'
import { getSchoolOffering, getSchoolAccess, purchaseSchoolPackage } from '../services/revenuecat.js'

// Entrypoint temporário de Shipaton (main.js, ?school=1) — só prova o funil
// SDK → Offering → Package → Test Store → CustomerInfo → entitlement. Não é
// a entrada institucional definitiva; não cria criança, tutor, ciclo nem
// jornada, e não toca no Supabase.
export async function renderSchoolLicense(root) {
  root.innerHTML = `
    <div class="screen screen--pairing">
      <h1 class="title">Cognita Escola</h1>
      <p class="subtitle">Licença institucional piloto</p>
      <p class="subtitle" id="school-price">Carregando oferta...</p>
      <button class="btn-primary" id="school-activate-btn" type="button" disabled>Ativar licença</button>
      <div id="school-status"></div>
    </div>
  `

  const priceEl = root.querySelector('#school-price')
  const statusEl = root.querySelector('#school-status')
  const activateBtn = root.querySelector('#school-activate-btn')

  let pkg = null

  async function reportIfAlreadyActive() {
    try {
      if (await getSchoolAccess()) {
        statusEl.innerHTML = statusMessageHtml({ type: 'success', text: 'Licença ativa ✓' })
      }
    } catch (err) {
      console.error('Erro ao verificar licença escolar:', err)
    }
  }

  try {
    const offering = await getSchoolOffering()
    pkg = offering?.availablePackages?.[0] ?? null

    if (!pkg) {
      priceEl.textContent = 'Nenhuma oferta configurada no RevenueCat.'
    } else {
      priceEl.textContent = pkg.product?.priceString ?? ''
      activateBtn.disabled = false
      await reportIfAlreadyActive()
    }
  } catch (err) {
    console.error('Erro ao carregar oferta da Cognita Escola:', err)
    priceEl.textContent = ''
    statusEl.innerHTML = statusMessageHtml({
      type: 'error',
      text: 'Não foi possível carregar a oferta. Confira dispositivo, SDK e Test Store.',
    })
  }

  activateBtn.addEventListener('click', async () => {
    if (!pkg) return
    activateBtn.disabled = true
    activateBtn.textContent = 'Ativando...'
    statusEl.innerHTML = ''
    try {
      const active = await purchaseSchoolPackage(pkg)
      statusEl.innerHTML = active
        ? statusMessageHtml({ type: 'success', text: 'Licença ativa ✓' })
        : statusMessageHtml({ type: 'error', text: 'Compra concluída, mas a licença não apareceu ativa.' })
    } catch (err) {
      statusEl.innerHTML = err?.userCancelled
        ? statusMessageHtml({ type: 'info', text: 'Compra cancelada.' })
        : statusMessageHtml({ type: 'error', text: 'Falha na compra. Tente de novo.' })
      if (!err?.userCancelled) console.error('Erro ao comprar licença escolar:', err)
    } finally {
      activateBtn.disabled = false
      activateBtn.textContent = 'Ativar licença'
    }
  })
}
