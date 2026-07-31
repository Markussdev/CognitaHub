// Normaliza o telefone mascarado ((00) 00000-0000) para E.164 (+55...) —
// formato padrão pra a equipe conseguir usar o número em qualquer canal
// (WhatsApp, SMS, chamada) sem reformatar depois. Só Brasil por enquanto —
// a máscara do formulário já é BR-only. Telefone é opcional: string vazia
// vira null, nunca "+55" sozinho.
export function phoneToE164(masked) {
  const digits = String(masked || '').replace(/\D/g, '')
  if (!digits) return null
  return `+55${digits}`
}
