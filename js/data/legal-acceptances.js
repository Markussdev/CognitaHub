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
// childId é opcional (null pra aceite de tutor, sem criança envolvida).
export async function recordLegalAcceptances({ userId, childId = null, documentKeys, source }) {
  if (!userId) return { error: new Error('userId é obrigatório para registrar aceite.') }
  if (!documentKeys?.length) return { error: new Error('Nenhum documento informado para aceite.') }

  const { data: documents, error: documentsError } = await supabase
    .from('legal_documents')
    .select('id, document_key')
    .in('document_key', documentKeys)
    .eq('is_active', true)

  if (documentsError) return { error: documentsError }

  const missing = documentKeys.filter((key) => !documents?.some((d) => d.document_key === key))
  if (missing.length) {
    return { error: new Error(`Sem versão ativa cadastrada para: ${missing.join(', ')}`) }
  }

  const rows = documents.map((doc) => ({
    user_id: userId,
    child_id: childId,
    legal_document_id: doc.id,
    source,
    accepted_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('legal_acceptances').insert(rows)
  if (error) return { error }

  return {}
}
