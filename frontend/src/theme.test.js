import test from "node:test";
import assert from "node:assert/strict";
import { applyTheme, nextTheme, normalizeTheme, readTheme } from "./theme.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}

function fakeRoot() {
  const attrs = new Map();
  return { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k), get: (k) => attrs.get(k) };
}

test("only known themes are accepted", () => {
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("neon"), null);
});

test("address wins over saved choice, and dark is the default", () => {
  assert.equal(readTheme("?theme=light", memoryStorage({ chikki_theme: "dark" })), "light");
  assert.equal(readTheme("", memoryStorage({ chikki_theme: "light" })), "light");
  assert.equal(readTheme("", memoryStorage()), "dark");
  assert.equal(readTheme("?theme=neon", memoryStorage()), "dark");
});

test("applies and saves the theme", () => {
  const root = fakeRoot();
  const storage = memoryStorage();
  assert.equal(applyTheme("light", root, storage), "light");
  assert.equal(root.get("data-theme"), "light");
  assert.equal(storage.getItem("chikki_theme"), "light");
  assert.equal(applyTheme("dark", root, storage), "dark");
  assert.equal(root.get("data-theme"), undefined);
});

test("storage failures do not break theming", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readTheme("", broken), "dark");
  assert.doesNotThrow(() => applyTheme("light", fakeRoot(), broken));
});

test("toggles", () => {
  assert.equal(nextTheme("dark"), "light");
  assert.equal(nextTheme("light"), "dark");
});
