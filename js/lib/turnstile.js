// Widget Cloudflare Turnstile — só a site key aqui (pública por natureza).
// A secret key NUNCA entra em código client-side: fica configurada no
// Dashboard do Supabase (Authentication → Attack Protection), que verifica
// o captchaToken no servidor quando signInAnonymously({ options: { captchaToken } })
// é chamado. Ver docs/supabase-fase-13-pareamento-dispositivo.sql.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptPromise = null

function loadScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar a verificação de segurança.'))
    document.head.append(script)
  })
  return scriptPromise
}

// Renderiza o widget dentro de `container` e devolve uma Promise que
// resolve com o token quando o desafio é concluído. Cada chamada renderiza
// uma instância nova — o container deve estar vazio antes de chamar de novo
// numa nova tentativa.
export async function solveTurnstile(container, siteKey) {
  if (!siteKey) {
    throw new Error('Verificação de segurança não configurada (falta VITE_TURNSTILE_SITE_KEY).')
  }
  await loadScript()
  return new Promise((resolve, reject) => {
    window.turnstile.render(container, {
      sitekey: siteKey,
      callback: (token) => resolve(token),
      'error-callback': () => reject(new Error('Falha na verificação de segurança. Tente de novo.')),
      'expired-callback': () => reject(new Error('Verificação expirou. Tente de novo.')),
    })
  })
}
