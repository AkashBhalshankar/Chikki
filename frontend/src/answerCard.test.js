import test from "node:test";
import assert from "node:assert/strict";
import { clampLines, wrapLines } from "./answerCard.js";

const measure = (text) => text.length * 10; // every character is 10 wide

test("lines wrap at word boundaries and respect paragraphs", () => {
  assert.deepEqual(wrapLines("aaa bbb ccc ddd", 70, measure), ["aaa bbb", "ccc ddd"]);
  assert.deepEqual(wrapLines("one\n\ntwo", 200, measure), ["one", "", "two"]);
});

test("a word wider than the line is broken instead of overflowing", () => {
  const lines = wrapLines("abcdefghijkl", 50, measure);
  assert.ok(lines.length > 1 && lines.every((line) => measure(line) <= 50));
  assert.equal(lines.join(""), "abcdefghijkl");
});

test("clamping adds an ellipsis only when something was cut", () => {
  assert.deepEqual(clampLines(["a", "b"], 3), ["a", "b"]);
  assert.deepEqual(clampLines(["a", "b", "c, "], 2), ["a", "b…"]);
});

test("empty input gives no lines", () => {
  assert.deepEqual(wrapLines("", 100, measure), []);
  assert.deepEqual(wrapLines("   \n  ", 100, measure), []);
});
