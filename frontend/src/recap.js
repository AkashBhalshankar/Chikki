// A short, plain summary of the conversation, built from the messages themselves (no AI call).

import { plainText } from "./markdown.js";

const MAX_TURNS = 8;

function firstSentence(text, limit = 170) {
  const clean = plainText(text).replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?।])\s/)[0] || clean;
  return sentence.length > limit ? `${sentence.slice(0, limit - 1).trim()}…` : sentence;
}

export function buildRecap(messages) {
  const turns = [];
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.role !== "user" || !message.content?.trim()) continue;
    const reply = messages.slice(i + 1).find((m) => m.role === "assistant" && m.final && !m.isError && m.content?.trim());
    const next = messages.slice(i + 1).findIndex((m) => m.role === "user");
    const answered = reply && (next === -1 || messages.indexOf(reply) < i + 1 + next) ? reply : null;
    turns.push({ question: message.content.trim(), answer: answered ? firstSentence(answered.history_content || answered.content) : "" });
  }
  const kept = turns.slice(-MAX_TURNS);
  const lines = kept.map((turn, index) => `${index + 1}. ${turn.question}${turn.answer ? `\n   ${turn.answer}` : ""}`);
  const text = kept.length
    ? `My chat with Chikki about Akash Bhalshankar\n\n${lines.join("\n\n")}\n\nAsk Chikki: https://akashbhalshankar.com`
    : "";
  return { turns: kept, text };
}

export function recapMailto(text) {
  const body = encodeURIComponent(text.slice(0, 1800));
  return `mailto:?subject=${encodeURIComponent("My chat with Chikki about Akash Bhalshankar")}&body=${body}`;
}
