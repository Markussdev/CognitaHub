const storageKey = "cognitahub-focus-mode";
const sessionStorageKey = "cognitahub-latest-session";
const childSignupStorageKey = "cognitahub-child-signup";

function setFocusMode(enabled) {
  document.body.classList.toggle("focus-mode", enabled);
  document.querySelectorAll("[data-focus-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(enabled));
    // se houver um label dedicado, não sobrescreve a estrutura interna (ex: bolinha do toggle)
    const label = button.querySelector("[data-focus-label]") || button;
    label.textContent = enabled ? "Modo Foco ativo" : "Modo Foco";
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

function setupFloatingHeader() {
  const header = document.querySelector(".header-floating");
  const toggle = header?.querySelector("[data-menu-toggle]");

  if (!header || !toggle) return;

  const syncToggle = () => {
    toggle.style.display = window.innerWidth <= 920 ? "inline-grid" : "none";
  };

  syncToggle();
  window.addEventListener("resize", syncToggle);

  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 80);
  }, { passive: true });
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

function setupHubTabs() {
  const tabs = document.querySelectorAll("[data-hub-tab]");
  const panels = document.querySelectorAll("[data-hub-panel]");

  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.hubTab;

      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        const active = panel.dataset.hubPanel === target;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    });
  });
}

function setupActivityFilter() {
  const tabs = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll("[data-card-filter]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const filter = tab.dataset.filter;

      tabs.forEach((item) => item.classList.toggle("active", item === tab));

      cards.forEach((card) => {
        const filters = card.dataset.cardFilter.split(" ");
        card.hidden = filter !== "todos" && !filters.includes(filter);
      });
    });
  });
}

function getMockValue(path) {
  if (!window.cognitaMock) return null;

  return path.split(".").reduce((current, key) => current?.[key], window.cognitaMock);
}

function setupMockData() {
  document.querySelectorAll("[data-mock]").forEach((element) => {
    const value = getMockValue(element.dataset.mock);

    if (value !== null && value !== undefined) {
      element.textContent = value;
    }
  });

  document.querySelectorAll("[data-mock-width]").forEach((element) => {
    const value = getMockValue(element.dataset.mockWidth);

    if (value) {
      element.style.width = value;
    }
  });

  document.querySelectorAll("[data-mock-aria]").forEach((element) => {
    const value = getMockValue(element.dataset.mockAria);

    if (value) {
      element.setAttribute("aria-label", value);
    }
  });
}

function getLatestSession() {
  const fallback = {
    topic: getMockValue("sessaoAtual.registro") || "Soma com objetos e cartoes visuais.",
    engagement: "4",
    difficulty: "2",
    result: "Avancou com apoio",
    notes: getMockValue("observacaoTutor.texto") || "Respondeu melhor com objetos do cotidiano.",
    nextStep: getMockValue("atividadeSugerida.descricao") || "Comparar quantidades com objetos da casa.",
  };

  try {
    return {
      ...fallback,
      ...JSON.parse(localStorage.getItem(sessionStorageKey) || "{}"),
    };
  } catch {
    return fallback;
  }
}

function syncLatestSession() {
  const session = getLatestSession();

  document.querySelectorAll("[data-session-output]").forEach((element) => {
    const value = session[element.dataset.sessionOutput];

    if (value !== null && value !== undefined && value !== "") {
      element.textContent = value;
    }
  });
}

function setupSessionForm() {
  const form = document.querySelector("[data-session-form]");
  if (!form) {
    syncLatestSession();
    return;
  }

  // §12: o formulário de registro começa vazio (não pré-preenchido).
  // O card "última sessão salva" abaixo continua refletindo o último
  // registro via syncLatestSession() — a fonte é o localStorage, não o form.
  syncLatestSession();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const session = {
      childId: "child_joao",
      cycleId: "cycle_joao_maria",
      topic: formData.get("topic"),
      engagement: formData.get("engagement"),
      difficulty: formData.get("difficulty"),
      result: formData.get("result"),
      notes: formData.get("notes"),
      nextStep: formData.get("nextStep"),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    syncLatestSession();

    const feedback = form.querySelector("[data-session-feedback]");
    if (feedback) {
      feedback.textContent = "Registro salvo. O painel do responsavel e o perfil da crianca ja refletem esta sessao.";
    }
  });
}

function setupMoodOptions() {
  document.querySelectorAll("[data-mood-group]").forEach((group) => {
    const form = group.closest("form");

    group.querySelectorAll("[data-mood-value]").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("[data-mood-value]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        if (!form) return;

        if (form.elements.result) form.elements.result.value = button.dataset.moodValue;
        if (form.elements.engagement) form.elements.engagement.value = button.dataset.engagement;
        if (form.elements.difficulty) form.elements.difficulty.value = button.dataset.difficulty;
      });
    });
  });
}

function getSavedChildSignup() {
  const fallback = {
    child: {
      name: "Lia Costa",
      age: "9 anos",
      status: "waiting_review",
    },
    learningProfile: {
      mathDifficulties: "problemas simples do cotidiano e geometria basica.",
      preferredFormats: ["objetos-concretos", "jogos"],
      attentionSpan: "5 a 10 minutos",
      motivators: "desenhos, blocos e desafios curtos",
      difficultContent: ["comparar-quantidades", "formas-geometricas"],
    },
  };

  try {
    return {
      ...fallback,
      ...JSON.parse(localStorage.getItem(childSignupStorageKey) || "{}"),
    };
  } catch {
    return fallback;
  }
}

function syncChildSignup() {
  const signup = getSavedChildSignup();
  const values = {
    name: signup.child?.name,
    age: signup.child?.age,
    mathDifficulties: signup.learningProfile?.mathDifficulties,
    attentionSpan: signup.learningProfile?.attentionSpan,
    motivators: signup.learningProfile?.motivators,
  };

  document.querySelectorAll("[data-child-signup-output]").forEach((element) => {
    const value = values[element.dataset.childSignupOutput];
    if (value) element.textContent = value;
  });
}

function setupChildSignupForm() {
  const form = document.querySelector("[data-child-signup-form]");

  if (!form) {
    syncChildSignup();
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const childName = formData.get("crianca-nome") || "Crianca em analise";
    const childAge = formData.get("idade-crianca") || "Idade nao informada";

    const signup = {
      child: {
        id: `child_${String(childName).toLowerCase().replace(/\W+/g, "_")}`,
        guardianName: formData.get("responsavel-nome"),
        guardianEmail: formData.get("responsavel-email"),
        name: childName,
        age: childAge,
        schoolYear: formData.get("etapa-escolar"),
        status: "waiting_review",
        createdAt: new Date().toISOString(),
      },
      learningProfile: {
        mathDifficulties: formData.get("dificuldades"),
        preferredFormats: formData.getAll("aprende-melhor"),
        attentionSpan: formData.get("tempo-concentracao"),
        motivators: formData.get("motivadores"),
        avoidances: formData.get("dificultadores"),
        difficultContent: formData.getAll("conteudos-dificeis"),
        supportContext: formData.get("acompanhamento"),
      },
    };

    localStorage.setItem(childSignupStorageKey, JSON.stringify(signup));

    const feedback = form.querySelector("[data-form-feedback]");
    if (feedback) {
      feedback.textContent = "Cadastro salvo no mock. O painel admin ja pode analisar esta crianca.";
    }
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

function setupLoginRouting() {
  const form = document.querySelector("[data-login-form]");
  const buttons = document.querySelectorAll("[data-login-role]");

  if (!form || !buttons.length) return;

  let selectedRole = "responsavel";
  const routes = {
    responsavel: "responsavel.html",
    tutor: "tutor.html",
    equipe: "admin.html",
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.loginRole;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = routes[selectedRole];
  });
}

function setupFeatureAccordion() {
  document.querySelectorAll(".hub-feature-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const desc = btn.nextElementSibling;
      const isExpanded = btn.getAttribute("aria-expanded") === "true";

      btn.closest(".hub-feature-list").querySelectorAll(".hub-feature-btn").forEach((other) => {
        if (other !== btn) {
          other.setAttribute("aria-expanded", "false");
          const otherDesc = other.nextElementSibling;
          if (otherDesc) otherDesc.hidden = true;
        }
      });

      btn.setAttribute("aria-expanded", String(!isExpanded));
      if (desc) desc.hidden = isExpanded;
    });
  });
}

function setupLoginRoleTabs() {
  const groups = document.querySelectorAll(".login-role-tabs");
  groups.forEach((group) => {
    const buttons = group.querySelectorAll(".login-role");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
  });
}

function setupSidebarNav() {
  const navs = document.querySelectorAll(".sidebar-nav, .bottom-nav");
  if (!navs.length) return;
  if (document.querySelector(".admin-page")) return;

  const allLinks = [...navs].flatMap((nav) => [...nav.querySelectorAll("a[href^='#']")]);
  if (!allLinks.length) return;

  const sectionIds = [...new Set(allLinks.map((a) => a.getAttribute("href").slice(1)))];
  const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return;

  const setActive = (id) => {
    navs.forEach((nav) => {
      nav.querySelectorAll("a").forEach((link) => {
        const href = link.getAttribute("href");
        const isMatch = id ? href === `#${id}` : href === "responsavel.html";
        link.classList.toggle("active", isMatch);
      });
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { threshold: 0.3 }
  );

  sections.forEach((s) => observer.observe(s));

  window.addEventListener("scroll", () => {
    const anyVisible = sections.some((s) => {
      const rect = s.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.7 && rect.bottom > 0;
    });
    if (!anyVisible) setActive(null);
  }, { passive: true });
}

function setupAdminFilters() {
  const filters = document.querySelectorAll("[data-admin-filter]");
  const navs = document.querySelectorAll(".sidebar-nav, .bottom-nav");
  const navLinks = [...navs].flatMap((nav) => [...nav.querySelectorAll("a[href^='#']")]);

  if (!filters.length && !navLinks.length) return;

  const stageFromTarget = (targetId) => {
    const target = document.getElementById(targetId);
    return target?.closest(".pipeline-col")?.id || targetId || "triagem";
  };

  const setAdminActive = (stage, activeFilter) => {
    const defaultFilter =
      activeFilter ||
      [...filters].find((filter) => filter.dataset.adminFilter === stage && !filter.dataset.adminFocus) ||
      [...filters].find((filter) => filter.dataset.adminFilter === stage);

    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${stage}`);
    });

    filters.forEach((filter) => {
      const active = filter === defaultFilter;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
  };

  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      const targetId = filter.dataset.adminFocus || filter.dataset.adminFilter;
      const target = document.getElementById(targetId);
      const stage = stageFromTarget(targetId);

      setAdminActive(stage, filter);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const stage = link.getAttribute("href").slice(1);
      setAdminActive(stage);
    });
  });

  const initialStage = window.location.hash ? stageFromTarget(window.location.hash.slice(1)) : "triagem";
  setAdminActive(initialStage);
}

function setupSideDrawers() {
  const drawers = document.querySelectorAll("[data-drawer]");
  const backdrop = document.querySelector(".drawer-backdrop");
  if (!drawers.length || !backdrop) return;

  const closeDrawers = () => {
    drawers.forEach((drawer) => {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    });

    backdrop.hidden = true;
    document.body.classList.remove("drawer-open");
  };

  document.querySelectorAll("[data-drawer-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(`[data-drawer="${button.dataset.drawerOpen}"]`);
      if (!target) return;

      drawers.forEach((drawer) => {
        const active = drawer === target;
        drawer.classList.toggle("is-open", active);
        drawer.setAttribute("aria-hidden", String(!active));
      });

      backdrop.hidden = false;
      document.body.classList.add("drawer-open");
      target.querySelector("[data-drawer-close]")?.focus();
    });
  });

  document.querySelectorAll("[data-drawer-close]").forEach((button) => {
    button.addEventListener("click", closeDrawers);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawers();
  });
}

setupFocusMode();
setupFloatingHeader();
setupMobileMenu();
setupRoleTabs();
setupHubTabs();
setupLoginRoleTabs();
setupActivityFilter();
setupLoginRouting();
setupMockData();
setupSessionForm();
setupChildSignupForm();
setupMoodOptions();
setupFakeForms();
setupFeatureAccordion();
setupSidebarNav();
setupAdminFilters();
setupSideDrawers();
