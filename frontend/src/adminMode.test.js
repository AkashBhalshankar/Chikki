import test from "node:test";
import assert from "node:assert/strict";
import { adminFromSearch, isToggleShortcut, readAdminUi, writeAdminUi } from "./adminMode.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
}

test("reads the admin flag from the address", () => {
  assert.equal(adminFromSearch("?admin=1"), true);
  assert.equal(adminFromSearch("?admin"), true);
  assert.equal(adminFromSearch("?admin=0"), false);
  assert.equal(adminFromSearch("?admin=off"), false);
  assert.equal(adminFromSearch("?q=hello"), null);
});

test("remembers the flag for the session only", () => {
  const storage = memoryStorage();
  assert.equal(readAdminUi(storage), false);
  writeAdminUi(true, storage);
  assert.equal(readAdminUi(storage), true);
  writeAdminUi(false, storage);
  assert.equal(readAdminUi(storage), false);
});

test("storage failures are harmless", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() {} };
  assert.equal(readAdminUi(broken), false);
  assert.doesNotThrow(() => writeAdminUi(true, broken));
});

test("keyboard shortcut is Ctrl+Shift+A", () => {
  assert.equal(isToggleShortcut({ ctrlKey: true, shiftKey: true, key: "A" }), true);
  assert.equal(isToggleShortcut({ ctrlKey: true, shiftKey: false, key: "a" }), false);
  assert.equal(isToggleShortcut({ ctrlKey: false, shiftKey: true, key: "A" }), false);
});
