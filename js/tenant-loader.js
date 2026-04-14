(function () {
  'use strict';

  /* =========================================================
     TENANT DEFAULTS / ЗНАЧЕНИЯ TENANT ПО УМОЛЧАНИЮ
     ========================================================= */
  const DEFAULT_TENANT = 'fitline';
  const TENANT_CONFIG_BASE = 'config/tenants';

  /* =========================================================
     HOST MAP / МАППИНГ ДОМЕНОВ НА TENANT
     Один shell — много брендов. Источник резолва по hostname.
     ========================================================= */
  const HOST_MAP = {
    'fit.ai-center.app': 'fitline',
    'www.fit.ai-center.app': 'fitline',
    'fitline.local': 'fitline'
  };

  /* =========================================================
     HELPERS / ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     ========================================================= */
  function getHostname() {
    return window.location.hostname || '';
  }

  function getHost() {
    return window.location.host || '';
  }

  function getOrigin() {
    return window.location.origin || '';
  }

  function getSearch() {
    return window.location.search || '';
  }

  function getTenantFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('tenant');
    return value ? value.trim() : null;
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
    return HOST_MAP[hostname] || null;
  }

  function getHostDebugContext() {
    return {
      hostname: getHostname(),
      host: getHost(),
      origin: getOrigin(),
      search: getSearch()
    };
  }

  /* =========================================================
     TENANT RESOLUTION / ОПРЕДЕЛЕНИЕ TENANT
     Приоритет:
     1) hostname
     2) ?tenant=... только на localhost
     3) fallback tenant
     ========================================================= */
  function resolveTenantId() {
    const hostname = getHostname();
    const tenantFromHost = getTenantFromHostname();
    const tenantFromQuery = getTenantFromQuery();

    if (tenantFromHost) {
      console.info('[AI CENTER][Tenant] source=hostname', {
        hostname,
        tenantId: tenantFromHost
      });
      return tenantFromHost;
    }

    if (isLocalhostHost(hostname) && tenantFromQuery) {
      console.info('[AI CENTER][Tenant] source=query', {
        hostname,
        tenantId: tenantFromQuery
      });
      return tenantFromQuery;
    }

    if (!isLocalhostHost(hostname) && tenantFromQuery) {
      console.warn('[AI CENTER][Tenant] query tenant ignored on non-local host', {
        hostname,
        tenantId: tenantFromQuery
      });
    }

    if (!tenantFromHost) {
      console.warn('[AI CENTER][Tenant] hostname is not mapped, fallback tenant used', {
        hostname,
        fallbackTenant: DEFAULT_TENANT
      });
    }

    console.info('[AI CENTER][Tenant] source=fallback', {
      hostname,
      tenantId: DEFAULT_TENANT
    });

    return DEFAULT_TENANT;
  }

  /* =========================================================
     CONFIG LOADING / ЗАГРУЗКА TENANT-КОНФИГА
     ========================================================= */
  async function loadTenantConfig(tenantId) {
    const configUrl = `${TENANT_CONFIG_BASE}/${tenantId}.json`;
    const response = await fetch(configUrl, { cache: 'no-store' });

    if (!response.ok) {
      console.error('[AI CENTER][Tenant] config fetch failed', {
        tenantId,
        status: response.status,
        statusText: response.statusText,
        configUrl,
        ...getHostDebugContext()
      });

      throw new Error(`Failed to load tenant config: ${tenantId}`);
    }

    const config = await response.json();

    if (!config || typeof config !== 'object') {
      throw new Error(`Invalid tenant config payload: ${tenantId}`);
    }

    return config;
  }

  /* =========================================================
     THEME APPLICATION / ПРИМЕНЕНИЕ ТЕМЫ
     Применяет tenant theme в CSS custom properties
     ========================================================= */
  function applyTheme(theme) {
    if (!theme || typeof theme !== 'object') return;

    const root = document.documentElement;

    if (theme.primary) {
      root.style.setProperty('--brand-primary', theme.primary);
    }

    if (theme.primaryDark) {
      root.style.setProperty('--brand-primary-dark', theme.primaryDark);
    }

    if (theme.primarySoft) {
      root.style.setProperty('--brand-primary-soft', theme.primarySoft);
    }

    if (theme.bgStart) {
      root.style.setProperty('--brand-bg-start', theme.bgStart);
    }

    if (theme.bgMid) {
      root.style.setProperty('--brand-bg-mid', theme.bgMid);
    }

    if (theme.bgAccent) {
      root.style.setProperty('--brand-bg-accent', theme.bgAccent);
    }

    if (theme.bgEnd) {
      root.style.setProperty('--brand-bg-end', theme.bgEnd);
    }

    if (theme.primary) {
      let themeMeta = document.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = document.createElement('meta');
        themeMeta.setAttribute('name', 'theme-color');
        document.head.appendChild(themeMeta);
      }
      themeMeta.setAttribute('content', theme.primary);
    }
  }

  /* =========================================================
     TEXT APPLICATION / ПРИМЕНЕНИЕ ТЕКСТОВ
     Безопасно обновляет shell-элементы, если они есть на странице
     ========================================================= */
  function setTextIfExists(id, value) {
    if (!value) return;
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function applyTexts(texts, fallbackAppName) {
    if (!texts || typeof texts !== 'object') return;

    document.title = texts.appTitle || fallbackAppName || 'AI CENTER';

    setTextIfExists('appLogoText', texts.headerTitle || fallbackAppName || 'AI CENTER');
    setTextIfExists('navLabelHome', texts.navHome);
    setTextIfExists('navLabelMyAgent', texts.navMyAgent);
    setTextIfExists('navLabelSharedChat', texts.navSharedChat);
    setTextIfExists('navLabelModules', texts.navModules);
    setTextIfExists('navLabelAffiliate', texts.navAffiliate);
    setTextIfExists('navLabelPayments', texts.navPayments);
    setTextIfExists('navLabelSettings', texts.navSettings);
  }

  /* =========================================================
     BRANDING APPLICATION / ПРИМЕНЕНИЕ БРЕНДИНГА
     ========================================================= */
  function applyBranding(config) {
    if (!config || typeof config !== 'object') return;

    applyTexts(config.texts || {}, config.appName || 'AI CENTER');
    applyTheme(config.theme || {});
  }

  /* =========================================================
     TENANT LOADER API / API ЗАГРУЗЧИКА TENANT
     ========================================================= */
  const TenantLoader = {
    config: null,
    tenantId: null,
    loadPromise: null,

    async load() {
      if (this.loadPromise) {
        return this.loadPromise;
      }

      this.loadPromise = (async () => {
        const tenantId = resolveTenantId();
        const config = await loadTenantConfig(tenantId);

        this.tenantId = tenantId;
        this.config = config;

        applyBranding(config);

        console.info('[AI CENTER][Tenant] config loaded', {
          tenantId: config.tenantId || tenantId,
          appName: config.appName || 'AI CENTER',
          primaryDomain: config.domains?.primary || null
        });

        return config;
      })();

      return this.loadPromise;
    },

    getConfig() {
      return this.config;
    },

    getTenantId() {
      return this.config?.tenantId || this.tenantId || null;
    },

    getDebugContext() {
      return {
        resolvedTenantId: this.getTenantId(),
        hostname: getHostname(),
        host: getHost(),
        origin: getOrigin(),
        search: getSearch(),
        domains: this.config?.domains || {}
      };
    },

    getDomains() {
      return this.config?.domains || {};
    },

    getFeatures() {
      return this.config?.features || {};
    },

    getModules() {
      return this.config?.modules || [];
    },

    getSections() {
      return this.config?.sections || {};
    },

    getPlans() {
      return this.config?.plans || [];
    },

    getTexts() {
      return this.config?.texts || {};
    },

    getAppName() {
      return this.config?.appName || 'AI CENTER';
    },

    getPolicyLinks() {
      return this.config?.policyLinks || {};
    },

    getTheme() {
      return this.config?.theme || {};
    },

    reset() {
      this.config = null;
      this.tenantId = null;
      this.loadPromise = null;
    }
  };

  /* =========================================================
     GLOBAL EXPORT / ГЛОБАЛЬНЫЙ ЭКСПОРТ
     ========================================================= */
  window.AICTenant = TenantLoader;
})();
