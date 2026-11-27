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

test("a markdown table becomes a table block with header and rows", () => {
  const [intro, table] = parseBlocks("Compare them.\n\n| Aspect | **UBS** |\n|---|---|\n| Role | AI Engineer |\n| Tool | LangGraph |\n");
  assert.equal(intro.type, "p");
  assert.equal(table.type, "table");
  assert.deepEqual(table.header, ["Aspect", "**UBS**"]);
  assert.deepEqual(table.rows, [["Role", "AI Engineer"], ["Tool", "LangGraph"]]);
});

test("copying a table drops the separator row", () => {
  assert.equal(plainText("| A | B |\n|---|---|\n| 1 | 2 |").includes("---"), false);
});

test("links become safe link parts, with trailing punctuation left out", () => {
  assert.deepEqual(parseInline("See [the site](https://akashbhalshankar.com) now."), [
    { type: "text", value: "See " },
    { type: "link", value: "the site", href: "https://akashbhalshankar.com" },
    { type: "text", value: " now." },
  ]);
  assert.deepEqual(parseInline("Visit https://example.com/app."), [
    { type: "text", value: "Visit " },
    { type: "link", value: "https://example.com/app", href: "https://example.com/app" },
    { type: "text", value: "." },
  ]);
  // only http(s) links are ever made clickable
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ type: "text", value: "[x](javascript:alert(1))" }]);
  assert.equal(plainText("[the site](https://a.com)"), "the site (https://a.com)");
});
