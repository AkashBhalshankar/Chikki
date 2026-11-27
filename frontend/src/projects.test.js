import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, projectsMentioned } from "./projects.js";
import { INTERVIEW_ROLES, nextStep, roleById, summaryQuestion } from "./interview.js";

test("a card is offered for each project an answer names, in order, at most three", () => {
  const names = (text) => projectsMentioned(text).map((p) => p.id);
  assert.deepEqual(names("He built ShareInSync and also Chikki."), ["shareinsync", "chikki"]);
  assert.deepEqual(names("Nothing about projects here."), []);
  assert.deepEqual(names("He also built NaChitram."), ["nachitram"]);
  assert.equal(projectsMentioned("Chikki, ShareInSync, AgriMentor, NaChitram and NavLearn").length, 3);
  assert.equal(names("The Request Management Service at UBS")[0], "request-management");
});

test("every project has a stack and highlights", () => {
  for (const project of PROJECTS) {
    assert.ok(project.stack.length && project.highlights.length && project.match.length, project.id);
  }
});

test("the interview asks each question, then the verdict, then finishes", () => {
  const role = roleById("ai");
  assert.equal(INTERVIEW_ROLES.length, 4);
  assert.equal(nextStep(role, 1).kind, "question");
  assert.equal(nextStep(role, role.questions.length).kind, "summary");
  assert.equal(nextStep(role, role.questions.length).text, summaryQuestion(role));
  assert.equal(nextStep(role, role.questions.length + 1).kind, "done");
  assert.equal(roleById("nope"), null);
});

test("projects with a live link come first, and cards for an answer put them first too", () => {
  const live = PROJECTS.filter((p) => p.url).map((p) => p.id);
  assert.deepEqual(PROJECTS.slice(0, live.length).map((p) => p.id), live);
  assert.deepEqual(live, ["chikki", "shareinsync", "nachitram"]);
  for (const project of PROJECTS.filter((p) => p.url)) assert.ok(project.url.startsWith("https://"), project.id);
  const names = (text) => projectsMentioned(text).map((p) => p.id);
  assert.deepEqual(names("The Request Management Service at UBS and also ShareInSync"), ["shareinsync", "request-management"]);
});
