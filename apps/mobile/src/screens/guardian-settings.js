import { createElement, RefreshCw, Smartphone, FileText, LifeBuoy, ChevronRight } from 'lucide'
import { escapeHtml } from '../utils/html.js'
import { statusMessageHtml } from '../components/status-message.js'
import pkg from '../../package.json'

const HOLD_MS = 2000
const SUPPORT_EMAIL = 'cognitahub1@gmail.com'

// Strings de SVG geradas uma vez no carregamento do módulo (não a cada
// render) — createElement() monta o <svg> de verdade via DOM, .outerHTML
// vira uma string comum que entra no template literal igual a qualquer
// outro ícone do app (LOCK_SVG/CHECK_SVG em mission-node.js). Sem isso,
// teríamos que rechamar um scanner de ícones toda vez que renderMain()
// substitui o innerHTML inteiro (ex.: abrir/fechar "Ajuda e contato") —
// fácil de esquecer e deixar o ícone sumido.
const iconSvg = (icon, attrs) => createElement(icon, attrs).outerHTML

const REFRESH_SVG = iconSvg(RefreshCw, { width: 22, height: 22, 'stroke-width': 2.2 })
const SMARTPHONE_SVG = iconSvg(Smartphone, { width: 22, height: 22, 'stroke-width': 2.2 })
const FILE_TEXT_SVG = iconSvg(FileText, { width: 22, height: 22, 'stroke-width': 2.2 })
const LIFE_BUOY_SVG = iconSvg(LifeBuoy, { width: 22, height: 22, 'stroke-width': 2.2 })
const CHEVRON_SVG = iconSvg(ChevronRight, { width: 19, height: 19, 'stroke-width': 2.2 })

// TODO: apontar pra URL real assim que a página existir no site — a Play
// Store exige que a política de privacidade esteja acessível a partir do
// app (o texto legal em si precisa ser escrito/aprovado, não é algo que dá
// pra gerar aqui). Enquanto vazio, o item fica visível mas desabilitado
// ("Configuração pendente") — de propósito, pra não esquecer de preencher
// antes de submeter, em vez de sumir da tela e ser esquecido.
const PRIVACY_POLICY_URL = ''

// "Para responsáveis" — só 3 ações (trocar criança, desconectar, ajuda).
// Nada de PIN real: o "segure 2s pra entrar" é só fricção contra toque
// acidental da criança, não autenticação. Por isso o timer que decide
// quando liberar é um setTimeout de verdade, independente da barra visual
// (que pode ficar "instantânea" com movimento reduzido ligado — ver
// comentário em cima do bloco de hold abaixo).
export function renderGuardianSettings(
  root,
  { childName, childAvatar, onBack, onSwitchChild, onDisconnect, initiallyUnlocked = false, onUnlock },
) {
  let view = 'main' // 'main' | 'confirm-disconnect'
  let helpOpen = false
  let disconnectStatus = 'idle' // idle | disconnecting | error

  function renderGate() {
    root.innerHTML = `
      <div class="screen screen--settings screen--guardian-gate">
        <header class="settings-header">
          <button class="settings-header__back" type="button" aria-label="Voltar">‹</button>
          <h1 class="title">Para responsáveis</h1>
        </header>

        <div class="guardian-gate">
          <p class="guardian-gate__title">Área para adultos</p>
          <p class="guardian-gate__hint">Segure o botão por 2 segundos para continuar.</p>

          <button class="guardian-gate__btn" type="button" id="guardian-hold">
            <span class="guardian-gate__fill" aria-hidden="true"></span>
            <span class="guardian-gate__label">Segure para entrar</span>
          </button>
        </div>
      </div>
    `

    root.querySelector('.settings-header__back')?.addEventListener('click', () => onBack?.())

    const holdBtn = root.querySelector('#guardian-hold')
    let holdTimer = null

    function startHold() {
      holdBtn.classList.add('is-holding')
      // O timer real (funcional) — a barra de progresso é só feedback
      // visual e pode ser encurtada pelo CSS de movimento reduzido sem
      // afetar isto aqui.
      holdTimer = setTimeout(() => {
        onUnlock?.()
        renderMain()
      }, HOLD_MS)
    }

    function cancelHold() {
      clearTimeout(holdTimer)
      holdTimer = null
      holdBtn.classList.remove('is-holding')
    }

    holdBtn.addEventListener('pointerdown', startHold)
    holdBtn.addEventListener('pointerup', cancelHold)
    holdBtn.addEventListener('pointerleave', cancelHold)
    holdBtn.addEventListener('pointercancel', cancelHold)
    // Teclado: mesma lógica de segurar, pra quem navega sem toque.
    holdBtn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !holdTimer) startHold()
    })
    holdBtn.addEventListener('keyup', cancelHold)
  }

  function renderMain() {
    view = 'main'
    disconnectStatus = 'idle'

    const helpSection = `
      <button class="guardian-help__toggle" type="button" id="guardian-help-toggle" aria-expanded="${helpOpen}">
        <span class="guardian-action__icon" aria-hidden="true">${LIFE_BUOY_SVG}</span>
        <span class="guardian-action__copy">
          <strong>Ajuda e contato</strong>
          <span>Como o pareamento e os dados funcionam</span>
        </span>
        <span class="guardian-help__chevron${helpOpen ? ' is-open' : ''}" aria-hidden="true">${CHEVRON_SVG}</span>
      </button>
      ${
        helpOpen
          ? `
        <div class="guardian-help__body">
          <p>
            O código de pareamento conecta este aparelho a UMA criança por vez. Ele vale por
            10 minutos e só pode ser usado uma vez.
          </p>
          <p>
            Os dados da jornada (progresso, missões, execuções) ficam guardados na conta do
            tutor/responsável que acompanha essa criança — este aparelho só exibe o que já
            está liberado pra ela.
          </p>
          <p>
            Pra gerenciar todos os aparelhos pareados, adicionar outro tutor ou revisar dados
            com mais detalhe, use o painel do responsável no site do Cognita.
          </p>
          <p>
            Precisa falar com a equipe? Escreva pra
            <a class="guardian-help__link" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ajuda no Cognita')}">${SUPPORT_EMAIL}</a>.
          </p>
        </div>
      `
          : ''
      }
    `

    const privacyHint = PRIVACY_POLICY_URL ? 'Como tratamos os dados da família' : 'Configuração pendente'

    root.innerHTML = `
      <div class="screen screen--settings screen--guardian">
        <header class="settings-header">
          <button class="settings-header__back" type="button" aria-label="Voltar">‹</button>
          <h1 class="title">Para responsáveis</h1>
        </header>

        <div class="guardian-connected">
          <span class="guardian-connected__label">Este aparelho está conectado a</span>
          <div class="guardian-connected__child">
            <img src="${childAvatar}" alt="" />
            <strong>${escapeHtml(childName)}</strong>
          </div>
        </div>

        <div class="guardian-actions">
          <button class="guardian-action" type="button" id="guardian-switch">
            <span class="guardian-action__icon" aria-hidden="true">${REFRESH_SVG}</span>
            <span class="guardian-action__copy">
              <strong>Trocar criança</strong>
              <span>Usar um novo código de pareamento</span>
            </span>
            <span class="settings-menu-item__chevron" aria-hidden="true">${CHEVRON_SVG}</span>
          </button>

          <button class="guardian-action guardian-action--neutral" type="button" id="guardian-disconnect">
            <span class="guardian-action__icon" aria-hidden="true">${SMARTPHONE_SVG}</span>
            <span class="guardian-action__copy">
              <strong>Desconectar este aparelho</strong>
              <span>Remover o acesso deste dispositivo</span>
            </span>
            <span class="settings-menu-item__chevron" aria-hidden="true">${CHEVRON_SVG}</span>
          </button>

          <button class="guardian-action${PRIVACY_POLICY_URL ? '' : ' is-disabled'}" type="button" id="guardian-privacy" ${PRIVACY_POLICY_URL ? '' : 'disabled'}>
            <span class="guardian-action__icon" aria-hidden="true">${FILE_TEXT_SVG}</span>
            <span class="guardian-action__copy">
              <strong>Política de privacidade e termos</strong>
              <span>${privacyHint}</span>
            </span>
            <span class="settings-menu-item__chevron" aria-hidden="true">${CHEVRON_SVG}</span>
          </button>

          <div class="guardian-help">
            ${helpSection}
          </div>
        </div>

        <p class="settings-version">Versão ${escapeHtml(pkg.version)}</p>
      </div>
    `

    root.querySelector('.settings-header__back')?.addEventListener('click', () => onBack?.())
    root.querySelector('#guardian-switch')?.addEventListener('click', () => onSwitchChild?.())
    root.querySelector('#guardian-disconnect')?.addEventListener('click', () => {
      view = 'confirm-disconnect'
      renderConfirmDisconnect()
    })
    root.querySelector('#guardian-privacy')?.addEventListener('click', () => {
      if (PRIVACY_POLICY_URL) window.open(PRIVACY_POLICY_URL, '_system')
    })
    root.querySelector('#guardian-help-toggle')?.addEventListener('click', () => {
      helpOpen = !helpOpen
      renderMain()
    })
  }

  function renderConfirmDisconnect() {
    const disabled = disconnectStatus === 'disconnecting'
    const errorHtml =
      disconnectStatus === 'error'
        ? statusMessageHtml({ type: 'error', text: 'Não foi possível desconectar. Tente novamente.' })
        : ''

    root.innerHTML = `
      <div class="screen screen--settings screen--guardian">
        <header class="settings-header">
          <button class="settings-header__back" type="button" aria-label="Voltar">‹</button>
          <h1 class="title">Para responsáveis</h1>
        </header>

        <div class="guardian-confirm">
          <p class="guardian-confirm__title">Desconectar este aparelho?</p>
          <p class="guardian-confirm__body">
            Você vai precisar de um novo código de pareamento pra conectar este aparelho de
            novo.
          </p>

          ${errorHtml}

          <button class="btn-danger" type="button" id="guardian-confirm-yes" ${disabled ? 'disabled' : ''}>
            ${disconnectStatus === 'disconnecting' ? 'Desconectando...' : 'Sim, desconectar'}
          </button>
          <button class="btn-text" type="button" id="guardian-confirm-cancel" ${disabled ? 'disabled' : ''}>Cancelar</button>
        </div>
      </div>
    `

    // Voltar (físico ou seta) durante a confirmação cancela a ação, não sai
    // direto pro menu de configurações — evita que um toque sem querer no
    // botão físico já desconecte o aparelho.
    root.querySelector('.settings-header__back')?.addEventListener('click', () => renderMain())
    root.querySelector('#guardian-confirm-cancel')?.addEventListener('click', () => renderMain())
    root.querySelector('#guardian-confirm-yes')?.addEventListener('click', async () => {
      disconnectStatus = 'disconnecting'
      renderConfirmDisconnect()
      try {
        await onDisconnect?.()
        // Sucesso já navega pra tela de pareamento (app.js troca o root
        // inteiro) — nada mais a fazer aqui.
      } catch (err) {
        console.error('Erro ao desconectar aparelho:', err)
        disconnectStatus = 'error'
        renderConfirmDisconnect()
      }
    })
  }

  // Se o responsável já segurou o botão nesta mesma "sessão" da área
  // protegida (ex.: voltando de um "Cancelar" em Trocar criança), não
  // repete a fricção — o gate só existe pra barrar a CRIANÇA entrando do
  // zero, não pra irritar o adulto que acabou de provar que é adulto.
  // app.js reseta initiallyUnlocked toda vez que a pessoa sai de verdade
  // da área (onBack) ou desconecta o aparelho.
  if (initiallyUnlocked) {
    renderMain()
  } else {
    renderGate()
  }

  // Exposto só pro botão físico de voltar (app.js) saber cancelar a
  // confirmação de desconectar em vez de sair direto da tela.
  return {
    handleBack() {
      if (view === 'confirm-disconnect') {
        renderMain()
        return true
      }
      return false
    },
  }
}
