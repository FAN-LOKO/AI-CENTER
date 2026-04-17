(function () {
  /* =========================================================
  SHELL DEPENDENCIES / ЗАВИСИМОСТИ SHELL
  Runtime adapter, iframe reference, navigation buttons
  Runtime-адаптер, iframe-контейнер, кнопки навигации
  ========================================================= */

  const Runtime = window.AICRuntime || {
    ready() {},
    expand() {},
    hapticSelection() {},
    hapticNotify() {}
  };

  const frame = document.getElementById("pageFrame");
  const navBtns = document.querySelectorAll(".nav-btn");

  /* =========================================================
  SHELL STATE / СОСТОЯНИЕ SHELL
  ========================================================= */

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

  // Agent stats state / Состояние статистики агента
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

  // Текущий выбранный диалог (по клику из stats)
  let CURRENT_AGENT_DIALOG = null;

  function setAgentStats(nextStats) {
    AGENT_STATS = {
      dialogsTotal: Number(nextStats?.dialogsTotal || 0),
      refLinksTotal: Number(nextStats?.refLinksTotal || 0),
      dialogsToday: Number(nextStats?.dialogsToday || 0),
      refLinksToday: Number(nextStats?.refLinksToday || 0),
      dialogs: Array.isArray(nextStats?.dialogs) ? nextStats.dialogs : [],
      issuedLinks: Array.isArray(nextStats?.issuedLinks) ? nextStats.issuedLinks : []
    };

    // Пушим обновление в текущий frame (если открыт stats или dialogs)
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

    // При желании можно пушнуть выбранный диалог в открытую страницу диалогов
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
  PAGE CONFIGURATION / КОНФИГУРАЦИЯ СТРАНИЦ
  ========================================================= */

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
  NAVIGATION HELPERS / ВСПОМОГАТЕЛЬНАЯ ЛОГИКА НАВИГАЦИИ
  ========================================================= */

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
  SHELL -> PAGE MESSAGING / СООБЩЕНИЯ ОТ SHELL К СТРАНИЦАМ
  ========================================================= */

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

  if (USERPROFILE) {
    sendUserProfileToFrame();
  }

  /* =========================================================
  SHELL UI STATE / UI-СОСТОЯНИЕ SHELL
  ========================================================= */

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
  NAVIGATION ACTIONS / ДЕЙСТВИЯ НАВИГАЦИИ
  ========================================================= */

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

    setTimeout(sendFeaturesToFrame, 150);
  }

  /* =========================================================
  NAV BUTTON BINDINGS / ПРИВЯЗКА КНОПОК НАВИГАЦИИ
  ========================================================= */

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
  SHELL HEADER ACTIONS / ДЕЙСТВИЯ HEADER В SHELL
  ========================================================= */

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
  MESSAGE BUS / ШИНА СООБЩЕНИЙ
  ========================================================= */

  function bindMessageBus() {
    window.addEventListener("message", (e) => {
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
        if (USERPROFILE && frame && frame.contentWindow) {
          frame.contentWindow.postMessage(
            {
              type: "user-profile",
              profile: USERPROFILE
            },
            "*"
          );
        }
        return;
      }

      if (data.type === "save-user-profile") {
        USERPROFILE = data.profile || data;
        sendUserProfileToFrame();
        return;
      }

      if (data.type === "request-app-features") {
        sendFeaturesToFrame();
        return;
      }

      // Страница статистики просит актуальные данные
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

      // Где-то внутри модулей обновили агрегированную статистику
      if (data.type === "agent-stats-save" && data.stats) {
        setAgentStats(data.stats);
        return;
      }

      // Обновление только по диалогам
      if (data.type === "agent-dialogs-update" && Array.isArray(data.dialogs)) {
        setAgentStats({
          ...getAgentStats(),
          dialogs: data.dialogs
        });
        return;
      }

      // === КЛИК ПО ДИАЛОГУ ИЗ СТАТИСТИКИ ===
      // stats.html шлёт: { type: 'agent-open-dialog', dialogId, username, channel }
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

        // сохраняем текущий диалог
        setCurrentAgentDialog(dialog);

        // открываем страницу диалогов агента
        navigate("modules-agent/dialogs.html", "modules");
        return;
      }

      // Страница диалогов может запросить текущий выбранный диалог
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
        return;
      }
    });
  }

  /* =========================================================
  BOOTSTRAP / ИНИЦИАЛИЗАЦИЯ
  ========================================================= */

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
  PUBLIC SHELL API / ПУБЛИЧНОЕ API SHELL
  ========================================================= */

  window.AICAppShell = {
    navigate,
    getCurrentTab: () => currentTab,
    getFeatures: () => APPFEATURES,
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

    // === Agent stats API / API статистики агента ===
    getAgentStats: () => getAgentStats(),
    setAgentStats: (stats) => setAgentStats(stats),

    // Текущий диалог агента
    getCurrentAgentDialog: () => getCurrentAgentDialog(),
    setCurrentAgentDialog: (dialog) => setCurrentAgentDialog(dialog)
  };
})();
