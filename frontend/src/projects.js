// Projects shown as cards. Every line comes from Akash's resume or his own listings; nothing here is invented.
// Projects with a public live link come first because a visitor can try them; his work projects at UBS
// follow. `match` lists the names Chikki's answers use for each project (used to show a card under an answer).

export const PROJECTS = [
  {
    id: "chikki",
    name: "Chikki",
    kind: "Voice-first AI career assistant",
    summary: "The assistant you are talking to: voice and text chat that answers from Akash's verified resume.",
    stack: ["React", "FastAPI", "WebSockets", "Edge-TTS", "Langfuse"],
    highlights: ["Multi-provider LLM routing with automatic failover", "Answers checked against the resume"],
    url: "https://akashbhalshankar.com",
    image: "/projects/chikki.jpg",
    urlLabel: "Open the live site",
    match: ["chikki"],
  },
  {
    id: "shareinsync",
    name: "ShareInSync",
    kind: "Peer-to-peer file sharing PWA",
    summary: "Files go straight between devices, so nothing is stored on a server.",
    stack: ["React", "WebRTC", "Cloudflare Workers"],
    highlights: ["Zero server storage", "SHA-256 verification of transfers"],
    url: "https://shareinsync.akashbhalshankar.com",
    image: "/projects/shareinsync.jpg",
    peek: true,
    urlLabel: "Open the live app",
    match: ["shareinsync"],
  },
  {
    id: "nachitram",
    name: "NaChitram",
    kind: "Chrome extension: screen, webcam and whiteboard recorder",
    summary: "A free recorder for teachers and creators with a live whiteboard, camera bubble and a private teleprompter. Everything stays in the browser.",
    stack: ["Chrome Manifest V3", "MediaRecorder", "Web Audio", "Local browser storage"],
    highlights: ["No account, servers or cloud upload", "Long recordings are written to local storage in chunks, so a crash loses nothing"],
    url: "https://chromewebstore.google.com/detail/scioflow-screen-webcam-wh/nklfcnddfghefifdpgmlkccbanmmoido",
    urlLabel: "Open in the Chrome Web Store",
    match: ["nachitram"],
  },
  {
    id: "request-management",
    name: "Request Management Service",
    kind: "Work project at UBS: enterprise multi-agent platform",
    summary: "A LangGraph-based multi-agent platform with self-validating reflection agents.",
    stack: ["LangGraph", "FastAPI", "Microsoft Entra ID", "Teams"],
    highlights: ["Supports 5-7 enterprise applications", "Teams approval workflows and Entra ID authentication"],
    match: ["request management service", "request management"],
  },
  {
    id: "navlearn",
    name: "NavLearn (Vibe Testing)",
    kind: "Work project at UBS: AI-assisted test automation",
    summary: "Turns BDD specifications into runnable test scripts using GitHub Copilot and a skill-file agent.",
    stack: ["GitHub Copilot", "BDD", "Agents"],
    highlights: ["Cut manual test-authoring effort by 30-40%"],
    match: ["navlearn", "vibe testing"],
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

// The projects an answer talks about (at most 3): ones with a live link first, then in the order they appear.
export function projectsMentioned(text = "") {
  const lower = text.toLowerCase();
  return PROJECTS
    .map((project) => ({ project, at: Math.min(...project.match.map((name) => (lower.includes(name) ? lower.indexOf(name) : Infinity))) }))
    .filter((entry) => Number.isFinite(entry.at))
    .sort((a, b) => Number(Boolean(b.project.url)) - Number(Boolean(a.project.url)) || a.at - b.at)
    .slice(0, 3)
    .map((entry) => entry.project);
}
