// The small interactive pieces: the secret code, the skill map and the work journey. Everything shown here comes
// from the projects and skills already listed in Akash's verified material; nothing is invented.

import { PROJECTS } from "./projects.js";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

// Feeds one key at a time; returns the new progress and whether the whole code was just completed.
export function konamiStep(progress, key) {
  const wanted = KONAMI[progress];
  const pressed = key.length === 1 ? key.toLowerCase() : key;
  if (pressed === wanted) {
    const next = progress + 1;
    return next === KONAMI.length ? { progress: 0, done: true } : { progress: next, done: false };
  }
  return { progress: pressed === KONAMI[0] ? 1 : 0, done: false };
}

export const SKILL_GROUPS = [
  { title: "AI and agents", skills: ["LangGraph", "LLM agents", "Langfuse"] },
  { title: "Backend", skills: ["FastAPI", "WebSockets", "ETL pipelines"] },
  { title: "Frontend", skills: ["React", "WebRTC"] },
  { title: "Testing and QA", skills: ["Selenium", "BDD", "Test automation"] },
];

// The skill map appears under an answer to a question about skills, tools or the tech stack.
export function wantsSkillMap(question = "") {
  return /\b(skills?|tech(?:nical|nology)?\s*stack|tech|tools?|stack|technologies|expertise|proficien\w*)\b/i.test(question);
}

export function skillQuestion(skill) {
  return `Where did Akash use ${skill}?`;
}

// Projects grouped for the journey view; entries without a public link are marked as work projects.
export function journey() {
  const groups = [
    { title: "Live products you can try", items: PROJECTS.filter((p) => p.url) },
    { title: "Work at UBS", items: PROJECTS.filter((p) => !p.url && /ubs/i.test(p.kind)) },
    { title: "Other projects", items: PROJECTS.filter((p) => !p.url && !/ubs/i.test(p.kind)) },
  ];
  return groups.filter((group) => group.items.length);
}

export const EGG_JOKES = [
  "Why do developers love dark mode? Because light attracts bugs.",
  "A QA engineer walks into a bar and orders 1 beer, 0 beers, 99999 beers, and a lizard.",
  "There are 10 kinds of people: those who understand binary and those who don't.",
];

// Tapping Chikki: which part was touched decides the reaction; a flurry of pokes makes him dizzy.
export function pokeReaction(part, recentPokes) {
  if (recentPokes >= 5) return { name: "confused", ms: 2400 };
  if (part === "head") return { name: "joyful", ms: 1500 };
  if (part === "belly") return { name: "laughing", ms: 1700 };
  return { name: "greet", ms: 1700 };
}

// A short, friendly line for the start screen: the time of day, or the festival if it is one.
const FESTIVE_LINES = { santa: "Merry Christmas", party: "Happy New Year", tricolor: "Jai Hind", diya: "Happy Diwali" };

export function timeGreeting(date = new Date(), festive = null) {
  if (festive && FESTIVE_LINES[festive]) return FESTIVE_LINES[festive];
  const hour = date.getHours();
  if (hour < 5) return "Hello, night owl";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Hello, night owl";
}
