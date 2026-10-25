"use strict";

const SORA_API_RETIREMENT_DATE = "2026-09-24";

function getVideoProviderStatus() {
  return {
    available: false,
    provider: "openai_sora",
    code: "VIDEO_PROVIDER_RETIRED",
    retirementDate: SORA_API_RETIREMENT_DATE,
    message: "HD video generation is temporarily unavailable. The OpenAI Sora Videos API retirement date (2026-09-24) has passed, and Nkwasibwe has not yet connected a verified replacement provider."
  };
}

module.exports = { getVideoProviderStatus, SORA_API_RETIREMENT_DATE };
