"use strict";

/**
 * Authorized YouTube publishing adapter.
 *
 * The adapter deliberately requires an injected OAuth client and upload
 * implementation. It never accepts a raw password and never bypasses
 * Google's authorization flow.
 */

const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

function validatePublishRequest({ accessToken, filePath, title } = {}) {
  if (!accessToken) throw new Error("YouTube authorization is required.");
  if (!filePath) throw new Error("A rendered video file is required.");
  if (!title) throw new Error("A YouTube title is required.");
  return true;
}

async function publishVideo({
  accessToken,
  filePath,
  title,
  description = "",
  tags = [],
  privacyStatus = "private",
  categoryId = "10",
  uploader
} = {}) {
  validatePublishRequest({ accessToken, filePath, title });
  if (typeof uploader !== "function") {
    throw new Error("No configured YouTube upload provider is available.");
  }

  const result = await uploader({
    accessToken,
    filePath,
    metadata: {
      title,
      description,
      tags: Array.isArray(tags) ? tags : [],
      privacyStatus,
      categoryId
    },
    scope: YOUTUBE_UPLOAD_SCOPE
  });

  return {
    provider: "youtube",
    operation: "videos.insert",
    result
  };
}

function buildDailyTwoSongSchedule({ timezone = "UTC", firstTime = "09:00", secondTime = "21:00" } = {}) {
  return {
    frequency: "daily",
    itemsPerDay: 2,
    timezone,
    times: [firstTime, secondTime],
    requires: ["rendered_video", "youtube_authorization", "publish_verification"]
  };
}

module.exports = {
  YOUTUBE_UPLOAD_SCOPE,
  validatePublishRequest,
  publishVideo,
  buildDailyTwoSongSchedule
};
