// Normaliza o telefone mascarado ((00) 00000-0000) para E.164 (+55...) —
// formato padrão pra a equipe conseguir usar o número em qualquer canal
// (WhatsApp, SMS, chamada) sem reformatar depois. Só Brasil por enquanto —
// a máscara do formulário já é BR-only. Telefone é opcional: string vazia
// vira null, nunca "+55" sozinho. DDD (2 dígitos, começando 1-9) + 8 dígitos
// (fixo) ou 9 dígitos (celular) — sem isso um "(19) 123" abandonado no meio
// vazava como "+5519123" pro banco.
export function phoneToE164(masked) {
  const digits = String(masked || '').replace(/\D/g, '')
  if (!digits) return null

  if (!/^[1-9][0-9][0-9]{8,9}$/.test(digits)) {
    throw new Error('Telefone brasileiro inválido.')
  }

  return `+55${digits}`
}
