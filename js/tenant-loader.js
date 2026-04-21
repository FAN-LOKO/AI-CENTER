(function () {
  'use strict';

  /* =========================================================
   * TENANT DEFAULTS
   * Что здесь:
   * - tenant по умолчанию
   * - базовая папка конфигов
   * - имя общего продуктового конфига
   * ========================================================= */
  const DEFAULT_TENANT = 'fitline';
  const TENANT_CONFIG_BASE = 'config/tenants';
  const PRODUCT_CONFIG_NAME = 'product-config.json';

  /* =========================================================
   * HOST MAP
   * Что здесь:
   * - маппинг hostname -> tenantId
   * - один shell, много компаний
   * ========================================================= */
  const HOST_MAP = {
    'fit.ai-center.app': 'fitline',
    'www.fit.ai-center.app': 'fitline',
    'fitline.local': 'fitline'
  };

  /* =========================================================
   * URL / HOST HELPERS
   * Что здесь:
   * - вспомогательные функции для текущего хоста
   * ========================================================= */
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
   * TENANT RESOLUTION
   * Что здесь:
   * - определение tenantId
   * - приоритет: hostname -> query(local) -> fallback
   * ========================================================= */
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
   * FETCH HELPERS
   * Что здесь:
   * - загрузка json-файлов
   * - загрузка общего product-config
   * - загрузка tenant override
   * ========================================================= */
  async function fetchJsonConfig(configUrl, debugMeta = {}) {
    const response = await fetch(configUrl, { cache: 'no-store' });

    if (!response.ok) {
      console.error('[AI CENTER][Tenant] config fetch failed', {
        status: response.status,
        statusText: response.statusText,
        configUrl,
        ...debugMeta,
        ...getHostDebugContext()
      });

      throw new Error(`Failed to load config: ${configUrl}`);
    }

    const config = await response.json();

    if (!config || typeof config !== 'object') {
      throw new Error(`Invalid config payload: ${configUrl}`);
    }

    return config;
  }

  async function loadProductConfig() {
    const configUrl = `${TENANT_CONFIG_BASE}/${PRODUCT_CONFIG_NAME}`;
    return fetchJsonConfig(configUrl, {
      configType: 'product',
      configName: PRODUCT_CONFIG_NAME
    });
  }

  async function loadTenantConfig(tenantId) {
    const configUrl = `${TENANT_CONFIG_BASE}/${tenantId}.json`;
    return fetchJsonConfig(configUrl, {
      configType: 'tenant',
      tenantId
    });
  }

  /* =========================================================
   * MERGE HELPERS
   * Что здесь:
   * - merge простых объектов
   * - merge массивов модулей по id
   * - сборка итогового runtime config
   * ========================================================= */

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function mergeShallowObjects(baseObj, overrideObj) {
    return {
      ...(isPlainObject(baseObj) ? baseObj : {}),
      ...(isPlainObject(overrideObj) ? overrideObj : {})
    };
  }

  function mergeModuleArrays(baseModules, overrideModules) {
    const baseList = Array.isArray(baseModules) ? baseModules : [];
    const overrideList = Array.isArray(overrideModules) ? overrideModules : [];

    const overrideMap = new Map();
    overrideList.forEach((module) => {
      if (!module || !module.id) return;
      overrideMap.set(module.id, module);
    });

    const merged = baseList.map((baseModule) => {
      if (!baseModule || !baseModule.id) return baseModule;
      const overrideModule = overrideMap.get(baseModule.id);

      if (!overrideModule) {
        return { ...baseModule };
      }

      overrideMap.delete(baseModule.id);

      return {
        ...baseModule,
        ...overrideModule
      };
    });

    overrideMap.forEach((module) => {
      merged.push({ ...module });
    });

    return merged;
  }

  function buildMergedConfig(productConfig, tenantConfig, tenantId) {
    const product = isPlainObject(productConfig) ? productConfig : {};
    const tenant = isPlainObject(tenantConfig) ? tenantConfig : {};

    const merged = {
      ...product,
      ...tenant,

      tenantId: tenant.tenantId || tenantId || product.tenantId || null,

      domains: mergeShallowObjects(product.domains, tenant.domains),
      theme: mergeShallowObjects(product.theme, tenant.theme),
      features: mergeShallowObjects(product.features, tenant.features),
      home: mergeShallowObjects(product.home, tenant.home),
      support: mergeShallowObjects(product.support, tenant.support),
      legal: mergeShallowObjects(product.legal, tenant.legal),
      affiliate: mergeShallowObjects(product.affiliate, tenant.affiliate),
      navigation: mergeShallowObjects(product.navigation, tenant.navigation),
      sections: mergeShallowObjects(product.sections, tenant.sections),
      policyLinks: mergeShallowObjects(product.policyLinks, tenant.policyLinks),
      texts: mergeShallowObjects(product.texts, tenant.texts),

      modules: mergeModuleArrays(product.modules, tenant.modules),

      plans: Array.isArray(tenant.plans)
        ? tenant.plans
        : Array.isArray(product.plans)
          ? product.plans
          : []
    };

    return merged;
  }

  /* =========================================================
   * THEME APPLICATION
   * Что здесь:
   * - применение tenant theme в CSS custom properties
   * - установка theme-color
   * ========================================================= */
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
   * TEXT APPLICATION
   * Что здесь:
   * - безопасное обновление shell-текстов
   * - применение app title и nav labels
   * ========================================================= */
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
   * BRANDING APPLICATION
   * Что здесь:
   * - применение theme + texts из итогового merged config
   * ========================================================= */
  function applyBranding(config) {
    if (!config || typeof config !== 'object') return;

    applyTexts(config.texts || {}, config.appName || 'AI CENTER');
    applyTheme(config.theme || {});
  }

  /* =========================================================
   * TENANT LOADER API
   * Что здесь:
   * - загрузка product config и tenant config
   * - merge в единый runtime config
   * - публичные геттеры для shell и страниц
   * ========================================================= */
  const TenantLoader = {
    config: null,
    productConfig: null,
    tenantConfig: null,
    tenantId: null,
    loadPromise: null,

    async load() {
      if (this.loadPromise) {
        return this.loadPromise;
      }

      this.loadPromise = (async () => {
        const tenantId = resolveTenantId();

        const [productConfig, tenantConfig] = await Promise.all([
          loadProductConfig(),
          loadTenantConfig(tenantId)
        ]);

        const mergedConfig = buildMergedConfig(productConfig, tenantConfig, tenantId);

        this.tenantId = tenantId;
        this.productConfig = productConfig;
        this.tenantConfig = tenantConfig;
        this.config = mergedConfig;

        applyBranding(mergedConfig);

        console.info('[AI CENTER][Tenant] merged config loaded', {
          tenantId: mergedConfig.tenantId || tenantId,
          appName: mergedConfig.appName || 'AI CENTER',
          primaryDomain: mergedConfig.domains?.primary || null,
          modulesCount: Array.isArray(mergedConfig.modules) ? mergedConfig.modules.length : 0
        });

        return mergedConfig;
      })();

      return this.loadPromise;
    },

    getConfig() {
      return this.config;
    },

    getProductConfig() {
      return this.productConfig;
    },

    getTenantOverlay() {
      return this.tenantConfig;
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
        domains: this.config?.domains || {},
        hasProductConfig: !!this.productConfig,
        hasTenantOverlay: !!this.tenantConfig
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
      this.productConfig = null;
      this.tenantConfig = null;
      this.tenantId = null;
      this.loadPromise = null;
    }
  };

  /* =========================================================
   * GLOBAL EXPORT
   * Что здесь:
   * - экспорт tenant loader в window
   * ========================================================= */
  window.AICTenant = TenantLoader;
})();
