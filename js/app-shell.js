(function () {
  /* =========================================================
   * SHELL DEPENDENCIES
   * Что здесь:
   * - runtime-адаптер
   * - iframe-контейнер страниц
   * - кнопки нижней навигации
   * ========================================================= */

  const Runtime = window.AICRuntime || {
    ready() {},
    expand() {},
    hapticSelection() {},
    hapticNotify() {}
  };

  const frame = document.getElementById("pageFrame");
  const navBtns = document.querySelectorAll(".nav-btn");

  /* =========================================================
   * SHELL STATE
   * Что здесь:
   * - feature flags приложения
   * - карта страниц
   * - текущая вкладка
   * - профиль пользователя
   * - пользовательские модули
   * - статистика агента
   * - выбранный диалог агента
   * ========================================================= */

  let APPFEATURES = {
    home: true,
    myAgent: true,
    modules: true,
    sharedChat: true,
    affiliate: true,
    payments: true,
    settings: true
  };

  let PAGECONFIG = {};
  let currentTab = "home";
  let USERPROFILE = null;

  let USERMODULES = [
    {
      id: "ai-agent",
      paid: false,
      frozen: true,
      daysLeft: null
    }
  ];

  let AGENT_STATS = {
    dialogsTotal: 3,
    refLinksTotal: 4,
    dialogsToday: 2,
    refLinksToday: 1,
    dialogs: [
      {
        id: "dlg-101",
        username: "@anna_fit",
        channel: "Telegram",
        timeLabel: "17.04.2026 • 12:15",
        lastMessage: "Здравствуйте, хочу узнать про тариф с ботом-консультантом"
      },
      {
        id: "dlg-102",
        username: "@sergey_run",
        channel: "Telegram",
        timeLabel: "17.04.2026 • 11:42",
        lastMessage: "Спасибо, пришлите, пожалуйста, ссылку на оплату"
      },
      {
        id: "dlg-103",
        username: "@olga_wellness",
        channel: "Telegram",
        timeLabel: "16.04.2026 • 19:08",
        lastMessage: "Подскажите, можно ли подключить минимальную CRM на n8n"
      }
    ],
    issuedLinks: [
      {
        username: "@anna_fit",
        linkType: "Оплата тарифа Start",
        timeLabel: "17.04.2026 • 12:20"
      },
      {
        username: "@sergey_run",
        linkType: "Пробный доступ",
        timeLabel: "17.04.2026 • 11:50"
      }
    ]
  };

  let CURRENT_AGENT_DIALOG = null;

  /* =========================================================
   * USER MODULES HELPERS
   * Что здесь:
   * - нормализация user state по модулям
   * - получение списка модулей пользователя
   * - сохранение списка модулей пользователя
   * ========================================================= */

  function normalizeUserModules(modules) {
    if (!Array.isArray(modules)) return [];

    return modules
      .filter((mod) => mod && mod.id)
      .map((mod) => ({
        id: String(mod.id),
        paid: !!mod.paid,
        frozen: !!mod.frozen,
        daysLeft: typeof mod.daysLeft === "number" ? mod.daysLeft : null
      }));
  }

  function getUserModules() {
    return USERMODULES;
  }

  function setUserModules(nextModules) {
    USERMODULES = normalizeUserModules(nextModules);
    sendUserModulesToFrame();
  }

  /* =========================================================
   * AGENT STATS HELPERS
   * Что здесь:
   * - установка статистики агента
   * - получение статистики агента
   * - установка текущего выбранного диалога
   * - получение текущего выбранного диалога
   * ========================================================= */

  function setAgentStats(nextStats) {
    AGENT_STATS = {
      dialogsTotal: Number(nextStats?.dialogsTotal || 0),
      refLinksTotal: Number(nextStats?.refLinksTotal || 0),
      dialogsToday: Number(nextStats?.dialogsToday || 0),
      refLinksToday: Number(nextStats?.refLinksToday || 0),
      dialogs: Array.isArray(nextStats?.dialogs) ? nextStats.dialogs : [],
      issuedLinks: Array.isArray(nextStats?.issuedLinks) ? nextStats.issuedLinks : []
    };

    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        {
          type: "agent-stats-update",
          stats: AGENT_STATS
        },
        "*"
      );
    }
  }

  function getAgentStats() {
    return AGENT_STATS;
  }

  function setCurrentAgentDialog(dialog) {
    CURRENT_AGENT_DIALOG = dialog || null;

    if (frame && frame.contentWindow && CURRENT_AGENT_DIALOG) {
      frame.contentWindow.postMessage(
        {
          type: "agent-current-dialog",
          dialog: CURRENT_AGENT_DIALOG
        },
        "*"
      );
    }
  }

  function getCurrentAgentDialog() {
    return CURRENT_AGENT_DIALOG;
  }

  /* =========================================================
   * PAGE CONFIGURATION
   * Что здесь:
   * - единая карта вкладок и файлов страниц
   * - привязка feature flags к доступности страниц
   * ========================================================= */

  function buildPageConfig() {
    PAGECONFIG = {
      home: { page: "home.html", enabled: APPFEATURES.home },
      "my-agent": { page: "my-agent.html", enabled: APPFEATURES.myAgent },
      modules: { page: "modules.html", enabled: APPFEATURES.modules },
      "shared-chat": {
        page: "shared-chat.html",
        enabled: APPFEATURES.sharedChat
      },
      affiliate: { page: "partner.html", enabled: APPFEATURES.affiliate },
      payments: { page: "payments.html", enabled: APPFEATURES.payments },
      settings: { page: "settings.html", enabled: APPFEATURES.settings }
    };
  }

  /* =========================================================
   * NAVIGATION HELPERS
   * Что здесь:
   * - проверка доступности вкладки
   * - fallback-вкладка
   * - преобразование tab <-> page
   * ========================================================= */

  function isTabEnabled(tab) {
    return !!PAGECONFIG[tab] && !!PAGECONFIG[tab].enabled;
  }

  function getFallbackTab() {
    const fallbackOrder = ["home", "my-agent", "modules", "shared-chat", "payments"];
    return fallbackOrder.find((tab) => isTabEnabled(tab)) || "home";
  }

  function getPageByTab(tab) {
    if (!PAGECONFIG[tab]) return null;
    return PAGECONFIG[tab].page;
  }

  function getTabByPage(page) {
    for (const [tab, config] of Object.entries(PAGECONFIG)) {
      if (config.page === page) return tab;
    }
    return null;
  }

  /* =========================================================
   * SHELL -> PAGE MESSAGING
   * Что здесь:
   * - отправка профиля пользователя в страницу
   * - отправка feature flags в страницу
   * - отправка user modules в страницу
   * - единый пуш состояния shell в текущий iframe
   * ========================================================= */

  function sendUserProfileToFrame() {
    if (!frame || !frame.contentWindow || !USERPROFILE) return;

    frame.contentWindow.postMessage(
      {
        type: "user-profile",
        profile: USERPROFILE
      },
      "*"
    );
  }

  function sendUserModulesToFrame() {
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: "user-modules",
        modules: getUserModules()
      },
      "*"
    );
  }

  function sendFeaturesToFrame() {
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: "app-features",
        features: APPFEATURES
      },
      "*"
    );
  }

  function pushShellStateToFrame() {
    sendFeaturesToFrame();
    sendUserProfileToFrame();
    sendUserModulesToFrame();
  }

  /* =========================================================
   * SHELL UI STATE
   * Что здесь:
   * - скрытие/показ кнопок навигации
   * - подсветка активной вкладки
   * - скрытие badge у shared chat
   * ========================================================= */

  function updateNavVisibility() {
    navBtns.forEach((btn) => {
      const tab = btn.dataset.tab;
      const enabled = isTabEnabled(tab);
      btn.style.display = enabled ? "" : "none";
    });
  }

  function updateActiveNav() {
    navBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === currentTab);
    });
  }

  function hideSharedChatBadge() {
    const badge = document.getElementById("sharedChatBadge");
    if (badge) {
      badge.style.display = "none";
    }
  }

  /* =========================================================
   * NAVIGATION ACTIONS
   * Что здесь:
   * - центральный navigate(...)
   * - смена iframe-страницы
   * - обновление active nav
   * - отправка shell state в открытую страницу
   * ========================================================= */

  function navigate(page, tab) {
    let targetTab = tab || getTabByPage(page) || currentTab;

    if (!isTabEnabled(targetTab)) {
      targetTab = getFallbackTab();
    }

    const finalPage = page || getPageByTab(targetTab);
    if (!finalPage) return;

    if (frame && frame.getAttribute("src") !== finalPage) {
      frame.setAttribute("src", finalPage);
    }

    currentTab = targetTab;
    updateActiveNav();
    Runtime.hapticSelection();

    if (currentTab === "shared-chat") {
      hideSharedChatBadge();
    }

    setTimeout(pushShellStateToFrame, 150);
  }

  /* =========================================================
   * NAV BUTTON BINDINGS
   * Что здесь:
   * - обработчики клика по нижней навигации
   * ========================================================= */

  function bindNavButtons() {
    navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (!isTabEnabled(tab)) return;

        const page = getPageByTab(tab);
        navigate(page, tab);
      });
    });
  }

  /* =========================================================
   * SHELL HEADER ACTIONS
   * Что здесь:
   * - обработчики кнопок header
   * - переход в settings
   * - notifications feedback
   * ========================================================= */

  function bindShellButtons() {
    const settingsButton = document.getElementById("settingsButton");
    const notificationsButton = document.getElementById("notificationsButton");

    if (settingsButton) {
      settingsButton.addEventListener("click", () => {
        if (!isTabEnabled("settings")) return;
        navigate(getPageByTab("settings"), "settings");
      });
    }

    if (notificationsButton) {
      notificationsButton.addEventListener("click", () => {
        Runtime.hapticNotify("success");
      });
    }
  }

  /* =========================================================
   * MESSAGE BUS
   * Что здесь:
   * - обработка сообщений от дочерних страниц
   * - навигация
   * - shared chat badge
   * - профиль пользователя
   * - user modules
   * - feature flags
   * - agent stats / dialogs
   * ========================================================= */

  function bindMessageBus() {
    window.addEventListener("message", (e) => {
      console.log("[shell] message received", e.data);

      const data = e.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "navigate") {
        const targetTab = data.tab || getTabByPage(data.page) || currentTab;

        if (!isTabEnabled(targetTab)) {
          const fallbackTab = getFallbackTab();
          navigate(getPageByTab(fallbackTab), fallbackTab);
          return;
        }

        navigate(data.page || getPageByTab(targetTab), targetTab);
        return;
      }

      if (data.type === "shared-chat-unread") {
        const badge = document.getElementById("sharedChatBadge");
        if (!badge) return;

        if (currentTab === "shared-chat") {
          badge.style.display = "none";
          return;
        }

        badge.style.display = data.hasUnread ? "block" : "none";
        return;
      }

      if (data.type === "request-user-profile") {
        sendUserProfileToFrame();
        return;
      }

      if (data.type === "save-user-profile") {
        USERPROFILE = data.profile || data;
        sendUserProfileToFrame();
        return;
      }

      if (data.type === "request-user-modules") {
        sendUserModulesToFrame();
        return;
      }

      if (data.type === "save-user-modules") {
        setUserModules(data.modules || []);
        return;
      }

      if (data.type === "request-app-features") {
        sendFeaturesToFrame();
        return;
      }

      if (data.type === "agent-stats-request") {
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(
            {
              type: "agent-stats-response",
              stats: getAgentStats()
            },
            "*"
          );
        }
        return;
      }

      if (data.type === "agent-stats-save" && data.stats) {
        setAgentStats(data.stats);
        return;
      }

      if (data.type === "agent-dialogs-update" && Array.isArray(data.dialogs)) {
        setAgentStats({
          ...getAgentStats(),
          dialogs: data.dialogs
        });
        return;
      }

      if (data.type === "agent-open-dialog") {
        const dialogs = getAgentStats().dialogs || [];
        const dialog =
          dialogs.find((d) => String(d.id) === String(data.dialogId)) || {
            id: data.dialogId || null,
            username: data.username || "",
            channel: data.channel || "",
            timeLabel: data.timeLabel || "",
            lastMessage: data.lastMessage || ""
          };

        setCurrentAgentDialog(dialog);
        navigate("modules-agent/dialogs.html", "modules");
        return;
      }

      if (data.type === "agent-current-dialog-request") {
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(
            {
              type: "agent-current-dialog-response",
              dialog: getCurrentAgentDialog()
            },
            "*"
          );
        }
      }
    });
  }

  /* =========================================================
   * BOOTSTRAP
   * Что здесь:
   * - запуск runtime
   * - загрузка tenant config
   * - применение feature flags
   * - сборка page config
   * - биндинг навигации и message bus
   * - открытие стартовой страницы
   * ========================================================= */

  async function bootstrap() {
    Runtime.ready();
    Runtime.expand();

    try {
      const tenantConfig = await window.AICTenant.load();
      APPFEATURES = tenantConfig.features || APPFEATURES;
    } catch (error) {
      console.error("Tenant config load failed:", error);
    }

    buildPageConfig();
    updateNavVisibility();
    bindNavButtons();
    bindShellButtons();
    bindMessageBus();

    const initialTab = isTabEnabled("home") ? "home" : getFallbackTab();
    navigate(getPageByTab(initialTab), initialTab);
  }

  document.addEventListener("DOMContentLoaded", bootstrap);

  /* =========================================================
   * PUBLIC SHELL API
   * Что здесь:
   * - публичные методы shell для child pages
   * - tenant config getters
   * - runtime info
   * - user/profile/modules getters-setters
   * - agent stats getters-setters
   * ========================================================= */

  window.AICAppShell = {
    navigate,
    getCurrentTab: () => currentTab,
    getFeatures: () => APPFEATURES,
    getAppFeatures: () => APPFEATURES,
    getPageConfig: () => PAGECONFIG,

    getVersionInfo: () =>
      (window.AICRuntime && typeof window.AICRuntime.getVersionInfo === "function"
        ? window.AICRuntime.getVersionInfo()
        : window.AICRuntime && window.AICRuntime.version
          ? window.AICRuntime.version
          : null),

    getRuntimeInfo: () => ({
      version:
        window.AICRuntime && typeof window.AICRuntime.getVersionInfo === "function"
          ? window.AICRuntime.getVersionInfo()
          : window.AICRuntime && window.AICRuntime.version
            ? window.AICRuntime.version
            : null,
      tenant:
        window.AICTenant && typeof window.AICTenant.getConfig === "function"
          ? window.AICTenant.getConfig()
          : null
    }),

    getTenantConfig: () =>
      (window.AICTenant ? window.AICTenant.getConfig() : null),

    getTenantDebugContext: () =>
      (window.AICTenant ? window.AICTenant.getDebugContext() : null),

    getTenantDomains: () =>
      (window.AICTenant ? window.AICTenant.getDomains() : {}),

    getTenantModules: () =>
      (window.AICTenant ? window.AICTenant.getModules() : []),

    getTenantPlans: () =>
      (window.AICTenant ? window.AICTenant.getPlans() : []),

    getTenantSections: () =>
      (window.AICTenant ? window.AICTenant.getSections() : {}),

    getCurrentUser: () => USERPROFILE,
    getUserProfile: () => USERPROFILE,
    setUserProfile: (profile) => {
      USERPROFILE = profile || null;
      sendUserProfileToFrame();
    },

    getUserModules: () => getUserModules(),
    setUserModules: (modules) => setUserModules(modules),

    getAgentStats: () => getAgentStats(),
    setAgentStats: (stats) => setAgentStats(stats),

    getCurrentAgentDialog: () => getCurrentAgentDialog(),
    setCurrentAgentDialog: (dialog) => setCurrentAgentDialog(dialog)
  };
})();
