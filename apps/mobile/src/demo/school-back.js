import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Botão físico de voltar do Android dentro da vitrine Cognita Escola. app.js
// (que trata o voltar do fluxo conectado) nem é carregado aqui, então sem isto
// um toque no voltar fecharia o app no meio da avaliação.
//
// Cada tela da vitrine diz pra onde o voltar vai com setSchoolBack() — o mesmo
// destino da seta "voltar" dela. Um único listener, registrado uma vez: telas
// novas só trocam a função atual. setSchoolBack(null) desliga a vitrine ao
// entrar no fluxo conectado, onde o listener do app.js assume.
let currentBack = null
let listening = false

export function handleSchoolBack() {
  currentBack?.()
}

export function setSchoolBack(onBack) {
  currentBack = onBack ?? null

  // No navegador o plugin não dispara backButton — nada a registrar.
  if (listening || !Capacitor.isNativePlatform()) return
  listening = true
  App.addListener('backButton', handleSchoolBack)
}

// Primeira tela da vitrine (licença): não há pra onde voltar, então confirma
// antes de sair — o mesmo texto de app.js na tela de módulos.
export function confirmExitCognita() {
  if (window.confirm('Exit Cognita?')) App.exitApp()
}
