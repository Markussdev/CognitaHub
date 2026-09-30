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
      <p class="subtitle">Licencie o ecossistema Cognita para sua instituição.</p>
      <p class="subtitle">Criança · Mediador · Família</p>
      <p class="subtitle" id="school-price">Carregando oferta...</p>
      <button class="btn-primary" id="school-activate-btn" type="button" disabled>Ativar licença</button>
      <div id="school-status"></div>
    </div>
  `

  const priceEl = root.querySelector('#school-price')
  const statusEl = root.querySelector('#school-status')
  const activateBtn = root.querySelector('#school-activate-btn')

  let pkg = null

  // Some o CTA de ativação assim que a licença já está ativa — sem isso,
  // "Ativar licença" (ainda clicável) e "Explorar Cognita Escola" apareciam
  // lado a lado, como se a compra ainda estivesse pendente.
  function renderActiveState() {
    activateBtn.hidden = true

    statusEl.innerHTML = `
      ${statusMessageHtml({ type: 'success', text: 'Licença ativa ✓' })}
      <button class="btn-primary" id="school-enter-btn" type="button">Explorar Cognita Escola</button>
    `

    statusEl.querySelector('#school-enter-btn')?.addEventListener('click', openSchoolWorkspace)
  }

  // Import de school-workspace.js (e, dentro dele, de app.js só no clique de
  // "Abrir experiência da criança") continua fora do topo deste arquivo —
  // Cognita Escola fica isolado do Supabase até a pessoa pedir a experiência
  // infantil (mesmo motivo do import condicional em main.js).
  async function openSchoolWorkspace() {
    const { renderSchoolWorkspace } = await import('./school-workspace.js')

    renderSchoolWorkspace(root, {
      priceString: pkg?.product?.priceString ?? '',
      onBack: () => renderSchoolLicense(root),
      onOpenChild: async () => {
        if (import.meta.env.VITE_SHIPATON_CHILD_DEMO === '1') {
          const { renderDemoChildExperience } = await import('../demo/demo-child.js')
          renderDemoChildExperience(root, { onExit: openSchoolWorkspace })
          return
        }

        const { initApp } = await import('../app.js')
        await initApp(root)
      },
    })
  }

  async function reportIfAlreadyActive() {
    try {
      if (await getSchoolAccess()) {
        renderActiveState()
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
      if (active) {
        renderActiveState()
      } else {
        statusEl.innerHTML = statusMessageHtml({
          type: 'error',
          text: 'Compra concluída, mas a licença não apareceu ativa.',
        })
      }
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
