import { supabase } from '../lib/supabase.js'

// Consentimento versionado por documento — convive com a tabela `consents`
// antiga (ainda escrita direto por submitGuardianRegistration, ver
// js/data/signup.js) até decidirmos migrar/backfillar e desativá-la.
// Nada aqui substitui `consents` hoje; é escrita em paralelo.
//
// Schema assumido (o SQL fica por sua conta):
//   legal_documents   ( id, document_key, version, audience, is_active )
//   legal_acceptances ( id, user_id, child_id, legal_document_id, source, accepted_at )
// Cada linha de legal_acceptances aponta pro ID da VERSÃO aceita — se um
// documento for republicado (nova linha em legal_documents, is_active=true,
// a antiga vira false), o aceite antigo continua provando exatamente qual
// versão a pessoa realmente leu, mesmo depois do texto mudar.

export async function getActiveLegalDocuments(audience) {
  return supabase
    .from('legal_documents')
    .select('id, document_key, version, audience')
    .eq('audience', audience)
    .eq('is_active', true)
}

// documentKeys: lista de chaves estáveis (ex.: 'privacy_policy',
// 'terms_of_use', 'child_data_processing') — a função resolve pra versão
// ATIVA de cada uma na hora do aceite, nunca uma versão vindo do cliente.
// audience é obrigatório: privacy_policy/terms_of_use existem em versões
// separadas pra guardian e tutor — sem filtrar por público, um aceite de
// tutor podia acabar gravando a versão do documento do responsável (mesma
// document_key, audience errada).
// childId é opcional (null pra aceite de tutor, sem criança envolvida).
export async function recordLegalAcceptances({ userId, childId = null, documentKeys, source, audience }) {
  if (!userId) return { error: new Error('userId é obrigatório para registrar aceite.') }
  if (!documentKeys?.length) return { error: new Error('Nenhum documento informado para aceite.') }
  if (!['guardian', 'tutor'].includes(audience)) {
    return { error: new Error('Público jurídico inválido.') }
  }

  const uniqueKeys = [...new Set(documentKeys)]

  const { data: documents, error: documentsError } = await supabase
    .from('legal_documents')
    .select('id, document_key')
    .in('document_key', uniqueKeys)
    .eq('audience', audience)
    .eq('is_active', true)

  if (documentsError) return { error: documentsError }

  const missing = uniqueKeys.filter((key) => !documents?.some((d) => d.document_key === key))
  if (missing.length) {
    return { error: new Error(`Sem versão ativa cadastrada para: ${missing.join(', ')}`) }
  }

  let existingQuery = supabase
    .from('legal_acceptances')
    .select('legal_document_id')
    .eq('user_id', userId)
    .in('legal_document_id', documents.map((doc) => doc.id))
    .is('revoked_at', null)
  existingQuery = childId
    ? existingQuery.eq('child_id', childId)
    : existingQuery.is('child_id', null)

  const { data: existing, error: existingError } = await existingQuery
  if (existingError) return { error: existingError }

  const existingIds = new Set((existing ?? []).map((row) => row.legal_document_id))
  const missingDocuments = documents.filter((doc) => !existingIds.has(doc.id))

  // Um insert por documento torna o retry parcial seguro: se o primeiro
  // aceite salvar e o segundo falhar, a próxima tentativa insere só o que
  // falta. Uma colisão por corrida também é tratada como já concluída.
  for (const doc of missingDocuments) {
    const { error } = await supabase.from('legal_acceptances').insert({
      user_id: userId,
      child_id: childId,
      legal_document_id: doc.id,
      source,
      accepted_at: new Date().toISOString(),
    })
    if (error && error.code !== '23505') return { error }
  }

  let verificationQuery = supabase
    .from('legal_acceptances')
    .select('legal_document_id')
    .eq('user_id', userId)
    .in('legal_document_id', documents.map((doc) => doc.id))
    .is('revoked_at', null)
  verificationQuery = childId
    ? verificationQuery.eq('child_id', childId)
    : verificationQuery.is('child_id', null)

  const { data: verified, error: verificationError } = await verificationQuery
  if (verificationError) return { error: verificationError }

  const verifiedIds = new Set((verified ?? []).map((row) => row.legal_document_id))
  const notRecorded = documents.filter((doc) => !verifiedIds.has(doc.id))
  if (notRecorded.length) {
    return { error: new Error('Nem todos os aceites foram registrados. Tente novamente.') }
  }

  return { recorded: missingDocuments.length }
}
