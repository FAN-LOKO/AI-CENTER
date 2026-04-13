(function () {
  /* =========================================================
     TENANT DEFAULTS / ЗНАЧЕНИЯ TENANT ПО УМОЛЧАНИЮ
     Fallback tenant used when no explicit tenant is passed
     Tenant по умолчанию, если tenant явно не передан
  ========================================================= */
  const DEFAULT_TENANT = 'fitline';

    /* =========================================================
     TENANT RESOLUTION / ОПРЕДЕЛЕНИЕ TENANT
     Resolves tenant by hostname first, then by query param for dev mode
     Сначала определяет tenant по hostname, затем по query param для dev-режима
  ========================================================= */
  function getTenantFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tenant');
  }

  function getHostname() {
    return window.location.hostname || '';
  }

  function isLocalhostHost(hostname) {
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    );
  }

  function getTenantFromHostname() {
    const hostname = getHostname();

    const hostMap = {
      'fit.ai-center.app': 'fitline',
      'www.fit.ai-center.app': 'fitline',
      'fitline.local': 'fitline'
    };

    return hostMap[hostname] || null;
  }

  function resolveTenantId() {
    const hostname = getHostname();
    const tenantFromHost = getTenantFromHostname();

    if (tenantFromHost) {
      return tenantFromHost;
    }

    if (isLocalhostHost(hostname)) {
      return getTenantFromQuery() || DEFAULT_TENANT;
    }

    return DEFAULT_TENANT;
  }

  /* =========================================================
     TENANT CONFIG LOADING / ЗАГРУЗКА TENANT-КОНФИГА
     Loads tenant JSON configuration from config/tenants/
     Загружает tenant JSON-конфиг из папки config/tenants/
  ========================================================= */
  async function loadTenantConfig(tenantId) {
    const response = await fetch(`config/tenants/${tenantId}.json`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to load tenant config: ${tenantId}`);
    }

    return response.json();
  }

  /* =========================================================
     THEME APPLICATION / ПРИМЕНЕНИЕ ТЕМЫ
     Applies tenant theme values into CSS custom properties
     Применяет тему tenant в CSS custom properties
  ========================================================= */
  function applyTheme(theme) {
    if (!theme) return;

    const root = document.documentElement;

    if (theme.primary) root.style.setProperty('--brand-primary', theme.primary);
    if (theme.primaryDark) root.style.setProperty('--brand-primary-dark', theme.primaryDark);
    if (theme.primarySoft) root.style.setProperty('--brand-primary-soft', theme.primarySoft);
    if (theme.bgStart) root.style.setProperty('--brand-bg-start', theme.bgStart);
    if (theme.bgMid) root.style.setProperty('--brand-bg-mid', theme.bgMid);
    if (theme.bgAccent) root.style.setProperty('--brand-bg-accent', theme.bgAccent);
    if (theme.bgEnd) root.style.setProperty('--brand-bg-end', theme.bgEnd);
  }

  /* =========================================================
     TEXT APPLICATION / ПРИМЕНЕНИЕ ТЕКСТОВ
     Applies tenant texts to shell title, header and navigation labels
     Применяет tenant-тексты к title, header и подписям навигации
  ========================================================= */
  function applyTexts(texts, fallbackAppName) {
    if (!texts) return;

    document.title = texts.appTitle || fallbackAppName || 'AI CENTER';

    const logoText = document.getElementById('appLogoText');
    if (logoText) {
      logoText.textContent = texts.headerTitle || fallbackAppName || 'AI CENTER';
    }

    const navLabelHome = document.getElementById('navLabelHome');
    if (navLabelHome && texts.navHome) {
      navLabelHome.textContent = texts.navHome;
    }

    const navLabelMyAgent = document.getElementById('navLabelMyAgent');
    if (navLabelMyAgent && texts.navMyAgent) {
      navLabelMyAgent.textContent = texts.navMyAgent;
    }

    const navLabelSharedChat = document.getElementById('navLabelSharedChat');
    if (navLabelSharedChat && texts.navSharedChat) {
      navLabelSharedChat.textContent = texts.navSharedChat;
    }

    const navLabelModules = document.getElementById('navLabelModules');
    if (navLabelModules && texts.navModules) {
      navLabelModules.textContent = texts.navModules;
    }

    const navLabelAffiliate = document.getElementById('navLabelAffiliate');
    if (navLabelAffiliate && texts.navAffiliate) {
      navLabelAffiliate.textContent = texts.navAffiliate;
    }

    const navLabelPayments = document.getElementById('navLabelPayments');
    if (navLabelPayments && texts.navPayments) {
      navLabelPayments.textContent = texts.navPayments;
    }
  }

  /* =========================================================
     BRANDING APPLICATION / ПРИМЕНЕНИЕ БРЕНДИНГА
     Applies title, shell texts and theme to app shell
     Применяет title, shell-тексты и тему к shell приложения
  ========================================================= */
  function applyBranding(config) {
    if (!config) return;

    applyTexts(config.texts, config.appName || 'AI CENTER');
    applyTheme(config.theme);
  }

  /* =========================================================
     TENANT LOADER API / API ЗАГРУЗЧИКА TENANT
     Stores tenant config and provides accessors for shell usage
     Хранит tenant-конфиг и предоставляет аксессоры для shell
  ========================================================= */
  const TenantLoader = {
    config: null,

        async load() {
      const tenantId = resolveTenantId();
      const config = await loadTenantConfig(tenantId);

      this.config = config;
      applyBranding(config);

      return config;
    },

    getConfig() {
      return this.config;
    },

    getDomains() {
      return this.config?.domains || {};
    },

    getFeatures() {
      return this.config?.features || {};
    },

    getTexts() {
      return this.config?.texts || {};
    },

    getAppName() {
      return this.config?.appName || 'AI CENTER';
    }
  };

  /* =========================================================
     GLOBAL EXPORT / ГЛОБАЛЬНЫЙ ЭКСПОРТ
     Exposes tenant loader to shell and other platform layers
     Открывает tenant-loader для shell и других слоев платформы
  ========================================================= */
  window.AICTenant = TenantLoader;
})();
