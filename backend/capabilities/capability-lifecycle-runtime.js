"use strict";

const { runCapabilityLifecycle } = require("./capability-lifecycle");
const { createPostgresLifecycleStore } = require("./postgres-lifecycle-store");

/**
 * Production composition root. Providers are injected deliberately: an
 * unconfigured research/build/security/deploy provider must block, never
 * silently become a successful mock.
 */
function createCapabilityLifecycleRuntime({ pool, adapters, maxRepairs } = {}) {
  const store = createPostgresLifecycleStore(pool);
  return {
    store,
    run(request) {
      return runCapabilityLifecycle({ request, adapters: adapters || {}, store, maxRepairs });
    }
  };
}

module.exports = { createCapabilityLifecycleRuntime };
