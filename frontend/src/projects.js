// Projects shown as cards. Every line comes from Akash's resume; nothing here is invented.
// `match` lists the names Chikki's answers use for each project (used to show a card under an answer).

export const PROJECTS = [
  {
    id: "chikki",
    name: "Chikki",
    kind: "Voice-first AI career assistant",
    summary: "The assistant you are talking to: voice and text chat that answers from Akash's verified resume.",
    stack: ["React", "FastAPI", "WebSockets", "Edge-TTS", "Langfuse"],
    highlights: ["Multi-provider LLM routing with automatic failover", "Answers checked against the resume"],
    match: ["chikki"],
  },
  {
    id: "request-management",
    name: "Request Management Service",
    kind: "Enterprise multi-agent platform at UBS",
    summary: "A LangGraph-based multi-agent platform with self-validating reflection agents.",
    stack: ["LangGraph", "FastAPI", "Microsoft Entra ID", "Teams"],
    highlights: ["Supports 5-7 enterprise applications", "Teams approval workflows and Entra ID authentication"],
    match: ["request management service", "request management"],
  },
  {
    id: "navlearn",
    name: "NavLearn (Vibe Testing)",
    kind: "AI-assisted test automation",
    summary: "Turns BDD specifications into runnable test scripts using GitHub Copilot and a skill-file agent.",
    stack: ["GitHub Copilot", "BDD", "Agents"],
    highlights: ["Cut manual test-authoring effort by 30-40%"],
    match: ["navlearn", "vibe testing"],
  },
  {
    id: "shareinsync",
    name: "ShareInSync",
    kind: "Peer-to-peer file sharing PWA",
    summary: "Files go straight between devices, so nothing is stored on a server.",
    stack: ["React", "WebRTC", "Cloudflare Workers"],
    highlights: ["Zero server storage", "SHA-256 verification of transfers"],
    match: ["shareinsync"],
  },
  {
    id: "agrimentor",
    name: "AgriMentor",
    kind: "Agricultural AI assistant",
    summary: "Reads soil-test reports and gives personalised crop and soil recommendations.",
    stack: ["FastAPI", "Multimodal input (PDF, image, text)"],
    highlights: ["Handles PDF, image and text soil-test inputs"],
    match: ["agrimentor"],
  },
];

// The projects an answer talks about, in the order they appear (at most 3).
export function projectsMentioned(text = "") {
  const lower = text.toLowerCase();
  return PROJECTS
    .map((project) => ({ project, at: Math.min(...project.match.map((name) => (lower.includes(name) ? lower.indexOf(name) : Infinity))) }))
    .filter((entry) => Number.isFinite(entry.at))
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
    .map((entry) => entry.project);
}
