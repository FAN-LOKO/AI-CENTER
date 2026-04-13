(function () {
  /* =========================================================
     TENANT DEFAULTS / ЗНАЧЕНИЯ TENANT ПО УМОЛЧАНИЮ
     Fallback tenant used when no explicit tenant is passed
     Tenant по умолчанию, если tenant явно не передан
  ========================================================= */
  const DEFAULT_TENANT = 'fitline';

  /* =========================================================
     TENANT RESOLUTION / ОПРЕДЕЛЕНИЕ TENANT
     Resolves tenant id from URL query parameters
     Определяет tenant id из query-параметров URL
  ========================================================= */
  function getTenantFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tenant');
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
     BRANDING APPLICATION / ПРИМЕНЕНИЕ БРЕНДИНГА
     Applies tenant title, header title and theme to app shell
     Применяет tenant title, заголовок header и тему к shell приложения
  ========================================================= */
  function applyBranding(config) {
    if (!config) return;

    document.title = config.appName || 'AI CENTER';

    const logoText = document.getElementById('appLogoText');
    if (logoText) {
      logoText.textContent = config.headerTitle || config.appName || 'AI CENTER';
    }

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
      const tenantId = getTenantFromQuery() || DEFAULT_TENANT;
      const config = await loadTenantConfig(tenantId);

      this.config = config;
      applyBranding(config);

      return config;
    },

    getConfig() {
      return this.config;
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
