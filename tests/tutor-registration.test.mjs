import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateTutorRegistration,
  REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS,
} from '../js/data/tutor-registration-state.mjs'
import { buildEmailConfirmationRedirect } from '../js/lib/auth-routes.mjs'

const completeApplication = {
  birth_date: '1990-05-10',
  formation: 'ped / concluido',
  experience: 'Experiência com ensino: não informado',
  motivation: 'Quero apoiar o aprendizado.',
  weekly_availability: ['2 horas/semana', 'Tarde'],
  status: 'pending',
}

test('candidatura ausente é cadastro incompleto, não erro', () => {
  const state = evaluateTutorRegistration(null, [])
  assert.equal(state.state, 'missing')
  assert.equal(state.complete, false)
  assert.equal(state.canReview, false)
})

test('candidatura pendente só fica completa com campos e aceites', () => {
  const state = evaluateTutorRegistration(
    completeApplication,
    REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS
  )
  assert.equal(state.state, 'pending')
  assert.equal(state.complete, true)
  assert.equal(state.canReview, true)
})

test('aceite faltante mantém a candidatura incompleta', () => {
  const state = evaluateTutorRegistration(completeApplication, ['privacy_policy', 'terms_of_use'])
  assert.equal(state.state, 'incomplete')
  assert.deepEqual(state.missingLegalDocumentKeys, ['tutor_terms'])
  assert.equal(state.canReview, false)
})

test('campo obrigatório faltante bloqueia avaliação do admin', () => {
  const state = evaluateTutorRegistration(
    { ...completeApplication, motivation: '' },
    REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS
  )
  assert.equal(state.state, 'incomplete')
  assert.deepEqual(state.missingFields, ['motivação'])
  assert.equal(state.canReview, false)
})

test('segunda tentativa conclui um envio cuja candidatura já foi salva', () => {
  const firstAttempt = evaluateTutorRegistration(
    completeApplication,
    ['privacy_policy', 'terms_of_use']
  )
  assert.equal(firstAttempt.complete, false)

  const retry = evaluateTutorRegistration(
    completeApplication,
    REQUIRED_TUTOR_LEGAL_DOCUMENT_KEYS
  )
  assert.equal(retry.state, 'pending')
  assert.equal(retry.complete, true)
  assert.equal(retry.canReview, true)
})

test('decisões finais são preservadas e exibidas como finais', () => {
  for (const status of ['approved', 'rejected']) {
    const state = evaluateTutorRegistration({ status }, [])
    assert.equal(state.state, status)
    assert.equal(state.complete, true)
    assert.equal(state.canReview, false)
  }
})

test('confirmação retorna à mesma origem em localhost e na Vercel', () => {
  assert.equal(
    buildEmailConfirmationRedirect('http://localhost:5173'),
    'http://localhost:5173/pages/login.html'
  )
  assert.equal(
    buildEmailConfirmationRedirect('https://cognita-hub.vercel.app'),
    'https://cognita-hub.vercel.app/pages/login.html'
  )
})
