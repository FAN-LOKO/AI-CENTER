(function () {
  /* =========================================================
   * SHELL DEPENDENCIES
   * What is here / Что здесь:
   * - runtime adapter / runtime-адаптер
   * - iframe container / iframe-контейнер страниц
   * - bottom navigation buttons / кнопки нижней навигации
   * ========================================================= */

  const Runtime = window.AICRuntime || {
    ready() {},
    expand() {},
    hapticSelection() {},
    hapticNotify() {},
    getVersionInfo() {
      return null;
    }
  };

  const frame = document.getElementById("pageFrame");
  const navBtns = document.querySelectorAll(".nav-btn");

  /* =========================================================
   * SHELL STATE
   * What is here / Что здесь:
   * - app feature flags / feature flags приложения
   * - page config map / карта страниц
   * - current active tab / текущая вкладка
   * - user profile / профиль пользователя
   * - tenant config / tenant-конфиг
   * - tenant catalog modules / полный каталог модулей tenant
   * - user modules access state / пользовательские модули и доступ
   * - agent stats / статистика агента
   * - selected agent dialog / выбранный диалог агента
   * - selected payment module id / текущий moduleId для payments
   * - selected payment plan context / выбранный payment context
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
  let TENANTCONFIG = null;
  let TENANTMODULES = [];

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
        lastMessage:
          "Здравствуйте, хочу узнать про тариф с ботом-консультантом"
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
        lastMessage:
          "Подскажите, можно ли подключить минимальную CRM на n8n"
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
  let CURRENT_PAYMENT_MODULE_ID = null;
  let CURRENT_PAYMENT_CONTEXT = null;

  /* =========================================================
   * TENANT HELPERS
   * What is here / Что здесь:
   * - read tenant config from tenant loader / чтение tenant config из tenant loader
   * - read tenant modules catalog / чтение каталога модулей tenant
   * - normalize tenant modules / нормализация tenant-модулей
   * - apply tenant feature flags / применение tenant feature flags
   * ========================================================= */

  function normalizeTenantModules(modules) {
    if (!Array.isArray(modules)) return [];

    return modules
      .filter((mod) => mod && mod.id)
      .map((mod) => ({
        id: String(mod.id),
        title:
          typeof mod.title === "string"
            ? mod.title
            : mod.title && typeof mod.title.en === "string"
              ? mod.title.en
              : mod.title && typeof mod.title.ru === "string"
                ? mod.title.ru
                : String(mod.id),
        titleRu:
          typeof mod.titleRu === "string"
            ? mod.titleRu
            : mod.title && typeof mod.title === "object" && typeof mod.title.ru === "string"
              ? mod.title.ru
              : typeof mod.title === "string"
                ? mod.title
                : String(mod.id),
        shortDescription: String(mod.shortDescription || ""),
        fullDescription: Array.isArray(mod.fullDescription)
          ? mod.fullDescription
          : [],
        page: typeof mod.page === "string" ? mod.page : null,
        enabled: mod.enabled !== false,
        category: typeof mod.category === "string" ? mod.category : "core",
        requiresPayment: !!mod.requiresPayment
      }));
  }

  function loadTenantStateFromProvider() {
    try {
      if (!window.AICTenant) {
        TENANTCONFIG = null;
        TENANTMODULES = [];
        return;
      }

      if (typeof window.AICTenant.getConfig === "function") {
        TENANTCONFIG = window.AICTenant.getConfig() || null;
      } else {
        TENANTCONFIG = null;
      }

      if (typeof window.AICTenant.getModules === "function") {
        TENANTMODULES = normalizeTenantModules(window.AICTenant.getModules() || []);
      } else if (Array.isArray(TENANTCONFIG?.modules)) {
        TENANTMODULES = normalizeTenantModules(TENANTCONFIG.modules);
      } else {
        TENANTMODULES = [];
      }
    } catch (error) {
      console.error("[AI CENTER][Shell] tenant state load failed", error);
      TENANTCONFIG = null;
      TENANTMODULES = [];
    }
  }

  function applyTenantFeatures() {
    if (!TENANTCONFIG || !TENANTCONFIG.features) return;

    APPFEATURES = {
      ...APPFEATURES,
      ...Object.keys(APPFEATURES).reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(TENANTCONFIG.features, key)) {
          acc[key] = !!TENANTCONFIG.features[key];
        }
        return acc;
      }, {})
    };
  }

  function getTenantConfig() {
    return TENANTCONFIG;
  }

  function getTenantModules() {
    return TENANTMODULES;
  }

  /* =========================================================
   * USER MODULES HELPERS
   * What is here / Что здесь:
   * - normalize user module access state / нормализация user state по модулям
   * - get user modules access list / получение списка модулей пользователя
   * - save user modules access list / сохранение списка модулей пользователя
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
   * What is here / Что здесь:
   * - set agent stats / установка статистики агента
   * - get agent stats / получение статистики агента
   * - set selected current dialog / установка текущего выбранного диалога
   * - get selected current dialog / получение текущего выбранного диалога
   * ========================================================= */

  function setAgentStats(nextStats) {
    AGENT_STATS = {
      dialogsTotal: Number(nextStats?.dialogsTotal || 0),
      refLinksTotal: Number(nextStats?.refLinksTotal || 0),
      dialogsToday: Number(nextStats?.dialogsToday || 0),
      refLinksToday: Number(nextStats?.refLinksToday || 0),
      dialogs: Array.isArray(nextStats?.dialogs) ? nextStats.dialogs : [],
      issuedLinks: Array.isArray(nextStats?.issuedLinks)
        ? nextStats.issuedLinks
        : []
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
   * PAYMENT CONTEXT HELPERS
   * What is here / Что здесь:
   * - keep current moduleId for payments / хранение текущего moduleId для payments
   * - keep selected payment plan context / хранение выбранного payment plan
   * - send payment context to iframe / передача payment context в iframe
   * ========================================================= */

  function setCurrentPaymentModuleId(moduleId) {
    CURRENT_PAYMENT_MODULE_ID = moduleId ? String(moduleId) : null;

    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        {
          type: "payment-module-context",
          moduleId: CURRENT_PAYMENT_MODULE_ID
        },
        "*"
      );
    }
  }

  function getCurrentPaymentModuleId() {
    return CURRENT_PAYMENT_MODULE_ID;
  }

  function setCurrentPaymentContext(context) {
    CURRENT_PAYMENT_CONTEXT = context || null;

    if (CURRENT_PAYMENT_CONTEXT && CURRENT_PAYMENT_CONTEXT.moduleId) {
      CURRENT_PAYMENT_MODULE_ID = String(CURRENT_PAYMENT_CONTEXT.moduleId);
    }

    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        {
          type: "payment-context",
          context: CURRENT_PAYMENT_CONTEXT
        },
        "*"
      );
    }
  }

  function getCurrentPaymentContext() {
    return CURRENT_PAYMENT_CONTEXT;
  }

  /* =========================================================
   * PAGE CONFIGURATION
   * What is here / Что здесь:
   * - unified tabs/page config map / единая карта вкладок и файлов страниц
   * - feature flags mapping for pages / привязка feature flags к доступности страниц
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
   * What is here / Что здесь:
   * - check tab availability / проверка доступности вкладки
   * - fallback tab / fallback-вкладка
   * - convert tab <-> page / преобразование tab <-> page
   * ========================================================= */

  function isTabEnabled(tab) {
    return !!PAGECONFIG[tab] && !!PAGECONFIG[tab].enabled;
  }

  function getFallbackTab() {
    const fallbackOrder = [
      "home",
      "my-agent",
      "modules",
      "shared-chat",
      "payments"
    ];
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
   * What is here / Что здесь:
   * - send user profile to page / отправка профиля пользователя в страницу
   * - send app features to page / отправка feature flags в страницу
   * - send tenant config to page / отправка tenant config в страницу
   * - send tenant modules to page / отправка tenant modules в страницу
   * - send user access modules to page / отправка user modules в страницу
   * - send payment module context to page / отправка payment module context в страницу
   * - send selected payment context to page / отправка выбранного payment context в страницу
   * - push full shell state to current iframe / единый пуш состояния shell в текущий iframe
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

  function sendTenantConfigToFrame() {
    if (!frame || !frame.contentWindow || !TENANTCONFIG) return;

    frame.contentWindow.postMessage(
      {
        type: "tenant-config",
        config: TENANTCONFIG
      },
      "*"
    );
  }

  function sendTenantModulesToFrame() {
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: "tenant-modules",
        modules: getTenantModules()
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

  function sendPaymentModuleContextToFrame() {
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: "payment-module-context",
        moduleId: getCurrentPaymentModuleId()
      },
      "*"
    );
  }

  function sendPaymentContextToFrame() {
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: "payment-context",
        context: getCurrentPaymentContext()
      },
      "*"
    );
  }

  function pushShellStateToFrame() {
    sendFeaturesToFrame();
    sendTenantConfigToFrame();
    sendTenantModulesToFrame();
    sendUserProfileToFrame();
    sendUserModulesToFrame();
    sendPaymentModuleContextToFrame();
    sendPaymentContextToFrame();
  }

  /* =========================================================
   * SHELL UI STATE
   * What is here / Что здесь:
   * - show/hide nav buttons / скрытие/показ кнопок навигации
   * - highlight active tab / подсветка активной вкладки
   * - hide shared chat badge / скрытие badge у shared chat
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
   * What is here / Что здесь:
   * - central navigate(...) / центральный navigate(...)
   * - switch iframe page / смена iframe-страницы
   * - update active nav / обновление active nav
   * - push shell state to opened page / отправка shell state в открытую страницу
   * ========================================================= */

  function navigate(page, tab) {
    let targetTab = tab || getTabByPage(page) || currentTab;

    if (tab && !isTabEnabled(targetTab)) {
      targetTab = getFallbackTab();
      page = getPageByTab(targetTab);
    }

    const finalPage = page || getPageByTab(targetTab);
    if (!finalPage) return;

    if (frame && frame.getAttribute("src") !== finalPage) {
      frame.setAttribute("src", finalPage);
    }

    currentTab = targetTab || currentTab;
    updateActiveNav();
    Runtime.hapticSelection();

    if (currentTab === "shared-chat") {
      hideSharedChatBadge();
    }

    setTimeout(pushShellStateToFrame, 150);
  }

  /* =========================================================
   * NAV BUTTON BINDINGS
   * What is here / Что здесь:
   * - bind bottom navigation / привязка нижней навигации
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
   * What is here / Что здесь:
   * - shell header buttons actions / действия header-кнопок shell
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
   * What is here / Что здесь:
   * - routing messages between pages and shell / маршрутизация сообщений между страницами и shell
   * - navigation / навигация
   * - tenant config / tenant config
   * - tenant modules / tenant modules
   * - user profile / user profile
   * - feature flags / feature flags
   * - user modules access / user modules
   * - agent stats / agent stats
   * - payment module context / payment module context
   * - payment route / маршрут оплаты
   * ========================================================= */

  function bindMessageBus() {
    window.addEventListener("message", (e) => {
      console.log("[shell] message received", e.data);

      const data = e.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "navigate") {
        const targetTab = data.tab || getTabByPage(data.page) || currentTab;

        if (!isTabEnabled(targetTab) && data.tab) {
          const fallbackTab = getFallbackTab();
          navigate(getPageByTab(fallbackTab), fallbackTab);
          return;
        }

        if (data.page === "payments.html") {
          setCurrentPaymentModuleId(data.moduleId || null);
        }

        navigate(data.page || getPageByTab(targetTab), targetTab);
        return;
      }

      if (data.type === "payment") {
        if (APPFEATURES.payments === false) return;

        const plan = data.plan || null;
        const moduleId =
          data.moduleId ||
          plan?.moduleId ||
          getCurrentPaymentModuleId() ||
          null;

        setCurrentPaymentContext({
          planId: plan?.id || data.tariff || null,
          moduleId: moduleId,
          name: plan?.name || null,
          description: plan?.description || null,
          durationDays:
            typeof plan?.durationDays === "number" ? plan.durationDays : null,
          priceUsd:
            typeof plan?.priceUsd === "number"
              ? plan.priceUsd
              : Number(plan?.priceUsd || 0),
          compareAtUsd:
            typeof plan?.compareAtUsd === "number"
              ? plan.compareAtUsd
              : Number(plan?.compareAtUsd || 0),
          savingUsd:
            typeof plan?.savingUsd === "number"
              ? plan.savingUsd
              : Number(plan?.savingUsd || 0),
          badge: plan?.badge || null
        });

        navigate("payment-checkout.html", null);
        return;
      }

      if (data.type === "request-payment-context") {
        sendPaymentContextToFrame();
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

      if (data.type === "request-tenant-config") {
        sendTenantConfigToFrame();
        return;
      }

      if (data.type === "request-tenant-modules") {
        sendTenantModulesToFrame();
        return;
      }

      if (data.type === "request-app-features") {
        sendFeaturesToFrame();
        return;
      }

      if (data.type === "request-user-modules") {
        sendUserModulesToFrame();
        return;
      }

      if (data.type === "request-payment-module-context") {
        sendPaymentModuleContextToFrame();
        return;
      }

      if (data.type === "set-payment-module-context") {
        setCurrentPaymentModuleId(data.moduleId || null);
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
          dialogs: data.dialogs,
          dialogsTotal: data.dialogs.length
        });
        return;
      }

      if (
        data.type === "agent-issued-links-update" &&
        Array.isArray(data.issuedLinks)
      ) {
        setAgentStats({
          ...getAgentStats(),
          issuedLinks: data.issuedLinks,
          refLinksTotal: data.issuedLinks.length
        });
        return;
      }

                  if (data.type === "agent-open-dialog") {
        const stats = getAgentStats();
        const dialogs = Array.isArray(stats?.dialogs) ? stats.dialogs : [];

        const matchedDialog =
          dialogs.find((dialog) => dialog.id === data.dialogId) ||
          dialogs.find(
            (dialog) =>
              dialog.username === data.username &&
              dialog.channel === data.channel
          ) ||
          null;

        const selectedDialog =
          matchedDialog || {
            id: data.dialogId || `dlg-${Date.now()}`,
            username: data.username || "@unknown",
            channel: data.channel || "Telegram",
            timeLabel: data.timeLabel || "",
            status: data.status || "open",
            tags: Array.isArray(data.tags) ? data.tags : [],
            notes: data.notes || "",
            messages: Array.isArray(data.messages) ? data.messages : []
          };

        setCurrentAgentDialog(selectedDialog);

        const dialogsPage = "my-agent.html";
        const dialogsTab = getTabByPage(dialogsPage) || currentTab || getFallbackTab();

        navigate(dialogsPage, dialogsTab);

        requestAnimationFrame(() => {
          if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage(
              {
                type: "agent-current-dialog-set",
                dialog: selectedDialog
              },
              "*"
            );

            frame.contentWindow.postMessage(
              {
                type: "agent-dialogs-update",
                dialogs
              },
              "*"
            );
          }
        });

        return;
      }

      if (data.type === "agent-send-message") {
        const stats = getAgentStats();
        const dialogs = Array.isArray(stats?.dialogs) ? stats.dialogs : [];
        const currentDialog = getCurrentAgentDialog();

        const targetDialogId =
          data.dialogId || currentDialog?.id || null;

        if (!targetDialogId) return;

        const updatedDialogs = dialogs.map((dialog) => {
          if (dialog.id !== targetDialogId) return dialog;

          const nextMessages = Array.isArray(dialog.messages)
            ? dialog.messages.slice()
            : [];

          nextMessages.push({
            id: `msg-${Date.now()}`,
            role: "agent",
            text: data.text || "",
            createdAt: new Date().toISOString(),
            timeLabel: "только что",
            status: "sent"
          });

          return {
            ...dialog,
            messages: nextMessages,
            lastMessage: data.text || dialog.lastMessage || "",
            timeLabel: "только что"
          };
        });

        const updatedCurrentDialog =
          updatedDialogs.find((dialog) => dialog.id === targetDialogId) || null;

        setAgentStats({
          ...stats,
          dialogs: updatedDialogs,
          dialogsTotal: updatedDialogs.length
        });

        setCurrentAgentDialog(updatedCurrentDialog);

        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(
            {
              type: "agent-dialogs-update",
              dialogs: updatedDialogs
            },
            "*"
          );

          frame.contentWindow.postMessage(
            {
              type: "agent-current-dialog-set",
              dialog: updatedCurrentDialog
            },
            "*"
          );
        }

        return;
      }
      
      if (data.type === "agent-current-dialog-set") {
        setCurrentAgentDialog(data.dialog || null);
        return;
      }
    });
  }

  /* =========================================================
   * BOOTSTRAP
   * What is here / Что здесь:
   * - initialize runtime / инициализация runtime
   * - initialize tenant / инициализация tenant
   * - read tenant config and modules / чтение tenant config и модулей
   * - apply tenant feature flags / применение tenant feature flags
   * - build page config / сборка page config
   * - start shell / старт shell
   * ========================================================= */

  async function bootstrap() {
    try {
      Runtime.ready();
      Runtime.expand();

      if (window.AICTenant && typeof window.AICTenant.load === "function") {
        await window.AICTenant.load();
      }
    } catch (error) {
      console.error("[AI CENTER][Shell] bootstrap failed", error);
    }

    loadTenantStateFromProvider();
    applyTenantFeatures();
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
   * What is here / Что здесь:
   * - public shell methods for pages / публичные методы shell для страниц
   * ========================================================= */

  window.AICAppShell = {
    navigate,

    getCurrentTab: () => currentTab,
    getAppFeatures: () => APPFEATURES,
    getFeatures: () => APPFEATURES,
    getPageConfig: () => PAGECONFIG,

    getVersionInfo: () =>
      window.AICRuntime &&
      typeof window.AICRuntime.getVersionInfo === "function"
        ? window.AICRuntime.getVersionInfo()
        : window.AICRuntime && window.AICRuntime.version
          ? window.AICRuntime.version
          : null,

    getRuntimeInfo: () => ({
      version:
        window.AICRuntime &&
        typeof window.AICRuntime.getVersionInfo === "function"
          ? window.AICRuntime.getVersionInfo()
          : window.AICRuntime && window.AICRuntime.version
            ? window.AICRuntime.version
            : null,
      tenant:
        window.AICTenant && typeof window.AICTenant.getConfig === "function"
          ? window.AICTenant.getConfig()
          : null
    }),

    getTenantConfig: () => getTenantConfig(),

    getTenantDebugContext: () =>
      window.AICTenant &&
      typeof window.AICTenant.getDebugContext === "function"
        ? window.AICTenant.getDebugContext()
        : null,

    getTenantDomains: () =>
      window.AICTenant &&
      typeof window.AICTenant.getDomains === "function"
        ? window.AICTenant.getDomains()
        : {},

    getTenantModules: () => getTenantModules(),

    getTenantPlans: () =>
      window.AICTenant && typeof window.AICTenant.getPlans === "function"
        ? window.AICTenant.getPlans()
        : Array.isArray(TENANTCONFIG?.plans)
          ? TENANTCONFIG.plans
          : [],

    getTenantSections: () =>
      window.AICTenant && typeof window.AICTenant.getSections === "function"
        ? window.AICTenant.getSections()
        : TENANTCONFIG?.sections || {},

    getUserModules: () => getUserModules(),
    setUserModules: (modules) => setUserModules(modules),

    getAgentStats: () => getAgentStats(),
    setAgentStats: (stats) => setAgentStats(stats),

    getCurrentAgentDialog: () => getCurrentAgentDialog(),
    setCurrentAgentDialog: (dialog) => setCurrentAgentDialog(dialog),

    getCurrentPaymentModuleId: () => getCurrentPaymentModuleId(),
    setCurrentPaymentModuleId: (moduleId) => setCurrentPaymentModuleId(moduleId),

    getCurrentPaymentContext: () => getCurrentPaymentContext(),
    setCurrentPaymentContext: (context) => setCurrentPaymentContext(context)
  };
})();
