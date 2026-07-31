import { supabase } from './supabase.js'

// Nome do aparelho pra família diferenciar um do outro na lista de
// dispositivos conectados (painel do responsável) — não pede nada à
// criança, só lê o user-agent do navegador.
function generateDeviceName() {
  const ua = navigator.userAgent || ''

  const browser = ua.includes('Edg/') ? 'Edge'
    : (ua.includes('OPR/') || ua.includes('Opera')) ? 'Opera'
    : ua.includes('Chrome/') ? 'Chrome'
    : ua.includes('Firefox/') ? 'Firefox'
    : (ua.includes('Safari/') && !ua.includes('Chrome')) ? 'Safari'
    : null

  const os = ua.includes('Windows') ? 'Windows'
    : /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : ua.includes('Android') ? 'Android'
    : ua.includes('Mac OS X') ? 'Mac'
    : ua.includes('Linux') ? 'Linux'
    : /iPod/.test(ua) ? 'iOS'
    : null

  const androidModel = ua.match(/Android [\d.]+;\s*([^;)]+)\)/)?.[1]?.trim()
  if (androidModel && !/^(k|wv|build\/)/i.test(androidModel)) return androidModel

  if (browser && os) return `${browser} no ${os}`
  if (browser) return browser
  if (os) return `Aplicativo ${os}`
  return null
}

// Exige sessão anônima ativa (a RPC checa is_anonymous=true no JWT).
// deviceName default chama generateDeviceName() a cada invocação (não
// memoizado) — assim qualquer chamador que esquecer de passar um nome
// ainda assim grava algo legível, em vez de null ("Dispositivo sem nome").
export async function claimPairingCode(code, deviceName = generateDeviceName()) {
  const { data, error } = await supabase.rpc('claim_pairing_code', {
    p_code: code,
    p_device_name: deviceName,
  })
  if (error) throw error
  return data // child_id
}

// null quando a sessão atual não está pareada (nunca pareou ou foi
// revogada) — a RPC não distingue os dois casos, então o app trata os
// dois mostrando a tela de código de novo.
//
// v2 soma nome_exibicao/avatar_key (perfil escolhido pela criança) ao
// contexto original — mantém o nome JS antigo pra o resto do app não
// precisar saber qual versão da RPC está por trás.
export async function getPairedChildContext() {
  const { data, error } = await supabase.rpc('get_paired_child_context_v2')
  if (error) throw error
  return data?.[0] ?? null
}

// Revoga só o vínculo ativo do dispositivo autenticado atual (revoked_at =
// now(), não apaga registro nem criança) — depois disso
// getPairedChildContext() volta a retornar null. Não faz signOut(): a
// sessão anônima do dispositivo continua a mesma, só sem criança pareada.
export async function unpairCurrentDevice() {
  const { data, error } = await supabase.rpc('unpair_current_device')
  if (error) throw error
  return Boolean(data)
}
