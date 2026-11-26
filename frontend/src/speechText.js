// Helpers that make speech recognition and the browser voice fallback more accurate.

// The Web Speech API has no custom vocabulary, so names and tech terms are often
// misheard. These corrections fix the common mistakes in recognised text.
const CORRECTIONS = [
  [/\b(?:akaash|aakash|akas|ackash|a\s+kash|aa\s+kash)\b/gi, "Akash"],
  [/\b(?:chik+[iy]e?|chickie|chicky|chikky|chiki|shikki|chickey)\b/gi, "Chikki"],
  [/\bfast\s*(?:a\.?\s?p\.?\s?i\.?|epi|api)\b/gi, "FastAPI"],
  [/\blang\s*graph\b/gi, "LangGraph"],
  [/\blang\s*chain\b/gi, "LangChain"],
  [/\blang\s*(?:fuse|few|views?)\b/gi, "Langfuse"],
  [/\bweb\s+sockets?\b/gi, "WebSockets"],
  [/\bnav\s*learn\b/gi, "NavLearn"],
  [/\bgit\s+hub\b/gi, "GitHub"],
  [/\bopen\s*a\.?\s?i\.?\b/gi, "OpenAI"],
  [/\bl\.?\s?l\.?\s?m\.?s?\b/gi, "LLM"],
  [/\b(?:rag|rags|r\.?\s?a\.?\s?g\.?)\b/gi, "RAG"],
  [/\bpie\s*test\b/gi, "pytest"],
  [/\bedge\s*t\.?\s?t\.?\s?s\.?\b/gi, "Edge-TTS"],
];

export function correctTranscript(text = "") {
  let result = text.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// Mirrors the backend clean_for_speech so the browser voice fallback reads the
// same words as the captions instead of markdown symbols, links or emoji.
export function cleanForBrowserSpeech(text = "") {
  return text
    .replace(/\[\[action:\w*\]?\]?/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[@#$%^&*_~|<>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Final results below this confidence are treated as "didn't catch that".
// Chrome reports 0 when it has no score, which is not treated as low.
export const LOW_CONFIDENCE = 0.4;

export function isLowConfidence(confidence) {
  return typeof confidence === "number" && confidence > 0 && confidence < LOW_CONFIDENCE;
}
