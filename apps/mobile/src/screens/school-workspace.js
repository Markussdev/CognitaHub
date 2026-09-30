import '../styles/school.css'

// Recortes reais das telas da demo (painel do mediador e da família), não
// prints da tela inteira — mostram só a parte que conta a história.
import tutorPreview from '../assets/school/mediador-preview.png'
import familyPreview from '../assets/school/familia-preview.png'
import revenuecatLogo from '../assets/school/revenuecat.png'
import childAvatar from '../assets/avatars/astronauta.webp'

// Vitrine do que a licença institucional (Cognita Escola) habilita — não cria
// criança, tutor, ciclo nem jornada. Os cards do mediador e da família abrem
// demos locais (demo/), sem Supabase. "Abrir experiência da criança" é o único
// ponto que pode sair desse demo isolado e entrar no app real (ver
// onOpenChild em school-license.js, que só importa app.js/Supabase nesse
// clique, e só sem VITE_SHIPATON_CHILD_DEMO).
export function renderSchoolWorkspace(root, { priceString = '', onBack, onOpenTutor, onOpenChild, onOpenFamily } = {}) {
  root.innerHTML = `
    <div class="school-workspace">
      <header class="school-workspace__hero">
        <button class="school-workspace__back" type="button" aria-label="Voltar" data-school-back>‹</button>

        <span class="school-workspace__eyebrow">Cognita Escola</span>
        <h1>Ecossistema habilitado</h1>
        <p>Uma licença institucional conecta as experiências de mediação, aprendizagem e acompanhamento.</p>

        <div class="school-license-card">
          <div>
            <span class="school-license-card__status">● Licença ativa</span>
            <strong>Acesso institucional</strong>
            <small>${priceString ? `${priceString} / mês · ` : ''}piloto demonstrativo</small>
          </div>
          <span class="school-license-card__check">✓</span>
        </div>
      </header>

      <main class="school-workspace__content">
        <section class="school-intro">
          <span class="school-section-label">O produto</span>
          <h2>Uma licença. Três experiências conectadas.</h2>
          <p>A instituição apoia o ciclo completo sem colocar recursos de acessibilidade atrás de uma assinatura familiar.</p>
        </section>

        <section class="school-surface">
          <figure class="school-preview">
            <img src="${tutorPreview}" alt="Painel do mediador: preparo de uma atividade em três passos — experiência, ajustes e revisão." />
          </figure>
          <div class="school-surface__body">
            <span class="school-surface__number">01</span>
            <div>
              <span class="school-surface__role">Mediador</span>
              <h3>Prepara e acompanha</h3>
              <p>Organiza jornadas, prepara atividades e registra observações.</p>
            </div>
          </div>
          <button class="school-surface__cta" type="button" data-open-tutor>
            Abrir experiência do mediador
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-surface school-surface--child">
          <div class="school-child-visual">
            <img class="school-child-visual__avatar" src="${childAvatar}" alt="" />
            <div>
              <strong>Experiência da criança</strong>
              <span>Android · interativa · configurável</span>
            </div>
          </div>
          <div class="school-surface__body">
            <span class="school-surface__number">02</span>
            <div>
              <span class="school-surface__role">Criança</span>
              <h3>Explora e aprende</h3>
              <p>Realiza experiências matemáticas dentro de jornadas visuais com configurações individuais.</p>
            </div>
          </div>
          <button class="school-child-cta" type="button" data-open-child>
            Abrir experiência da criança
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-surface">
          <figure class="school-preview">
            <img src="${familyPreview}" alt="Painel da família: última devolutiva do tutor e o que vem agora." />
          </figure>
          <div class="school-surface__body">
            <span class="school-surface__number">03</span>
            <div>
              <span class="school-surface__role">Família</span>
              <h3>Acompanha com contexto</h3>
              <p>Recebe devolutivas guiadas e acompanha a jornada com clareza — sem ver as anotações internas do mediador.</p>
            </div>
          </div>
          <button class="school-surface__cta" type="button" data-open-family>
            Abrir experiência da família
            <span aria-hidden="true">→</span>
          </button>
        </section>

        <section class="school-flow">
          <span class="school-section-label">O ciclo</span>
          <h2>O que acontece depois de uma atividade?</h2>
          <div class="school-flow__steps">
            <span>Preparar</span>
            <b>→</b>
            <span>Experiência</span>
            <b>→</b>
            <span>Observar</span>
            <b>→</b>
            <span>Devolver</span>
            <b>→</b>
            <span>Adaptar</span>
          </div>
        </section>

        <section class="school-revenue">
          <img class="school-revenue__logo" src="${revenuecatLogo}" alt="RevenueCat" />
          <div>
            <strong>Acesso institucional</strong>
            <small>Entitlement: school_access · licença recorrente</small>
          </div>
        </section>

        <p class="school-disclaimer">Preço piloto demonstrativo, sem validação comercial.</p>
      </main>
    </div>
  `

  root.querySelector('[data-school-back]')?.addEventListener('click', () => onBack?.())
  root.querySelector('[data-open-tutor]')?.addEventListener('click', () => onOpenTutor?.())
  root.querySelector('[data-open-child]')?.addEventListener('click', () => onOpenChild?.())
  root.querySelector('[data-open-family]')?.addEventListener('click', () => onOpenFamily?.())
}
