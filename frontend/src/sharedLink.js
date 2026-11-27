// Shareable links: ?q=<question> opens Chikki with that question, and
// ?company=<name> opens a tailored introduction for that company.

const MAX_QUESTION = 300;
const MAX_COMPANY = 60;

export function sanitizeCompany(value = "") {
  return value.replace(/[^\p{L}\p{N} &.'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, MAX_COMPANY);
}

export function companyQuestion(company) {
  return (
    `I'm a recruiter at ${company}. Briefly introduce Akash and what he could bring to a team like ours. ` +
    "Don't assume anything about our company beyond its name."
  );
}

/** Returns { question, label } from a URL search string, or null. */
export function readSharedLink(search = "") {
  const params = new URLSearchParams(search);
  const company = sanitizeCompany(params.get("company") || "");
  if (company) return { question: companyQuestion(company), label: `A tailored introduction for ${company}` };

  const question = (params.get("q") || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION);
  if (question) return { question, label: question };
  return null;
}

export function buildShareUrl(question, location = window.location) {
  const url = new URL(location.pathname, location.origin);
  const trimmed = (question || "").trim().slice(0, MAX_QUESTION);
  if (trimmed) url.searchParams.set("q", trimmed);
  return url.toString();
}
