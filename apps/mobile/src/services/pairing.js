import { supabase } from './supabase.js'

// Exige sessão anônima ativa (a RPC checa is_anonymous=true no JWT).
export async function claimPairingCode(code, deviceName = null) {
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
