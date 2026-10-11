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
    },
    async start(request) {
      let resolveCreated;
      let rejectCreated;
      let created = false;
      const started = new Promise((resolve, reject) => {
        resolveCreated = record => {
          created = true;
          resolve(record);
        };
        rejectCreated = reject;
      });
      const completion = runCapabilityLifecycle({
        request,
        adapters: adapters || {},
        store,
        maxRepairs,
        onCreated: record => resolveCreated(record)
      });
      // Keep the background promise observed even if the HTTP client disconnects.
      completion.catch(error => {
        if (!created) rejectCreated(error);
      });
      const record = await started;
      return { record, completion };
    }
  };
}

module.exports = { createCapabilityLifecycleRuntime };
