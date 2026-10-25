"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getLocalImageServiceStatus } = require("./media-provider-status");

test("local image service status is disabled when URL and token are absent", () => {
  assert.deepEqual(getLocalImageServiceStatus({}), {
    urlConfigured: false, tokenConfigured: false, enabled: false
  });
});

test("local image service status reports a missing token without exposing values", () => {
  assert.deepEqual(getLocalImageServiceStatus({
    IRHCF_IMAGE_SERVICE_URL: "https://image-service.example",
    IRHCF_IMAGE_SERVICE_TOKEN: ""
  }), { urlConfigured: true, tokenConfigured: false, enabled: false });
});

test("local image service status is enabled only when URL and token are configured", () => {
  assert.deepEqual(getLocalImageServiceStatus({
    IRHCF_IMAGE_SERVICE_URL: "https://image-service.example/",
    IRHCF_IMAGE_SERVICE_TOKEN: "private-test-token"
  }), { urlConfigured: true, tokenConfigured: true, enabled: true });
});
