import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings, PAUSES, DEFAULTS } from "./settings.js";
import { seasonFor } from "./seasonal.js";
import { timeAgo } from "./github.js";

test("settings fall back to defaults for anything unknown", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
  assert.deepEqual(normalizeSettings({ voice: "robot", speed: 9, pause: "never", sounds: "yes" }), DEFAULTS);
  assert.equal(normalizeSettings({ voice: "sonia", speed: 1.15, pause: "patient", sounds: false }).pause, "patient");
  assert.equal(DEFAULTS.transcript, false);
  assert.equal(normalizeSettings({ transcript: true }).transcript, true);
  assert.ok(PAUSES.fast.afterFinal < PAUSES.normal.afterFinal && PAUSES.normal.afterFinal < PAUSES.patient.afterFinal);
});

test("festive looks appear only on their days", () => {
  assert.equal(seasonFor(new Date(2026, 11, 25)), "santa");
  assert.equal(seasonFor(new Date(2026, 11, 31)), "party");
  assert.equal(seasonFor(new Date(2027, 0, 1)), "party");
  assert.equal(seasonFor(new Date(2027, 0, 26)), "tricolor");
  assert.equal(seasonFor(new Date(2026, 7, 15)), "tricolor");
  assert.equal(seasonFor(new Date(2026, 10, 8)), "diya");
  assert.equal(seasonFor(new Date(2026, 5, 10)), null);
});

test("time ago reads naturally", () => {
  const now = new Date(2026, 10, 27);
  assert.equal(timeAgo("2026-11-27", now), "today");
  assert.equal(timeAgo("2026-11-26", now), "yesterday");
  assert.equal(timeAgo("2026-11-20", now), "7 days ago");
  assert.equal(timeAgo("2026-08-27", now), "3 months ago");
  assert.equal(timeAgo("", now), "");
});
