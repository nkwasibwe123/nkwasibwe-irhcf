"use strict";

const ALLOWED_FREQUENCIES = Object.freeze([
  "once","daily","weekly","monthly"
]);

function validateSchedule(schedule = {}) {
  const frequency = String(schedule.frequency || "").toLowerCase();
  if (!ALLOWED_FREQUENCIES.includes(frequency)) {
    throw new Error("Unsupported schedule frequency.");
  }
  if (!schedule.timezone) throw new Error("Schedule timezone is required.");
  if (!Array.isArray(schedule.actions) || !schedule.actions.length) {
    throw new Error("At least one scheduled action is required.");
  }
  return {
    frequency,
    timezone: schedule.timezone,
    times: Array.isArray(schedule.times) ? schedule.times : [],
    actions: schedule.actions,
    enabled: schedule.enabled !== false
  };
}

function buildYouTubeTwoPerDayPlan({ timezone = "Africa/Kigali" } = {}) {
  return validateSchedule({
    frequency: "daily",
    timezone,
    times: ["09:00", "21:00"],
    actions: [
      { type: "create_song_video", sequence: 1 },
      { type: "publish_youtube", sequence: 2 },
      { type: "create_song_video", sequence: 3 },
      { type: "publish_youtube", sequence: 4 }
    ]
  });
}

module.exports = { ALLOWED_FREQUENCIES, validateSchedule, buildYouTubeTwoPerDayPlan };
