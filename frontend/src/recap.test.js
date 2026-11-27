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
