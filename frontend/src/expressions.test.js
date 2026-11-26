import test from "node:test";
import assert from "node:assert/strict";
import { expressionForMood, expressionForReply, expressionForTurn, expressionForUserInput, MOODS } from "./expressions.js";

test("the model's mood wins and unknown moods are ignored", () => {
  assert.equal(expressionForTurn("proud", "anything"), "proud");
  assert.equal(expressionForTurn("bogus", "Akash built a platform."), "proud");
  assert.equal(expressionForMood("bogus"), null);
});

test("every mood the model may choose has a keyword-free path to a face", () => {
  for (const mood of MOODS) assert.equal(expressionForMood(mood), mood);
});

test("replies that admit a gap look apologetic", () => {
  assert.equal(expressionForReply("I don't have that detail in Akash's resume."), "apologetic");
});

test("visitor input maps to the richer faces", () => {
  const cases = {
    "Hello there": "greet",
    "Congratulations on the launch": "celebrate",
    "Are you sure about that?": "skeptical",
    "Thanks a lot": "grateful",
    "That makes sense": "relieved",
    "What is his hardest challenge?": "determined",
    "Tell me about his projects": "proud",
    "I'm stuck on this": "concerned",
    "yes please": "nod",
    "What does he do?": "curious",
  };
  for (const [input, face] of Object.entries(cases)) assert.equal(expressionForUserInput(input), face, input);
});
