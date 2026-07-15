import { supabase } from '../lib/supabase.js'

// Pareamento de dispositivo infantil — auth anônimo do Supabase
// (signInAnonymously) + vínculo em paired_devices, não um sistema de
// sessão paralelo. Ver docs/supabase-fase-13-pareamento-dispositivo.sql.

// Chamado pelo tutor/responsável/admin. Devolve o código já formatado
// (ex.: "7K4M-9P2D") — só existe nesse retorno, a tabela guarda só o hash.
export async function createPairingCode(childId) {
  return supabase.rpc('create_pairing_code', { p_child_id: childId })
}

// Chamado pelo dispositivo, já com uma sessão anônima ativa (signInAnonymously
// precisa ter rodado antes — a RPC exige is_anonymous=true no JWT).
export async function claimPairingCode(code, deviceName = null) {
  return supabase.rpc('claim_pairing_code', { p_code: code, p_device_name: deviceName })
}

// Devolve um array vazio quando a sessão atual não está pareada (nunca
// pareou, ou foi revogada) — não é erro, é o sinal pra mostrar a tela de
// pareamento de novo.
export async function getPairedChildContext() {
  return supabase.rpc('get_paired_child_context')
}

// Chamado pelo tutor/responsável/admin.
export async function revokePairedDevice(deviceId) {
  return supabase.rpc('revoke_paired_device', { p_device_id: deviceId })
}

// Leitura direta (RLS normal, mesmo padrão de toda outra tabela) — pra
// quando existir a tela de "dispositivos conectados" (próxima fase).
export async function listPairedDevices(childId) {
  return supabase
    .from('paired_devices')
    .select('id, device_name, paired_at, last_seen_at, revoked_at')
    .eq('child_id', childId)
    .order('paired_at', { ascending: false })
}
