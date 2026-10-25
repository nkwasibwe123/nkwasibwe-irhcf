"use strict";

const SORA_API_RETIREMENT_DATE = "2026-09-24";

function getVideoProviderStatus() {
  return {
    available: false,
    provider: "openai_sora",
    code: "VIDEO_PROVIDER_RETIRED",
    retirementDate: SORA_API_RETIREMENT_DATE,
    message: "Gukora video ya HD byahagaritswe by’agateganyo. Igihe cyo guhagarika OpenAI Sora Videos API (2026-09-24) cyararangiye, kandi Nkwasibwe ntirahuza indi serivisi ya video yemejwe."
  };
}

module.exports = { getVideoProviderStatus, SORA_API_RETIREMENT_DATE };
