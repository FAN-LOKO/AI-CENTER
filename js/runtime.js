(function () {
  /* =========================================================
     TELEGRAM RUNTIME DETECTION / ОПРЕДЕЛЕНИЕ TELEGRAM RUNTIME
     Detects Telegram WebApp object if miniapp is launched in Telegram
     Определяет объект Telegram WebApp, если miniapp открыт внутри Telegram
  ========================================================= */
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  /* =========================================================
     RUNTIME ADAPTER API / API RUNTIME-АДАПТЕРА
     Unified runtime interface for Telegram, Web and future PWA mode
     Единый runtime-интерфейс для Telegram, Web и будущего PWA-режима
  ========================================================= */
  const Runtime = {
    isTelegram() {
      return !!tg;
    },

    isWeb() {
      return !tg;
    },

    isPWA() {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    },

    /* =========================================================
       APP LIFECYCLE / ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ
       Signals readiness and expands Telegram miniapp when available
       Сообщает о готовности и раскрывает miniapp в Telegram, если доступно
    ========================================================= */
    ready() {
      if (tg && typeof tg.ready === 'function') {
        tg.ready();
      }
    },

    expand() {
      if (tg && typeof tg.expand === 'function') {
        tg.expand();
      }
    },

    /* =========================================================
       HAPTIC FEEDBACK / ТАКТИЛЬНАЯ ОБРАТНАЯ СВЯЗЬ
       Provides unified haptic methods for supported runtimes
       Предоставляет единые методы haptic feedback для поддерживаемых runtime
    ========================================================= */
    hapticSelection() {
      if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.selectionChanged === 'function') {
        tg.HapticFeedback.selectionChanged();
      }
    },

    hapticNotify(type) {
      if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === 'function') {
        tg.HapticFeedback.notificationOccurred(type || 'success');
      }
    },

    /* =========================================================
       EXTERNAL NAVIGATION / ВНЕШНЯЯ НАВИГАЦИЯ
       Opens external links via Telegram bridge or browser fallback
       Открывает внешние ссылки через Telegram bridge или fallback браузера
    ========================================================= */
    openExternalLink(url) {
      if (!url) return;

      if (tg && typeof tg.openLink === 'function') {
        tg.openLink(url);
        return;
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },

    /* =========================================================
       RUNTIME CONTEXT / КОНТЕКСТ RUNTIME
       Returns current launch environment and access to Telegram WebApp
       Возвращает текущий контекст запуска и доступ к Telegram WebApp
    ========================================================= */
    getLaunchContext() {
      return {
        isTelegram: this.isTelegram(),
        isWeb: this.isWeb(),
        isPWA: this.isPWA()
      };
    },

    getTelegramWebApp() {
      return tg;
    }
  };

  /* =========================================================
     GLOBAL EXPORT / ГЛОБАЛЬНЫЙ ЭКСПОРТ
     Exposes runtime adapter to shell and page layers
     Открывает runtime-адаптер для shell и page-слоя
  ========================================================= */
  window.AICRuntime = Runtime;
})();
