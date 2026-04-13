(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

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

    openExternalLink(url) {
      if (!url) return;

      if (tg && typeof tg.openLink === 'function') {
        tg.openLink(url);
        return;
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },

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

  window.AICRuntime = Runtime;
})();
