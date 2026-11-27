// Mock-interview mode: a recruiter picks a role, Chikki answers five questions about Akash,
// then gives an honest fit verdict. Every answer goes through the normal chat, so it is
// grounded in the resume like any other.

export const INTERVIEW_ROLES = [
  {
    id: "ai",
    label: "AI Engineer",
    questions: [
      "Tell me about Akash's strongest AI project.",
      "How does he build and evaluate LLM agents?",
      "What was the hardest problem he solved with LangGraph?",
      "How does he keep AI answers reliable and grounded?",
      "How does he work with cloud and enterprise systems?",
    ],
  },
  {
    id: "backend",
    label: "Backend Engineer",
    questions: [
      "What backend systems has Akash built?",
      "How does he design real-time APIs with FastAPI and WebSockets?",
      "How does he handle security and reliability?",
      "What databases and data pipelines has he worked with?",
      "How does he test and monitor services?",
    ],
  },
  {
    id: "fullstack",
    label: "Full-stack Developer",
    questions: [
      "What full-stack projects has Akash built?",
      "How does he build React front ends?",
      "How does he connect a front end to an AI back end?",
      "Tell me about a project he shipped end to end.",
      "How does he approach performance and user experience?",
    ],
  },
  {
    id: "qa",
    label: "QA and Test Automation Engineer",
    questions: [
      "What is Akash's QA and test automation experience?",
      "How has he used Selenium and BDD?",
      "How did he validate ETL data pipelines?",
      "How does he use AI to speed up testing?",
      "What impact did his automation work have?",
    ],
  },
];

export function roleById(id) {
  return INTERVIEW_ROLES.find((role) => role.id === id) || null;
}

export function summaryQuestion(role) {
  return `Is Akash a good fit for a ${role.label} role? Give a short verdict, his strongest evidence from this interview, and any honest gaps.`;
}

// What the bar above the input should offer next. `asked` is how many questions were sent so far.
export function nextStep(role, asked) {
  if (asked < role.questions.length) {
    return { kind: "question", text: role.questions[asked], label: `Next question (${asked + 1} of ${role.questions.length})` };
  }
  if (asked === role.questions.length) {
    return { kind: "summary", text: summaryQuestion(role), label: "Get the fit verdict" };
  }
  return { kind: "done", text: "", label: "" };
}
