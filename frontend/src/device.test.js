import test from "node:test";
import assert from "node:assert/strict";
import { isMobileDevice, telHref } from "./device.js";

const win = (coarse) => ({ matchMedia: () => ({ matches: coarse }) });

test("phones are mobile", () => {
  assert.equal(isMobileDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" }, win(true)), true);
  assert.equal(isMobileDevice({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" }, win(true)), true);
});

test("iPad that reports a desktop user agent is mobile", () => {
  assert.equal(isMobileDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 }, win(true)), true);
});

test("desktop is not mobile", () => {
  assert.equal(isMobileDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/120", maxTouchPoints: 0 }, win(false)), false);
  assert.equal(isMobileDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 }, win(false)), false);
});

test("builds a clean tel link", () => {
  assert.equal(telHref("+91 90141-60774"), "tel:+919014160774");
});
