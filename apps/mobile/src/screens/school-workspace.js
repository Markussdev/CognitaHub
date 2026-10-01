import '../styles/school.css'

// Recortes reais das telas da demo (painel do mediador e da família), não
// prints da tela inteira — mostram só a parte que conta a história.
import tutorPreview from '../assets/school/mediador-preview.png'
import familyPreview from '../assets/school/familia-preview.png'
import revenuecatLogo from '../assets/school/revenuecat.png'
import childAvatar from '../assets/avatars/astronauta.webp'
import { setSchoolBack } from '../demo/school-back.js'

// Vitrine do que a licença institucional (Cognita Escola) habilita — não cria
// criança, tutor, ciclo nem jornada. Os cards do mediador e da família abrem
// demos locais (demo/), sem Supabase. "Open child experience" é o único
// ponto que pode sair desse demo isolado e entrar no app real (ver
// onOpenChild em school-license.js, que só importa app.js/Supabase nesse
// clique, e só sem VITE_SHIPATON_CHILD_DEMO). "Open school dashboard" abre a
// visão da escola (demo/demo-school.js), também local e fictícia.
export function renderSchoolWorkspace(
  root,
  { priceString = '', onBack, onOpenSchool, onOpenTutor, onOpenChild, onOpenFamily } = {},
) {
  setSchoolBack(() => onBack?.())

  root.innerHTML = `
    <div class="school-workspace">
      <header class="school-workspace__hero">
        <button class="school-workspace__back" type="button" aria-label="Back" data-school-back>‹</button>

        <span class="school-workspace__eyebrow">Cognita for Schools</span>
        <h1>Ecosystem enabled</h1>
        <p>One institutional license connects guidance, learning, and ongoing support.</p>

        <div class="school-license-card">
          <div>
            <span class="school-license-card__status">● License active</span>
            <strong>Institutional access</strong>
            <small>${priceString ? `${priceString} / month · ` : ''}demo pricing</small>
          </div>
          <span class="school-license-card__check">✓</span>
        </div>
      </header>

      <main class="school-workspace__content">
        <section class="school-surface school-surface--overview">
          <div class="school-surface__body">
            <div>
              <span class="school-surface__role">School</span>
              <h3>School overview</h3>
              <p>Students · tutors · active journeys, across a demonstration school.</p>
            </div>
          </div>
          <button class="school-surface__cta" type="button" data-open-school>
            Open school dashboard
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-intro">
          <span class="school-section-label">The product</span>
          <h2>One license. Three connected experiences.</h2>
          <p>Institutions support the full learning cycle without putting accessibility features behind a family subscription.</p>
        </section>

        <section class="school-surface">
          <figure class="school-preview">
            <img src="${tutorPreview}" alt="Tutor dashboard: preparing an activity in three steps — experience, settings, and review." />
          </figure>
          <div class="school-surface__body">
            <span class="school-surface__number">01</span>
            <div>
              <span class="school-surface__role">Tutor</span>
              <h3>Plan and guide</h3>
              <p>Build journeys, prepare activities, and record observations.</p>
            </div>
          </div>
          <button class="school-surface__cta" type="button" data-open-tutor>
            Open tutor experience
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-surface school-surface--child">
          <div class="school-child-visual">
            <img class="school-child-visual__avatar" src="${childAvatar}" alt="" />
            <div>
              <strong>Child experience</strong>
              <span>Android · interactive · configurable</span>
            </div>
          </div>
          <div class="school-surface__body">
            <span class="school-surface__number">02</span>
            <div>
              <span class="school-surface__role">Child</span>
              <h3>Explore and learn</h3>
              <p>Completes math activities in visual journeys with individual settings.</p>
            </div>
          </div>
          <button class="school-child-cta" type="button" data-open-child>
            Open child experience
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-surface">
          <figure class="school-preview">
            <img src="${familyPreview}" alt="Family dashboard: the tutor's latest feedback and what comes next." />
          </figure>
          <div class="school-surface__body">
            <span class="school-surface__number">03</span>
            <div>
              <span class="school-surface__role">Family</span>
              <h3>Follow progress with context</h3>
              <p>Receives guided feedback and follows the journey clearly — without seeing the tutor's internal notes.</p>
            </div>
          </div>
          <button class="school-surface__cta" type="button" data-open-family>
            Open family experience
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-flow">
          <span class="school-section-label">The cycle</span>
          <h2>What happens after an activity?</h2>
          <div class="school-flow__steps">
            <span>Prepare</span>
            <b>→</b>
            <span>Experience</span>
            <b>→</b>
            <span>Observe</span>
            <b>→</b>
            <span>Share feedback</span>
            <b>→</b>
            <span>Adapt</span>
          </div>
        </section>

        <section class="school-revenue">
          <img class="school-revenue__logo" src="${revenuecatLogo}" alt="RevenueCat" />
          <div>
            <strong>Institutional access</strong>
            <small>Entitlement: school_access · recurring license</small>
          </div>
        </section>

        <p class="school-disclaimer">Demo pricing, not commercially validated.</p>
      </main>
    </div>
  `

  root.querySelector('[data-school-back]')?.addEventListener('click', () => onBack?.())
  root.querySelector('[data-open-school]')?.addEventListener('click', () => onOpenSchool?.())
  root.querySelector('[data-open-tutor]')?.addEventListener('click', () => onOpenTutor?.())
  root.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
  root.querySelector('[data-open-family]')?.addEventListener('click', () => onOpenFamily?.())
}
