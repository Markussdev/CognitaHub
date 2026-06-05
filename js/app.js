const storageKey = "cognitahub-focus-mode";

function setFocusMode(enabled) {
  document.body.classList.toggle("focus-mode", enabled);
  document.querySelectorAll("[data-focus-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Modo Foco ativo" : "Modo Foco";
  });
  localStorage.setItem(storageKey, enabled ? "1" : "0");
}

function setupFocusMode() {
  const saved = localStorage.getItem(storageKey) === "1";
  setFocusMode(saved);

  document.querySelectorAll("[data-focus-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      setFocusMode(!document.body.classList.contains("focus-mode"));
    });
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-nav]");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupRoleTabs() {
  const tabs = document.querySelectorAll("[data-role-tab]");
  const panels = document.querySelectorAll("[data-role-panel]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const role = tab.dataset.roleTab;

      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.rolePanel === role);
      });
    });
  });
}

function setupSignupTabs() {
  const tabs = document.querySelectorAll("[data-signup-tab]");
  const panels = document.querySelectorAll("[data-signup-panel]");

  if (!tabs.length) return;

  const activatePanel = (target) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.signupTab === target;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.signupPanel === target);
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activatePanel(tab.dataset.signupTab));
  });

  if (window.location.hash === "#profissional") {
    activatePanel("profissional");
  }
}

function setupActivityFilter() {
  const tabs = document.querySelectorAll("[data-grade]");
  const cards = document.querySelectorAll("[data-card-grade]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const grade = tab.dataset.grade;

      tabs.forEach((item) => item.classList.toggle("active", item === tab));

      cards.forEach((card) => {
        const grades = card.dataset.cardGrade.split(" ");
        card.hidden = grade !== "todos" && !grades.includes(grade);
      });
    });
  });
}

function setupFakeForms() {
  document.querySelectorAll("[data-static-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const feedback = form.querySelector("[data-form-feedback]");
      if (feedback) {
        feedback.textContent = "Layout pronto. A integração do envio entra na próxima etapa.";
      }
    });
  });
}

setupFocusMode();
setupMobileMenu();
setupRoleTabs();
setupSignupTabs();
setupActivityFilter();
setupFakeForms();
