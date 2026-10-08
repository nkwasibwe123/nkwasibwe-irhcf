"use strict";

const fs = require("fs");

const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

function assertToken(accessToken) {
  if (!accessToken) throw new Error("YouTube access token is required.");
}

async function uploadVideo({
  accessToken,
  filePath,
  title,
  description = "",
  tags = [],
  privacyStatus = "private",
  categoryId = "10"
} = {}) {
  assertToken(accessToken);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("The YouTube video file does not exist.");
  }
  if (!title) throw new Error("A YouTube video title is required.");

  const metadata = {
    snippet: {
      title: String(title).slice(0, 100),
      description: String(description).slice(0, 5000),
      tags: Array.isArray(tags) ? tags.map(String).slice(0, 500) : [],
      categoryId: String(categoryId)
    },
    status: {
      privacyStatus: ["private", "unlisted", "public"].includes(privacyStatus)
        ? privacyStatus
        : "private"
    }
  };

  const init = await fetch(UPLOAD_ENDPOINT + "?part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/*"
    },
    body: JSON.stringify(metadata)
  });

  if (!init.ok) {
    const body = await init.text();
    const error = new Error("YouTube resumable upload initialization failed.");
    error.code = "YOUTUBE_UPLOAD_INIT_FAILED";
    error.details = body.slice(0, 2000);
    throw error;
  }

  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload location.");

  const stream = fs.createReadStream(filePath);
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "video/*"
    },
    body: stream,
    duplex: "half"
  });

  const payload = await upload.json().catch(async () => ({
    raw: (await upload.text()).slice(0, 2000)
  }));

  if (!upload.ok) {
    const error = new Error("YouTube video upload failed.");
    error.code = "YOUTUBE_UPLOAD_FAILED";
    error.details = payload;
    throw error;
  }

  return {
    operation: "videos.insert",
    scope: YOUTUBE_UPLOAD_SCOPE,
    video: payload
  };
}

module.exports = {
  UPLOAD_ENDPOINT,
  YOUTUBE_UPLOAD_SCOPE,
  uploadVideo
};
