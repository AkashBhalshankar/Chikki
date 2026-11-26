import test from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, parseInline, plainText } from "./markdown.js";

test("paragraphs and bullet lists become blocks", () => {
  const blocks = parseBlocks("Akash builds agents.\n\n- **LangGraph** platforms\n- ETL checks\n\nMore soon.");
  assert.deepEqual(blocks.map((b) => b.type), ["p", "ul", "p"]);
  assert.deepEqual(blocks[1].items, ["**LangGraph** platforms", "ETL checks"]);
});

test("numbered lines become an ordered list and wrapped lines join one paragraph", () => {
  assert.equal(parseBlocks("1. First\n2. Second")[0].type, "ol");
  const [paragraph] = parseBlocks("one line\nsame paragraph");
  assert.equal(paragraph.text, "one line same paragraph");
});

test("inline bold and code are split out, unfinished markers stay plain", () => {
  assert.deepEqual(parseInline("At **UBS** with `FastAPI`"), [
    { type: "text", value: "At " },
    { type: "bold", value: "UBS" },
    { type: "text", value: " with " },
    { type: "code", value: "FastAPI" },
  ]);
  assert.deepEqual(parseInline("Streaming **UB"), [{ type: "text", value: "Streaming **UB" }]);
});

test("html in a reply stays text and copy drops the formatting marks", () => {
  assert.deepEqual(parseInline("<b>x</b>"), [{ type: "text", value: "<b>x</b>" }]);
  assert.equal(plainText("- **UBS** and `FastAPI`"), "• UBS and FastAPI");
});
