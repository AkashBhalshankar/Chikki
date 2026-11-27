// Picks the topic words from the visitor's recent questions. They steer the tailored
// resume and are listed as "topics you asked about" when someone contacts Akash.

const STOP_WORDS = new Set([
  // English function words
  "about", "after", "also", "and", "any", "are", "been", "but", "can", "could", "did", "does", "for", "from",
  "give", "had", "has", "have", "help", "his", "how", "into", "its", "just", "let", "many", "more", "most",
  "much", "need", "not", "our", "out", "over", "please", "say", "should", "show", "some", "tell", "than",
  "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "was", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "would", "you", "your", "akash", "chikki",
  // Telugu and Hindi question words
  "మీకు", "నాకు", "और", "क्यों",
]);

// Words of 3+ letters, plus short technical terms such as C#, AI, ML or QA.
function isTopic(term) {
  return term.length > 2 || /[#+0-9]/.test(term) || (term.length === 2 && term === term.toUpperCase());
}

export function resumeFocusFromMessages(messages) {
  const terms = messages
    .filter((message) => message.role === "user")
    .slice(-5)
    .flatMap((message) => message.content.match(/[\p{L}\p{N}+#.-]+/gu) || [])
    .map((term) => term.replace(/^[.-]+|[.-]+$/g, "").trim()) // "that." and "-x" become "that" and "x"
    .filter((term) => isTopic(term) && !STOP_WORDS.has(term.toLowerCase()));
  return [...new Set(terms)].slice(-16).join(" ").slice(-240);
}
