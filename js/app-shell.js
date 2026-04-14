(function () {
  /* =========================================================
     AI CENTER / APP SHELL
     Совместимый и аккуратно очищенный shell-контроллер.

     Отвечает за:
     - tenant feature flags
     - маршрутизацию вкладок shell
     - навигацию iframe-страниц
     - message bus shell <-> inner pages
     - публичное API window.AICAppShell
  ========================================================= */

  /* =========================================================
     1. DEPENDENCIES / ЗАВИСИМОСТИ
     Базовые ссылки на runtime и DOM shell.
  ========================================================= */

  const Runtime = window.AICRuntime || {
    ready() {},
    expand() {},
    hapticSelection() {},
    hapticNotify() {}
  };

  const frame = document.getElementById('pageFrame');
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  const settingsButton = document.getElementById('settingsButton');
  const notificationsButton = document.getElementById('notificationsButton');
  const sharedChatBadge = document.getElementById('sharedChatBadge');

  /* =========================================================
     2. STATE / СОСТОЯНИЕ SHELL
     Глобальное состояние оболочки.
  ========================================================= */

  const DEFAULT_FEATURES = {
    home: true,
    myAgent: true,
    modules: true,
    sharedChat: true,
    affiliate: true,
    payments: true,
    settings: true
  };

  let APP_FEATURES = { ...DEFAULT_FEATURES };
  let PAGE_CONFIG = {};
  let currentTab = 'home';
  let USER_PROFILE = null;
  let tenantConfigCache = null;

  /* =========================================================
     3. PAGE MAP / КАРТА СТРАНИЦ
     Связывает tab shell с html-страницей и feature-флагом.
  ========================================================= */

  function buildPageConfig() {
    PAGE_CONFIG = {
      home: {
        page: 'home.html',
        enabled: APP_FEATURES.home
      },
      'my-agent': {
        page: 'my-agent.html',
        enabled: APP_FEATURES.myAgent
      },
      modules: {
        page: 'modules.html',
        enabled: APP_FEATURES.modules
      },
      'shared-chat': {
        page: 'shared-chat.html',
        enabled: APP_FEATURES.sharedChat
      },
      affiliate: {
        page: 'partner.html',
        enabled: APP_FEATURES.affiliate
      },
      payments: {
        page: 'payments.html',
        enabled: APP_FEATURES.payments
      },
      settings: {
        page: 'settings.html',
        enabled: APP_FEATURES.settings
      }
    };
  }

  /* =========================================================
     4. HELPERS / ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     Проверка доступности вкладок, fallback, tab <-> page.
  ========================================================= */

  function isTabEnabled(tab) {
    return !!PAGE_CONFIG[tab] && !!PAGE_CONFIG[tab].enabled;
  }

  function getFallbackTab() {
    const fallbackOrder = ['home', 'my-agent', 'modules', 'shared-chat', 'payments'];
    return fallbackOrder.find((tab) => isTabEnabled(tab)) || 'home';
  }

  function getPageByTab(tab) {
    return PAGE_CONFIG[tab] ? PAGE_CONFIG[tab].page : null;
  }

  function getTabByPage(page) {
    for (const [tab, config] of Object.entries(PAGE_CONFIG)) {
      if (config.page === page) {
        return tab;
      }
    }
    return null;
  }

  function getSafeTargetTab(page, tab) {
    const resolvedTab = tab || getTabByPage(page) || currentTab;
    return isTabEnabled(resolvedTab) ? resolvedTab : getFallbackTab();
  }

  function getSafeTargetPage(page, tab) {
    const resolvedTab = getSafeTargetTab(page, tab);
    return page || getPageByTab(resolvedTab);
  }

  /* =========================================================
     5. SHELL -> PAGE MESSAGING
     Отправка данных во внутренние iframe-страницы.
  ========================================================= */

  function postToFrame(payload) {
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(payload, '*');
  }

  function sendUserProfileToFrame() {
    if (!USER_PROFILE) return;
    postToFrame({
      type: 'user-profile',
      profile: USER_PROFILE
    });
  }

  function sendFeaturesToFrame() {
    postToFrame({
      type: 'app-features',
      features: APP_FEATURES
    });
  }

  /* =========================================================
     6. UI STATE / UI-СОСТОЯНИЕ SHELL
     Видимость вкладок, активная кнопка, unread badge.
  ========================================================= */

  function updateNavVisibility() {
    navButtons.forEach((button) => {
      const tab = button.dataset.tab;
      button.style.display = isTabEnabled(tab) ? '' : 'none';
    });
  }

  function updateActiveNav() {
    navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === currentTab);
    });
  }

  function hideSharedChatBadge() {
    if (!sharedChatBadge) return;
    sharedChatBadge.style.display = 'none';
  }

  function setSharedChatBadgeVisible(visible) {
    if (!sharedChatBadge) return;
    sharedChatBadge.style.display = visible ? 'block' : 'none';
  }

  /* =========================================================
     7. NAVIGATION / НАВИГАЦИЯ
     Главная функция переключения вкладок и страниц.
  ========================================================= */

  function navigate(page, tab) {
    const targetTab = getSafeTargetTab(page, tab);
    const targetPage = getSafeTargetPage(page, targetTab);

    if (!targetPage) return;

    if (frame && frame.getAttribute('src') !== targetPage) {
      frame.setAttribute('src', targetPage);
    }

    currentTab = targetTab;
    updateActiveNav();
    Runtime.hapticSelection();

    if (currentTab === 'shared-chat') {
      hideSharedChatBadge();
    }

    setTimeout(() => {
      sendFeaturesToFrame();
      sendUserProfileToFrame();
    }, 150);
  }

  /* =========================================================
     8. BUTTON BINDINGS / ПРИВЯЗКА КНОПОК
     Нижняя навигация и header actions.
  ========================================================= */

  function bindNavButtons() {
    navButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        if (!isTabEnabled(tab)) return;

        navigate(getPageByTab(tab), tab);
      });
    });
  }

  function bindHeaderButtons() {
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        if (!isTabEnabled('settings')) return;
        navigate(getPageByTab('settings'), 'settings');
      });
    }

    if (notificationsButton) {
      notificationsButton.addEventListener('click', () => {
        Runtime.hapticNotify('success');
      });
    }
  }

  /* =========================================================
     9. MESSAGE BUS / ШИНА СООБЩЕНИЙ
     Принимает сообщения от внутренних страниц.
  ========================================================= */

  function bindMessageBus() {
    window.addEventListener('message', (event) => {
      const data = event.data;

      if (!data || typeof data !== 'object') return;

      if (data.type === 'navigate') {
        const targetTab = getSafeTargetTab(data.page, data.tab);
        const targetPage = getSafeTargetPage(data.page, targetTab);
        navigate(targetPage, targetTab);
        return;
      }

      if (data.type === 'shared-chat-unread') {
        if (currentTab === 'shared-chat') {
          hideSharedChatBadge();
          return;
        }

        setSharedChatBadgeVisible(!!data.hasUnread);
        return;
      }

      if (data.type === 'request-user-profile') {
        sendUserProfileToFrame();
        return;
      }

      if (data.type === 'save-user-profile') {
        USER_PROFILE = data.profile || data;
        sendUserProfileToFrame();
        return;
      }

      if (data.type === 'request-app-features') {
        sendFeaturesToFrame();
      }
    });
  }

  /* =========================================================
     10. TENANT / TENANT-КОНФИГ
     Загружает tenant и применяет feature-флаги shell.
  ========================================================= */

  async function loadTenantConfig() {
    try {
      if (!window.AICTenant || typeof window.AICTenant.load !== 'function') {
        console.warn('[AI CENTER][Shell] AICTenant is not available');
        return null;
      }

      tenantConfigCache = await window.AICTenant.load();
      APP_FEATURES = tenantConfigCache.features || { ...DEFAULT_FEATURES };
      return tenantConfigCache;
    } catch (error) {
      console.error('[AI CENTER][Shell] Tenant config load failed:', error);
      APP_FEATURES = { ...DEFAULT_FEATURES };
      return null;
    }
  }

  /* =========================================================
     11. BOOTSTRAP / ИНИЦИАЛИЗАЦИЯ
     Поднимает runtime, tenant, nav и стартовую страницу.
  ========================================================= */

  async function bootstrap() {
    Runtime.ready();
    Runtime.expand();

    await loadTenantConfig();

    buildPageConfig();
    updateNavVisibility();
    updateActiveNav();
    bindNavButtons();
    bindHeaderButtons();
    bindMessageBus();

    const initialTab = isTabEnabled('home') ? 'home' : getFallbackTab();
    navigate(getPageByTab(initialTab), initialTab);
  }

  document.addEventListener('DOMContentLoaded', bootstrap);

  /* =========================================================
     12. PUBLIC API / ПУБЛИЧНОЕ API SHELL
     Внешний доступ для внутренних страниц и отладки.
  ========================================================= */

  window.AICAppShell = {
    navigate,
    getCurrentTab: () => currentTab,
    getFeatures: () => APP_FEATURES,
    getPageConfig: () => PAGE_CONFIG,
    getTenantConfig: () => (
      window.AICTenant && typeof window.AICTenant.getConfig === 'function'
        ? window.AICTenant.getConfig()
        : tenantConfigCache
    ),
    getTenantDebugContext: () => (
      window.AICTenant && typeof window.AICTenant.getDebugContext === 'function'
        ? window.AICTenant.getDebugContext()
        : null
    ),
    getTenantDomains: () => (
      window.AICTenant && typeof window.AICTenant.getDomains === 'function'
        ? window.AICTenant.getDomains()
        : {}
    ),
    getTenantModules: () => (
      window.AICTenant && typeof window.AICTenant.getModules === 'function'
        ? window.AICTenant.getModules()
        : []
    ),
    getTenantPlans: () => (
      window.AICTenant && typeof window.AICTenant.getPlans === 'function'
        ? window.AICTenant.getPlans()
        : []
    ),
    getTenantSections: () => (
      window.AICTenant && typeof window.AICTenant.getSections === 'function'
        ? window.AICTenant.getSections()
        : {}
    )
  };
})();
