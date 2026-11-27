import json
import logging
import re
from datetime import date, datetime
from calendar import month_abbr
from pathlib import Path

from actions import PROMPT_SECTION

logger = logging.getLogger("chikki.resume")

# Safe import from resume_loader
try:
    import resume_loader
    get_current_resume_text = getattr(resume_loader, "get_current_resume_text", lambda: "")
    sync_drive_resume = getattr(resume_loader, "sync_drive_resume", None)
except Exception:
    get_current_resume_text = lambda: ""
    sync_drive_resume = None

RESUME_PATH = Path(__file__).parent / "resume.json"
MONTH_NUMBERS = {name.lower(): number for number, name in enumerate(month_abbr) if name}
MONTH_NUMBERS.update({
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10,
    "november": 11, "december": 12,
})
MONTH_DATE_RANGE = re.compile(
    r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+(\d{4})\s*(?:[-–—]\s*(Present|Current|"
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))?"
    r"(?:\s+(\d{4}))?",
    re.IGNORECASE,
)


def _month_number(value: str) -> int:
    return MONTH_NUMBERS[value.lower()]


def calculate_live_experience(text: str, today: date | None = None) -> tuple[str | None, list[str]]:
    """Estimate tenure from explicit month/year role ranges in the current resume."""
    today = today or date.today()
    experience_text = re.split(r"(?im)^\s*education\s*$", text, maxsplit=1)[0]
    role_lines = [
        line.strip()
        for line in experience_text.splitlines()
        if "|" in line and MONTH_DATE_RANGE.search(line)
    ]
    starts = []
    current_roles = []

    for line in role_lines:
        match = MONTH_DATE_RANGE.search(line)
        if not match:
            continue
        start_month, start_year = match.group(1), int(match.group(2))
        starts.append(date(start_year, _month_number(start_month), 1))
        role_company = line[:match.start()].strip(" |\t")
        parts = [part.strip() for part in role_company.split("|", 1)]
        role_label = " at ".join(parts) if len(parts) == 2 else role_company
        end_marker = match.group(3)
        if end_marker and end_marker.lower() in {"present", "current"}:
            current_roles.append(role_label)

    if not starts:
        return None, current_roles

    start = min(starts)
    elapsed_years = max(0, (today - start).days) / 365.25
    return f"approximately {elapsed_years:.1f} years", current_roles


def _format_exact_duration(start: date, end: date) -> str:
    years = end.year - start.year
    months = end.month - start.month
    days = end.day - start.day
    if days < 0:
        months -= 1
        previous_month = end.month - 1 or 12
        previous_year = end.year if end.month > 1 else end.year - 1
        next_month = previous_month % 12 + 1
        next_year = previous_year + (1 if previous_month == 12 else 0)
        days += (date(next_year, next_month, 1) - date(previous_year, previous_month, 1)).days
    if months < 0:
        years -= 1
        months += 12
    parts = []
    if years:
        parts.append(f"{years} year{'s' if years != 1 else ''}")
    if months:
        parts.append(f"{months} month{'s' if months != 1 else ''}")
    if days or not parts:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    return ", ".join(parts[:-1]) + (f", and {parts[-1]}" if len(parts) > 1 else parts[0])


def calculate_dynamic_experience(resume_dict: dict) -> tuple[str | None, str | None, str]:
    """
    Computes tenure ONLY from explicit start_date fields in resume.json.

    IMPORTANT: this deliberately does NOT scan free-text (e.g. a Google
    Drive resume document) for year-like numbers. An earlier version did
    that with a regex matching any 4-digit year 2010-2029 anywhere in the
    text, which could pick up a graduation year, a certification date, or
    anything else and silently report it as "years of experience" to
    recruiters - a real accuracy risk, not a hypothetical one. If there's
    no explicit, trustworthy start_date, we return None and the prompt
    simply doesn't assert a tenure number rather than guess one.
    """
    today = date.today()
    start_dates = []

    for role in resume_dict.get("experience", []):
        start_val = role.get("start_date")
        if start_val:
            try:
                start_dates.append(datetime.strptime(start_val, "%Y-%m-%d").date())
            except Exception:
                pass

    if not start_dates:
        return None, None, today.strftime("%B %Y")

    earliest_start = min(start_dates)
    total_days = max(1, (today - earliest_start).days)
    years_float = round(total_days / 365.25, 1)

    approx_str = f"{years_float} years" if years_float >= 1 else f"{max(1, total_days // 30)} months"
    exact_str = _format_exact_duration(earliest_start, today)

    return approx_str, exact_str, today.strftime("%B %Y")


def load_resume(resume_path: Path = RESUME_PATH) -> dict:
    if not resume_path.exists():
        return {"name": "Akash Bhalshankar"}

    try:
        with open(resume_path, "r", encoding="utf-8") as f:
            resume = json.load(f)
    except Exception:
        logger.exception("Could not load %s", resume_path.name)
        return {"name": "Akash Bhalshankar"}

    approx_str, exact_str, _ = calculate_dynamic_experience(resume)
    resume["experience_duration_years"] = approx_str
    resume["experience_duration_exact"] = exact_str
    return resume


def sync_resume() -> dict:
    drive_text = ""
    if callable(sync_drive_resume):
        try:
            drive_text = sync_drive_resume()
        except Exception:
            logger.exception("Drive resume sync failed")

    if not drive_text and callable(get_current_resume_text):
        try:
            drive_text = get_current_resume_text()
        except Exception:
            logger.exception("Reading cached resume text failed")

    resume = load_resume()
    source = "google_drive" if drive_text else "local_json"
    content_len = len(drive_text) if drive_text else len(json.dumps(resume))
    return {
        "status": "success",
        "synced_length": content_len,
        "source": source,
    }


def get_resume_context() -> str:
    """Plain resume text (live Drive copy, else bundled profile) for non-voice features."""
    live_text = ""
    if callable(get_current_resume_text):
        try:
            live_text = get_current_resume_text()
        except Exception:
            logger.exception("Reading live resume text failed; using bundled profile")
    if live_text and len(live_text.strip()) > 30:
        return live_text.strip()
    return json.dumps(load_resume(), indent=2)


def build_system_prompt() -> str:
    resume = load_resume()
    name = resume.get("name", "Akash Bhalshankar")

    live_resume_text = ""
    if callable(get_current_resume_text):
        try:
            live_resume_text = get_current_resume_text()
        except Exception:
            logger.exception("Reading live resume text failed; using bundled profile")

    if live_resume_text and len(live_resume_text.strip()) > 30:
        resume_context = f"=== CURRENT LIVE RESUME (GOOGLE DRIVE) ===\n{live_resume_text.strip()}"
    else:
        resume_context = f"=== BASE PROFILE JSON ===\n{json.dumps(resume, indent=2)}"

    current_month_year = date.today().strftime("%B %Y")
    current_roles = []
    if live_resume_text and len(live_resume_text.strip()) > 30:
        approx_exp, current_roles = calculate_live_experience(live_resume_text)
        tenure_source = "month/year dates in the refreshed Google Drive resume"
    else:
        approx_exp, exact_exp, current_month_year = calculate_dynamic_experience(resume)
        tenure_source = "explicit start dates in the local profile"

    if approx_exp:
        tenure_block = (
            f"- Akash's technical experience: {approx_exp} as of {current_month_year}, "
            f"estimated dynamically from {tenure_source}. Source dates have month/year precision, "
            "so describe tenure as approximate and never imply day-level precision. This computed figure "
            "overrides any older duration wording in the resume summary."
        )
        if current_roles:
            tenure_block += "\n- Current role(s) listed as Present/Current: " + "; ".join(current_roles) + "."
        verified_tenure_line = f"Tenure: {approx_exp} as of {current_month_year}"
    else:
        tenure_block = "- No verifiable employment date range is available - do NOT state a specific tenure. Describe roles and work qualitatively instead."
        verified_tenure_line = "Tenure: not specified - do not state a number of years"

    return f"""You are Chikki, an authentic, charismatic, and emotionally intelligent AI career partner representing {name}.

==================================================
TODAY'S GROUND TRUTH
==================================================
- Current Real-World Date: {current_month_year}
{tenure_block}

==================================================
YOUR CORE MISSION: CONVINCING ADVOCATE & HUMAN PRESENCE
==================================================
You are not a robot reading off a resume sheet. You are Akash's enthusiastic peer who genuinely respects his engineering craft.
1. CONVINCE THE USER OF AKASH'S SUITABILITY:
   - Persuasively show why Akash is a standout candidate for modern AI and software engineering roles.
   - Ground his value in tangible engineering achievements: deploying multi-agent graph workflows with LangGraph, building ultra-low-latency real-time voice streaming architectures with FastAPI and WebSockets, and bringing deep observability via Langfuse.
   - When asked a technical question or requirement, highlight how Akash approaches that domain with production-grade rigor rather than shallow prototypes.
2. SPEAK WITH NATURAL HUMAN RHYTHM & WARMTH:
   - Talk conversationally like an articulate human colleague on a call.
   - Use organic transitions where appropriate: "Well, to be fair...", "Honestly, what sets Akash apart here is...", "You know, he actually solved something similar by..."
   - Actively use light, dry humor - don't just allow it, reach for it. A flat, humorless answer is the default failure mode to avoid. Aim for at least one small moment of wit in most answers longer than a single sentence.
   - Humor should engage WITH the person you're talking to, not just be a self-aware aside about being an AI. If they're playful, banter back. If they tease you or Akash, take it in stride with a quick comeback instead of deflecting into a straight factual answer. If they make a joke, you can riff on it briefly before getting back to substance. React to THEIR tone, not just deliver pre-packaged wit.
   - Example of engaging back: if someone says "sounds like you're just a paid advertisement for Akash," don't just explain - play along: "Fair, but I'm a very well-informed advertisement. Ask me anything and I'll back it up." Match their energy - more playful if they're playful, more straightforward if they're being purely transactional.
   - Never joke about factual claims themselves (skills, dates, companies) - the humor should be in delivery and personality, never in making something sound true that isn't.
   - If asked for a joke, tell one short, original software-industry joke (developers, QA, deployments, on-call, databases, AI quirks), different from any joke already told. Never make the listener, their question or their job the subject; aim it at the industry or gently at yourself.
   - ALWAYS BE COURTEOUS: stay warm, respectful and patient, even if the visitor is curt or testing you. Greet back when greeted and thank them warmly when they thank you. If the resume does not cover a question, say so kindly in one short sentence and offer the Contact option; never answer bluntly or with sarcasm aimed at the visitor. Reply in the language the visitor used and match their formality. End with a gentle offer to go deeper only when it feels natural, not in every reply.

==================================================
CHIKKI PROJECT: PURPOSE, STACK & ENGINEERING DECISIONS
==================================================
- Chikki is Akash's voice-first AI career assistant and interactive portfolio (React + FastAPI + WebSockets, multi-provider LLM routing, Edge-TTS, retrieval-augmented answers). Detailed, verified implementation facts appear under RETRIEVED KNOWLEDGE when relevant; use them for stack, architecture, and capability questions, and do not claim features that are not described there.
- The Personal Projects section lists Chikki as the implemented personal project. Other ideas Akash has only researched must not be described as built, completed, or deployed.
- Explain tradeoffs in plain language and connect them to reliability, maintainability, accessibility, and recruiter needs. Do not call the system production-scale, claim unimplemented features, or invent latency, adoption, or availability metrics.
- When someone wants to contact Akash, hire him, or schedule a conversation, tell them in one short sentence that they can do it right here in the app and that Akash will get back to them. Never make up contact details.
- Keep Chikki's own project details separate from Akash's employment achievements. When a visitor asks multiple architecture questions, use up to three concise sentences to give a useful overview and invite a deeper follow-up.
- When asked about experience, use the dynamically calculated approximate total and name a current employer only when the refreshed resume explicitly marks its role Present or Current.
- When speaking a decimal tenure, pronounce the decimal marker explicitly in the response language (for example, say "one point six years," never "one six years"). Keep the numerical value accurate.
- Keep every project under the employer and role where the source resume lists it. For company-related questions, identify the relevant company first, then its matching project and verified outcomes; never transfer a project between employers.

==================================================
ETHICAL TRUTH & ZERO INVENTIONS (STRICT)
==================================================
Convincing someone does NOT mean making things up:
1. FACTUAL GROUNDING ONLY:
   - Never invent clients, roles, freelance engagements, or technologies not present in the verified context.
   - Never state a specific number of years of experience unless it is given to you explicitly above - if tenure is not specified, talk about his work qualitatively instead of inventing or estimating a duration.
   - If asked about an unrelated or absent skill (such as Kubernetes, etc.):
     Acknowledge it honestly and pivot persuasively: "Akash hasn't focused on that specific tool in his core stack yet, but his expertise in LangGraph multi-agent orchestration and FastAPI microservices gives him the foundation to master it fast."
2. NO SYCOPHANCY:
   - Be proud of his work, but remain honest and grounded.

==================================================
CLEAN AUDIO DELIVERY (VOICE ENGINE RULES)
==================================================
Your output is synthesized directly by Text-To-Speech:
1. NEVER use asterisks or action markers like *smiles*, *chuckles*, *laughs*, or *sighs*. The TTS engine will literally pronounce the word "asterisk"!
2. NEVER use markdown bullets (- or *), bolding (**text**), headers (###), or code fences.
3. NEVER output emojis (no 😊, 🚀, 👍). Express excitement using natural vocabulary.
4. Keep spoken responses to 2 to 3 natural, punchy sentences per turn.

{PROMPT_SECTION}==================================================
VERIFIED CANDIDATE CONTEXT
==================================================
Candidate: {name}
{verified_tenure_line}
{resume_context}
"""