import test from "node:test";
import assert from "node:assert/strict";
import { buildRecap, recapMailto } from "./recap.js";
import { loadSaved, persistSaved, toggleSaved, savedId } from "./saved.js";
import { reactionForTranscript, glowFor } from "./expressions.js";

const chat = [
  { role: "user", content: "What are his skills?" },
  { role: "assistant", final: true, content: "**Python** and FastAPI lead. He also uses LangGraph." },
  { role: "user", content: "And projects?" },
  { role: "assistant", final: true, isError: true, content: "Something failed." },
  { role: "user", content: "Contact?" },
];

test("the recap lists each question with the first sentence of its answer", () => {
  const { turns, text } = buildRecap(chat);
  assert.equal(turns.length, 3);
  assert.equal(turns[0].answer, "Python and FastAPI lead.");
  assert.equal(turns[1].answer, "", "an error reply is not summarised");
  assert.match(text, /^My chat with Chikki/);
  assert.equal(buildRecap([]).text, "");
});

test("the recap keeps only the latest turns and the mail link is encoded and bounded", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ role: "user", content: `Question ${i}` }));
  assert.equal(buildRecap(many).turns.length, 8);
  const link = recapMailto("a & b ".repeat(600));
  assert.ok(link.startsWith("mailto:?subject="));
  assert.ok(link.length < 6000);
});

test("saved answers toggle on and off, survive reloads and tolerate a broken store", () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const item = { id: savedId("q", "a"), question: "q", answer: "a" };
  let list = toggleSaved([], item);
  assert.equal(list.length, 1);
  persistSaved(list, storage);
  assert.equal(loadSaved(storage).length, 1);
  assert.equal(toggleSaved(list, item).length, 0);
  assert.notEqual(savedId("q", "a"), savedId("q", "b"));
  assert.deepEqual(loadSaved({ getItem() { throw new Error("blocked"); } }), []);
  memory.set("chikki_saved", "not json");
  assert.deepEqual(loadSaved(storage), []);
});

test("Chikki nods along, reacts to surprise words, and the backdrop glow follows the mood", () => {
  assert.equal(reactionForTranscript(""), null);
  assert.equal(reactionForTranscript("hi"), null);
  assert.equal(reactionForTranscript("tell me about his projects"), "nod");
  assert.equal(reactionForTranscript("wow that is great"), "surprised");
  assert.equal(reactionForTranscript("what is his experience here"), "nod");
  assert.equal(glowFor("happy"), "110,200,90");
  assert.equal(glowFor("thinking"), "90,140,230");
  assert.equal(glowFor("nothing"), null);
});

import { chipItems, splitStats, revealSlice } from "./markdown.js";
import { formatMarker, timeMarker } from "./chatTime.js";

test("short lists of names become chips and sentences stay bullets", () => {
  assert.equal(chipItems(["Python", "FastAPI", "LangGraph", "**React**"]), true);
  assert.equal(chipItems(["Python", "FastAPI"]), false);
  assert.equal(chipItems(["He built a voice assistant.", "He tested it well.", "He shipped it."]), false);
});

test("figures in an answer are picked out", () => {
  const pieces = splitStats("He cut effort by 30-40% over 3+ years across 5-7 applications.");
  assert.deepEqual(pieces.filter((p) => p.stat).map((p) => p.value), ["30-40%", "3+ years", "5-7 applications"]);
  assert.equal(splitStats("no figures here")[0].stat, false);
});

test("the typing reveal never shows half a word or an open bold mark", () => {
  assert.equal(revealSlice("Hello world", 100), "Hello world");
  assert.equal(revealSlice("Hello wonderful world", 9), "Hello");
  const open = revealSlice("He built **LangGraph pipelines** fast", 20);
  assert.ok(open.endsWith("**") && (open.match(/\*\*/g) || []).length % 2 === 0);
  assert.equal(revealSlice("abc", 0), "");
});

test("time markers show for a new day or a long pause, not between quick messages", () => {
  const noon = new Date(2026, 10, 27, 12, 0).getTime();
  assert.match(timeMarker(undefined, noon, noon, "en-US"), /^Today /);
  assert.equal(timeMarker(noon, noon + 5 * 60000, noon, "en-US"), null);
  assert.match(timeMarker(noon, noon + 45 * 60000, noon + 45 * 60000, "en-US"), /^Today /);
  assert.match(formatMarker(noon - 24 * 3600000, noon, "en-US"), /^Yesterday /);
  assert.equal(timeMarker(noon, undefined, noon), null);
});
