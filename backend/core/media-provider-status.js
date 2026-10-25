"use strict";

function getLocalImageServiceStatus(env = process.env) {
  const urlConfigured = Boolean(String(env.IRHCF_IMAGE_SERVICE_URL || "").trim());
  const tokenConfigured = Boolean(String(env.IRHCF_IMAGE_SERVICE_TOKEN || "").trim());
  return { urlConfigured, tokenConfigured, enabled: urlConfigured && tokenConfigured };
}

module.exports = { getLocalImageServiceStatus };
