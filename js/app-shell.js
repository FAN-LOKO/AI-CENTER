(function () {
  const Runtime = window.AICRuntime;

  const frame = document.getElementById('pageFrame');
  const navBtns = document.querySelectorAll('.nav-btn');

  let APPFEATURES = {
    home: true,
    myAgent: true,
    modules: true,
    sharedChat: true,
    affiliate: false,
    payments: true,
    settings: true
  };

  let PAGECONFIG = {};
  let currentTab = 'home';
  let USERPROFILE = null;

  function buildPageConfig() {
    PAGECONFIG = {
      home: { page: 'home.html', enabled: APPFEATURES.home },
      'my-agent': { page: 'my-agent.html', enabled: APPFEATURES.myAgent },
      modules: { page: 'modules.html', enabled: APPFEATURES.modules },
      'shared-chat': {
        page: 'shared-chat.html',
        enabled: APPFEATURES.sharedChat
      },
      affiliate: { page: 'partner.html', enabled: APPFEATURES.affiliate },
      payments: { page: 'payments.html', enabled: APPFEATURES.payments },
      settings: { page: 'settings.html', enabled: APPFEATURES.settings }
    };
  }

  function isTabEnabled(tab) {
    return !!PAGECONFIG[tab] && !!PAGECONFIG[tab].enabled;
  }

  function getFallbackTab() {
    const fallbackOrder = ['home', 'my-agent', 'modules', 'shared-chat', 'payments'];
    return fallbackOrder.find((tab) => isTabEnabled(tab)) || 'home';
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

  function sendUserProfileToFrame() {
    if (!frame || !frame.contentWindow || !USERPROFILE) return;

    frame.contentWindow.postMessage(
      {
        type: 'user-profile',
        profile: USERPROFILE
      },
      '*'
    );
  }

  function sendFeaturesToFrame() {
    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: 'app-features',
        features: APPFEATURES
      },
      '*'
    );

    if (USERPROFILE) {
      sendUserProfileToFrame();
    }
  }

  function updateNavVisibility() {
    navBtns.forEach((btn) => {
      const tab = btn.dataset.tab;
      const enabled = isTabEnabled(tab);
      btn.style.display = enabled ? '' : 'none';
    });
  }

  function updateActiveNav() {
    navBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });
  }

  function hideSharedChatBadge() {
    const badge = document.getElementById('sharedChatBadge');
    if (badge) {
      badge.style.display = 'none';
    }
  }

  function navigate(page, tab) {
    let targetTab = tab || getTabByPage(page) || currentTab;

    if (!isTabEnabled(targetTab)) {
      targetTab = getFallbackTab();
    }

    const finalPage = page || getPageByTab(targetTab);
    if (!finalPage) return;

    if (frame && frame.getAttribute('src') !== finalPage) {
      frame.setAttribute('src', finalPage);
    }

    currentTab = targetTab;
    updateActiveNav();
    Runtime.hapticSelection();

    if (currentTab === 'shared-chat') {
      hideSharedChatBadge();
    }

    setTimeout(sendFeaturesToFrame, 150);
  }

  function bindNavButtons() {
    navBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!isTabEnabled(tab)) return;

        const page = getPageByTab(tab);
        navigate(page, tab);
      });
    });
  }

  function bindShellButtons() {
    const settingsButton = document.getElementById('settingsButton');
    const notificationsButton = document.getElementById('notificationsButton');

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

  function bindMessageBus() {
    window.addEventListener('message', (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'navigate') {
        const targetTab = data.tab || getTabByPage(data.page) || currentTab;

        if (!isTabEnabled(targetTab)) {
          const fallbackTab = getFallbackTab();
          navigate(getPageByTab(fallbackTab), fallbackTab);
          return;
        }

        navigate(data.page || getPageByTab(targetTab), targetTab);
        return;
      }

      if (data.type === 'shared-chat-unread') {
        const badge = document.getElementById('sharedChatBadge');
        if (!badge) return;

        if (currentTab === 'shared-chat') {
          badge.style.display = 'none';
          return;
        }

        badge.style.display = data.hasUnread ? 'block' : 'none';
        return;
      }

      if (data.type === 'request-user-profile') {
        if (USERPROFILE && frame && frame.contentWindow) {
          frame.contentWindow.postMessage(
            {
              type: 'user-profile',
              profile: USERPROFILE
            },
            '*'
          );
        }
        return;
      }

      if (data.type === 'save-user-profile') {
        USERPROFILE = data.profile || data;
        sendUserProfileToFrame();
        return;
      }

      if (data.type === 'request-app-features') {
        sendFeaturesToFrame();
      }
    });
  }

  async function bootstrap() {
    Runtime.ready();
    Runtime.expand();

    try {
      const tenantConfig = await window.AICTenant.load();
      APPFEATURES = tenantConfig.features || APPFEATURES;
    } catch (error) {
      console.error('Tenant config load failed:', error);
    }

    buildPageConfig();
    updateNavVisibility();
    bindNavButtons();
    bindShellButtons();
    bindMessageBus();

    const initialTab = isTabEnabled('home') ? 'home' : getFallbackTab();
    navigate(getPageByTab(initialTab), initialTab);
  }

  document.addEventListener('DOMContentLoaded', bootstrap);

  window.AICAppShell = {
    navigate,
    getCurrentTab: () => currentTab,
    getFeatures: () => APPFEATURES,
    getPageConfig: () => PAGECONFIG
  };
})();
