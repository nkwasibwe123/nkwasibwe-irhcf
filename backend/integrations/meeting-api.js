"use strict";

const BASE_URL = "https://meet.googleapis.com/v2";

async function request({ accessToken, path, method = "GET", body } = {}) {
  if (!accessToken) throw new Error("Meeting access token is required.");

  const response = await fetch(BASE_URL + path, {
    method,
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || "Meeting API request failed."
    );
    error.code = "MEETING_API_FAILED";
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function createSpace({ accessToken, config = {} } = {}) {
  return request({
    accessToken,
    path: "/spaces",
    method: "POST",
    body: config
  });
}

async function getSpace({ accessToken, spaceName } = {}) {
  if (!spaceName) throw new Error("Meeting space name is required.");
  return request({
    accessToken,
    path: "/" + encodeURIComponent(spaceName)
  });
}

async function listParticipants({ accessToken, conferenceRecord } = {}) {
  if (!conferenceRecord) throw new Error("Conference record is required.");
  return request({
    accessToken,
    path:
      "/conferenceRecords/" +
      encodeURIComponent(conferenceRecord) +
      "/participants"
  });
}

async function listTranscripts({ accessToken, conferenceRecord } = {}) {
  if (!conferenceRecord) throw new Error("Conference record is required.");
  return request({
    accessToken,
    path:
      "/conferenceRecords/" +
      encodeURIComponent(conferenceRecord) +
      "/transcripts"
  });
}

module.exports = {
  BASE_URL,
  request,
  createSpace,
  getSpace,
  listParticipants,
  listTranscripts
};
