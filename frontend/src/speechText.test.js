import test from "node:test";
import assert from "node:assert/strict";
import { cleanForBrowserSpeech, correctTranscript, isLowConfidence } from "./speechText.js";

test("fixes misheard names", () => {
  assert.equal(correctTranscript("tell me about aakash"), "tell me about Akash");
  assert.equal(correctTranscript("hey chiki what can you do"), "hey Chikki what can you do");
});

test("fixes misheard tech terms", () => {
  assert.equal(correctTranscript("does he know fast a p i"), "does he know FastAPI");
  assert.equal(correctTranscript("lang graph and lang chain"), "LangGraph and LangChain");
  assert.equal(correctTranscript("what about rag and l l m apps"), "what about RAG and LLM apps");
  assert.equal(correctTranscript("his git hub and web sockets work"), "his GitHub and WebSockets work");
});

test("leaves normal sentences alone", () => {
  assert.equal(correctTranscript("What  are his strongest skills?"), "What are his strongest skills?");
  assert.equal(correctTranscript("He built a rack of servers"), "He built a rack of servers");
});

test("cleans text for the browser voice", () => {
  assert.equal(
    cleanForBrowserSpeech("**Akash** built `Chikki` 🚀 see https://example.com\n- FastAPI"),
    "Akash built Chikki see FastAPI",
  );
  assert.equal(cleanForBrowserSpeech("Sure. [[action:contact]]"), "Sure.");
});

test("low confidence detection", () => {
  assert.equal(isLowConfidence(0.2), true);
  assert.equal(isLowConfidence(0.9), false);
  assert.equal(isLowConfidence(0), false);
  assert.equal(isLowConfidence(undefined), false);
});
