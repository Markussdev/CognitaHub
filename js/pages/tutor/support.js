import { el } from '../../lib/ui.js'

// Central Cognita: drawer global de suporte — extraído de js/pages/tutor.js.
// Suporte é utilitário global (qualquer tela pode abrir), não um recurso do
// acompanhamento de uma criança — por isso vive num slide-over, não numa
// aba. openSupportDrawer/closeSupportDrawer são autocontidos: não dependem
// de `session`, `currentDerived` nem de outro estado de tutor.js, só do DOM
// (`data-support-*`) e do `childName` recebido por parâmetro. O wiring dos
// botões fechar/backdrop do drawer roda aqui como efeito colateral do
// import — mesmo padrão de `wireRailToggle()` em js/lib/rail.js. Nada do
// comportamento mudou nesta extração — só o arquivo que contém o código.

function buildSupportDrawerContent(childName) {
  const frag = document.createDocumentFragment()

  if (childName) {
    const ctx = el('div', 'support-context')
    ctx.append(document.createTextNode('Sobre: '), el('b', null, childName))
    frag.append(ctx)
  }

  // Contato honesto: sem o formulário que não persistia (o antigo "Enviar
  // para equipe" só guardava local). Enquanto não existir fluxo de
  // support_requests, o canal real é e-mail/WhatsApp da equipe Cognita.
  frag.append(el('p', 'card-copy', 'Precisa de ajuda com o acompanhamento? Fale direto com a equipe Cognita. Tempo médio de resposta: até 48h.'))

  const contactActions = el('div', 'rec-actions')
  contactActions.style.cssText = 'gap:8px;flex-direction:column;align-items:stretch'
  const mail = el('a', 'btn btn-accent btn-sm', 'Enviar e-mail')
  mail.href = `mailto:cognitahub1@gmail.com?subject=${encodeURIComponent(childName ? `Ajuda no ciclo de ${childName}` : 'Ajuda no Cognita Hub')}`
  const whats = el('a', 'btn btn-ghost btn-sm', 'Chamar no WhatsApp')
  whats.href = 'https://wa.me/559182050907'
  whats.target = '_blank'; whats.rel = 'noopener'
  contactActions.append(mail, whats)
  frag.append(contactActions)

  return frag
}

export function openSupportDrawer(childName) {
  const body = document.querySelector('[data-support-body]')
  const drawer = document.querySelector('[data-support-drawer]')
  const backdrop = document.querySelector('[data-support-backdrop]')
  if (!body || !drawer || !backdrop) return
  body.replaceChildren(buildSupportDrawerContent(childName))
  drawer.classList.add('open')
  backdrop.classList.add('open')
  drawer.setAttribute('aria-hidden', 'false')
}

export function closeSupportDrawer() {
  document.querySelector('[data-support-drawer]')?.classList.remove('open')
  document.querySelector('[data-support-backdrop]')?.classList.remove('open')
  document.querySelector('[data-support-drawer]')?.setAttribute('aria-hidden', 'true')
}

document.querySelector('[data-support-close]')?.addEventListener('click', closeSupportDrawer)
document.querySelector('[data-support-backdrop]')?.addEventListener('click', closeSupportDrawer)
