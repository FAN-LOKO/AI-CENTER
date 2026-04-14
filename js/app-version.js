(function initAppVersion(global) {
  const runtime = global.AICRuntime || {};
  const version = {
    appVersion: "0.1.0-dev",
    buildVersion: "local-dev",
    commitHash: null,
    builtAt: null,
    source: "static-dev"
  };

  global.AICRuntime = {
    ...runtime,
    version,
    getVersionInfo() {
      return { ...version };
    }
  };
})(window);
