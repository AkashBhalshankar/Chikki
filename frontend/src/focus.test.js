import test from "node:test";
import assert from "node:assert/strict";
import { resumeFocusFromMessages } from "./focus.js";

const user = (content) => ({ role: "user", content });

test("keeps topic words and drops filler and trailing punctuation", () => {
  const messages = [
    user("Which companies has Akash worked at, and what did he build there?"),
    { role: "assistant", content: "He built agents at UBS." },
    user("Tell me more about that."),
  ];
  assert.equal(resumeFocusFromMessages(messages), "companies worked build");
});

test("keeps technical terms intact", () => {
  assert.equal(resumeFocusFromMessages([user("Does he know C# and LangGraph RAG?")]), "know C# LangGraph RAG");
});

test("only the latest five questions count and duplicates collapse", () => {
  const messages = ["alpha one", "beta two", "gamma three", "delta four", "epsilon five", "zeta six"].map(user);
  const focus = resumeFocusFromMessages(messages);
  assert.ok(!focus.includes("alpha") && focus.includes("zeta"));
  assert.equal(resumeFocusFromMessages([user("python python PYTHON")]), "python PYTHON");
});

test("empty input gives an empty focus", () => {
  assert.equal(resumeFocusFromMessages([]), "");
  assert.equal(resumeFocusFromMessages([user("Tell me more about that.")]), "");
});
