// Chooses Chikki's face. The model names the mood of each reply (a hidden tag); the keyword
// rules below are the fallback when it does not, and also drive the face while the visitor's
// own question is being read.

export const MOODS = [
  "neutral", "happy", "joyful", "excited", "proud", "confident", "focused", "curious", "playful",
  "laughing", "shy", "grateful", "love", "surprised", "skeptical", "determined", "relieved",
  "apologetic", "concerned", "sad", "wink", "encouraging",
];

export function expressionForMood(mood) {
  return MOODS.includes(mood) ? mood : null;
}

export function expressionForReply(reply = "") {
  const text = reply.toLowerCase();
  if (/\b(don't have that detail|not in (akash's|the) resume|i'm sorry|apolog|unfortunately|can't help)\b|क्षमा|మన్నించండి/.test(text)) return "apologetic";
  if (/\b(hmm|let me think|well\.\.\.|ఆలోచిస్తున్నాను|सोच रही)\b/.test(text)) return "focused";
  if (/\b(laugh|funny|joke|hilarious|haha|hehe|lol|chuckle|నవ్వు|హాహా|हंस|जोक)\b/.test(text)) return "laughing";
  if (/\b(shy|blush|sweet|aww|compliment|kind of you|సిగ్గు|शर्म)\b/.test(text)) return "shy";
  if (/\b(thank you|thanks|appreciate|ధన్యవాదాలు|शुक्रिया|धन्यवाद)\b/.test(text)) return "grateful";
  if (/\b(excited|amazing|incredible|fantastic|brilliant|thrilled|super cool|బాగుంది|बढ़िया)\b/.test(text)) return "excited";
  if (/\b(love|lovely|heartfelt|adorable)\b/.test(text)) return "love";
  if (/\b(surpris(e|d|ing)|wow|unexpected)\b/.test(text)) return "surprised";
  if (/\b(built|projects?|achieved|awards?|shipped|delivered|launched)\b/.test(text)) return "proud";
  if (/\b(why should|strengths|expert|hire|confident|impact|fastapi|langgraph|ఎందుకు|क्यों)\b/.test(text)) return "confident";
  return "confident";
}

export function expressionForUserInput(input = "") {
  const text = input.toLowerCase().trim();
  if (/^(hi|hello|hey|good morning|namaskaram|namaste|నమస్కారం|नमस्ते)\b/.test(text)) return "greet";
  if (/\b(congrat\w*|celebrat\w*|well done|great job)\b/.test(text)) return "celebrate";
  if (/\b(joke|funny|play|game|haha|lol|జోక్|जोक)\b/.test(text)) return "playful";
  if (/\b(laugh|hilarious)\b/.test(text)) return "laughing";
  if (/\b(are you sure|prove|is that true|really\?|doubt|made up|hallucinat\w*|\blie\b)/.test(text)) return "skeptical";
  if (/\b(that helps|makes sense|got it|understood|clear now)\b/.test(text)) return "relieved";
  if (/\b(thank|thanks|appreciate|ధన్యవాదాలు|शुक्रिया)\b/.test(text)) return "grateful";
  if (/\b(cute|pretty|sweet|love|lovely)\b/.test(text)) return "shy";
  if (/\b(honestly|secret|off the record|between us)\b/.test(text)) return "wink";
  if (/\b(sorry|unfortunately|rejected|failed|lost my|laid off)\b/.test(text)) return "sad";
  if (/\b(confus\w*|don't understand|what do you mean|huh)\b/.test(text)) return "confused";
  if (/\b(why should|weakness|hardest|difficult|challenge|toughest|hire)\b/.test(text)) return "determined";
  if (/\b(projects?|built|achievements?|awards?|certif\w*|accomplish\w*|ship(ped)?)\b/.test(text)) return "proud";
  if (/\b(help|stuck|problem|issue|error|bug|cannot|can't|సహాయం|मदद)\b/.test(text)) return "concerned";
  if (/\b(great|awesome|nice|cool|wonderful|perfect|excellent)\b/.test(text)) return "happy";
  if (/^(yes|yeah|yep|okay|ok|sure|continue|go on|next|సరే|हाँ|ठीक)\b/.test(text)) return "nod";
  if (/^(let's|lets|you can|try)\b/.test(text)) return "encouraging";
  if (/\?$|\b(why|how|what|when|where|who|which|can you explain|ఎలా|ఏమిటి|कैसे|क्या)\b/.test(text)) return "curious";
  return "curious";
}

// The mood the model chose wins; otherwise guess from the reply's words.
export function expressionForTurn(mood, reply = "") {
  return expressionForMood(mood) || expressionForReply(reply);
}

// ---- live reactions and backdrop glow ----------------------------------------------------------

const SURPRISE_WORDS = /^(?:wow|whoa|really|seriously|no way|oh my|oh wow)\b/i;

// While the visitor is still talking: a nod as they speak, a surprised look at "wow" and the like.
export function reactionForTranscript(text = "") {
  const heard = String(text).trim();
  if (!heard) return null;
  const words = heard.split(/\s+/).length;
  if (words <= 6 && SURPRISE_WORDS.test(heard)) return "surprised";
  return words >= 3 ? "nod" : null;
}

const GLOWS = { warm: "255,150,70", green: "110,200,90", pink: "240,120,160", cool: "90,140,230", teal: "74,163,162" };
const GLOW_OF = {
  excited: "warm", joyful: "warm", laughing: "warm", playful: "warm", determined: "warm", celebrate: "warm", surprised: "warm",
  happy: "green", proud: "green", encouraging: "green", relieved: "green", nod: "green", wake: "green", ready: "green",
  love: "pink", grateful: "pink", shy: "pink",
  thinking: "cool", sad: "cool", focused: "cool", concerned: "cool", apologetic: "cool", sleepy: "cool", confused: "cool", skeptical: "cool",
  curious: "teal",
};

// The "r,g,b" of the soft glow for a face, or null to keep the accent colour.
export function glowFor(state) {
  const key = GLOW_OF[state];
  return key ? GLOWS[key] : null;
}
