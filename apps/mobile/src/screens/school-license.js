import '../styles/school-license.css'

import logoIcon from '../assets/logo-icon-transparent.webp'
import revenuecatLogo from '../assets/school/revenuecat.png'
import { statusMessageHtml } from '../components/status-message.js'
import { getSchoolOffering, getSchoolAccess, purchaseSchoolPackage } from '../services/revenuecat.js'
import { resetSchoolDemo } from '../demo/school-demo-store.js'

// Primeira tela da Cognita Escola — entrypoint temporário de Shipaton
// (main.js, ?school=1). Apresenta a licença institucional e prova o funil
// SDK → Offering → Package → Test Store → CustomerInfo → entitlement. O preço
// vem do RevenueCat (priceString), nunca é escrito aqui. Não é a entrada
// institucional definitiva; não cria criança, tutor, ciclo nem jornada, e não
// toca no Supabase.
export async function renderSchoolLicense(root) {
  root.innerHTML = `
    <div class="school-entry">
      <header class="school-entry__hero">
        <div class="school-entry__emblem">
          <img src="${logoIcon}" alt="" />
        </div>
        <span class="school-entry__eyebrow">Cognita for Schools</span>
        <h1>Learning, guidance, and ongoing support in one connected ecosystem.</h1>
        <p>One institutional license connects tutors, children, and families.</p>
        <ul class="school-entry__roles" aria-label="The three experiences">
          <li>Tutor</li>
          <li>Child</li>
          <li>Family</li>
        </ul>
      </header>

      <main class="school-entry__card">
        <span class="school-entry__label">Institutional license</span>
        <strong class="school-entry__price is-muted" id="school-price">Loading offer...</strong>
        <small class="school-entry__pilot">Demo pricing</small>
        <button class="btn-primary" id="school-activate-btn" type="button" disabled>Activate license</button>
        <div id="school-status"></div>
        <div class="school-entry__powered">
          <span>Powered by</span>
          <img src="${revenuecatLogo}" alt="RevenueCat" />
        </div>
      </main>
    </div>
  `

  const priceEl = root.querySelector('#school-price')
  const statusEl = root.querySelector('#school-status')
  const activateBtn = root.querySelector('#school-activate-btn')

  // Preço grande só quando há preço de verdade; carregando/sem oferta ficam
  // como texto discreto, e vazio some (sem deixar um buraco no card).
  function setPrice(text, { muted = false } = {}) {
    priceEl.textContent = text
    priceEl.classList.toggle('is-muted', muted)
    priceEl.hidden = !text
  }

  let pkg = null

  // Some o CTA de ativação assim que a licença já está ativa — sem isso,
  // "Ativar licença" (ainda clicável) e "Explorar Cognita Escola" apareciam
  // lado a lado, como se a compra ainda estivesse pendente.
  function renderActiveState() {
    activateBtn.hidden = true

    statusEl.innerHTML = `
      ${statusMessageHtml({ type: 'success', text: 'License active ✓' })}
      <button class="btn-primary" id="school-enter-btn" type="button">Explore Cognita for Schools</button>
    `

    statusEl.querySelector('#school-enter-btn')?.addEventListener('click', openSchoolWorkspace)
  }

  // Import de school-workspace.js (e, dentro dele, de app.js só no clique de
  // "Abrir experiência da criança") continua fora do topo deste arquivo —
  // Cognita Escola fica isolado do Supabase até a pessoa pedir a experiência
  // infantil (mesmo motivo do import condicional em main.js). As demos do
  // mediador, da criança e da família (demo/) não tocam no Supabase.
  async function openSchoolWorkspace() {
    const { renderSchoolWorkspace } = await import('./school-workspace.js')

    // A criança sempre volta pra quem a abriu (onExit): workspace ou mediador.
    async function openChildDemo(onExit) {
      const { renderDemoChildExperience } = await import('../demo/demo-child.js')
      renderDemoChildExperience(root, { onExit })
    }

    async function openTutorDemo(initialTab) {
      const { renderDemoTutorExperience } = await import('../demo/demo-tutor.js')

      // O que o mediador libera só chega na criança da demo local; por isso
      // "Ver experiência da criança" abre sempre o Mateus demo, com ou sem
      // VITE_SHIPATON_CHILD_DEMO — e ao sair ela volta pro Resumo do mediador,
      // onde a execução aparece como "aguardando registro".
      renderDemoTutorExperience(root, {
        initialTab,
        onExit: openSchoolWorkspace,
        onOpenChild: () => openChildDemo(() => openTutorDemo('resumo')),
      })
    }

    renderSchoolWorkspace(root, {
      priceString: pkg?.product?.priceString ?? '',

      // Sair da vitrine zera o estado compartilhado das demos.
      onBack: () => {
        resetSchoolDemo()
        renderSchoolLicense(root)
      },

      onOpenTutor: () => openTutorDemo('resumo'),

      // Card da criança: com VITE_SHIPATON_CHILD_DEMO=1 entra no Mateus demo;
      // sem a flag, segue o fluxo real (pareamento + Supabase).
      onOpenChild: async () => {
        if (import.meta.env.VITE_SHIPATON_CHILD_DEMO === '1') {
          await openChildDemo(openSchoolWorkspace)
          return
        }

        const { initApp } = await import('../app.js')
        await initApp(root)
      },

      onOpenFamily: async () => {
        const { renderDemoFamilyExperience } = await import('../demo/demo-family.js')
        renderDemoFamilyExperience(root, { onExit: openSchoolWorkspace })
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
      setPrice('No offer configured in RevenueCat.', { muted: true })
    } else {
      const price = pkg.product?.priceString
      setPrice(price ? `${price} / month` : 'Offer available', { muted: !price })
      activateBtn.disabled = false
      await reportIfAlreadyActive()
    }
  } catch (err) {
    console.error('Erro ao carregar oferta da Cognita Escola:', err)
    setPrice('')
    statusEl.innerHTML = statusMessageHtml({
      type: 'error',
      text: "Couldn't load the offer. Check the device, SDK, and Test Store.",
    })
  }

  activateBtn.addEventListener('click', async () => {
    if (!pkg) return
    activateBtn.disabled = true
    activateBtn.textContent = 'Activating...'
    statusEl.innerHTML = ''
    try {
      const active = await purchaseSchoolPackage(pkg)
      if (active) {
        renderActiveState()
      } else {
        statusEl.innerHTML = statusMessageHtml({
          type: 'error',
          text: 'Purchase completed, but the license did not show as active.',
        })
      }
    } catch (err) {
      statusEl.innerHTML = err?.userCancelled
        ? statusMessageHtml({ type: 'info', text: 'Purchase cancelled.' })
        : statusMessageHtml({ type: 'error', text: 'Purchase failed. Please try again.' })
      if (!err?.userCancelled) console.error('Erro ao comprar licença escolar:', err)
    } finally {
      activateBtn.disabled = false
      activateBtn.textContent = 'Activate license'
    }
  })
}
