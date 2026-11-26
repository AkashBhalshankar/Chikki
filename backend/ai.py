import logging
import os
import re
import threading
import time
from difflib import SequenceMatcher
from typing import Iterator, Tuple

from dotenv import load_dotenv
from langfuse import get_client, propagate_attributes
from openai import OpenAI

from resume import build_system_prompt
from response_format import layout_hint

load_dotenv()

logger = logging.getLogger("chikki.ai")

# -------------------------------------------------------------------------
# Observability: Langfuse
# -------------------------------------------------------------------------
langfuse = None
if os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY"):
    try:
        langfuse = get_client()
    except Exception:
        logger.exception("Langfuse initialisation failed; continuing without tracing")

# -------------------------------------------------------------------------
# Multi-Provider Configuration (All Verified 2026 Endpoints)
# -------------------------------------------------------------------------
PROVIDERS = {
    "groq": {
        "api_key": os.environ.get("GROQ_API_KEY"),
        "base_url": "https://api.groq.com/openai/v1",
        "model": os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b"),
    },
    "gemini": {
        "api_key": os.environ.get("GEMINI_API_KEY"),
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest"),
    },
    "nvidia": {
        "api_key": os.environ.get("NVIDIA_API_KEY"),
        "base_url": "https://integrate.api.nvidia.com/v1",
        "model": os.environ.get("NVIDIA_MODEL", "poolside/laguna-xs-2.1"),
    },
    "openrouter": {
        "api_key": os.environ.get("OPENROUTER_API_KEY"),
        "base_url": "https://openrouter.ai/api/v1",
        "model": os.environ.get("OPENROUTER_MODEL", "nex-agi/nex-n2.5-pro:free"),
    },
}

PRIORITY_ORDER = ["groq", "gemini", "nvidia", "openrouter"]
_clients = {}


class ChikkiAIError(Exception):
    def __init__(self, message: str, kind: str = "unknown"):
        super().__init__(message)
        self.kind = kind


class CircuitBreaker:
    """Temporarily skips providers that recently failed.

    Auth and retired-model errors will not fix themselves, so those providers
    are skipped for longer than transient failures (timeouts, rate limits).
    If every provider is cooling down, they are still tried in priority order
    rather than failing without an attempt.
    """

    COOLDOWNS = {"auth": 600.0, "model_retired": 600.0}
    DEFAULT_COOLDOWN = 30.0

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._open_until: dict[str, float] = {}
        self._lock = threading.Lock()

    def record_failure(self, provider: str, kind: str) -> None:
        cooldown = self.COOLDOWNS.get(kind, self.DEFAULT_COOLDOWN)
        with self._lock:
            self._open_until[provider] = self._clock() + cooldown
        logger.warning("Provider %s failed (%s); skipping it for %.0fs", provider, kind, cooldown)

    def record_success(self, provider: str) -> None:
        with self._lock:
            self._open_until.pop(provider, None)

    def is_open(self, provider: str) -> bool:
        with self._lock:
            return self._clock() < self._open_until.get(provider, 0.0)

    def order(self, providers: list[str]) -> list[str]:
        healthy = [p for p in providers if not self.is_open(p)]
        cooling = [p for p in providers if self.is_open(p)]
        return healthy + cooling


circuit_breaker = CircuitBreaker()


def _get_client(provider_key: str) -> OpenAI:
    if provider_key not in _clients:
        cfg = PROVIDERS.get(provider_key)
        if not cfg or not cfg["api_key"]:
            raise RuntimeError(f"Missing API key for provider: {provider_key}")
        _clients[provider_key] = OpenAI(
            api_key=cfg["api_key"],
            base_url=cfg["base_url"],
            timeout=12.0,
        )
    return _clients[provider_key]


def _classify_error(e: Exception) -> str:
    text = str(e).lower()
    if any(k in text for k in ["401", "unauthorized", "api key"]):
        return "auth"
    if any(k in text for k in ["410", "end of life", "decommissioned"]):
        return "model_retired"
    if any(k in text for k in ["429", "413", "rate limit", "tpm"]):
        return "rate_limit"
    if "timeout" in text or "timed out" in text:
        return "timeout"
    if "connection" in text or "network" in text:
        return "network"
    return "unknown"


DETAIL_PATTERN = re.compile(
    r"\b(?:tell me more|more details?|in detail|in depth|elaborate|explain (?:more|further)|go deeper|"
    r"deep dive|dig deeper|expand on)\b|विस्तार से|विस्तार में|और बताओ|और बताइए|వివరంగా|ఇంకా చెప్పు|ఇంకా చెప్పండి",
    re.IGNORECASE,
)


def is_detail_request(message: str) -> bool:
    """True when the visitor asks for a deeper, longer answer than the default."""
    return bool(DETAIL_PATTERN.search(message))


def detail_max_tokens(language: str, voice_mode: bool) -> int:
    base = 340 if voice_mode else 650
    return base * 2 if language in {"te-IN", "hi-IN"} else base


# The script is spelled out because models otherwise answer Telugu or Hindi
# questions in English or in romanized letters, which the matching voice cannot read.
RESPONSE_LANGUAGES = {
    "en-IN": "English",
    "te-IN": "Telugu, written in Telugu script (తెలుగు లిపి) and never in English letters; your whole reply must be Telugu even though the profile is in English",
    "hi-IN": "Hindi, written in Devanagari script (देवनागरी) and never romanized or Hinglish; your whole reply must be Hindi even though the profile is in English",
}


def _prepare_message(message: str, language: str = "en-IN", detail: bool = False, voice_mode: bool = True) -> str:
    response_language = RESPONSE_LANGUAGES.get(language, "English")
    if detail and voice_mode:
        length_rule = (
            "The visitor asked for more depth, so ignore any earlier length limit and answer in 4 to 5 clear, "
            "specific sentences that sound natural aloud, using the retrieved knowledge when relevant."
        )
    elif detail:
        length_rule = (
            "The visitor asked for more depth, so ignore any earlier length limit. This reply is read on screen, "
            "so the no-markdown audio rules do not apply: give a clear answer of up to about 150 words as short "
            "paragraphs and up to 6 short bullet lines (each starting with \"- \"), with **bold** on key terms such "
            "as companies and technologies. No headings, tables, code blocks or emojis."
        )
    elif not voice_mode:
        length_rule = (
            "This reply is read on screen, so the no-markdown audio rules do not apply. Lead with the direct "
            "answer, no greeting and no restating the question. Be brief: never more than about 50 words in "
            "total, and stop as soon as the question is answered. Put **bold** on key terms such as companies "
            "and technologies. Never repeat yourself, never add a closing summary or offer. No headings, tables, "
            "code blocks or emojis. " + layout_hint(message)
        )
    else:
        length_rule = "Keep the spoken reply to at most 2 punchy sentences."
    follow_up = ""
    if not voice_mode:
        follow_up = (
            f" At the very end, after your answer, add one hidden tag holding 2 short follow-up questions the visitor "
            f"might ask next, written in {response_language}, only about things in the resume, like "
            f"[[next:First question?|Second question?]]. Never mention the tag."
        )
    return f"""{message}

INSTRUCTION: Reply in {response_language}. Preserve technical product and programming terms in English where that is natural. Speak about Akash in the 3rd person and keep answers grounded strictly in the verified profile. {length_rule} Output complete words and sentences; never stop midway through a word.{follow_up}"""


def _is_joke_request(message: str) -> bool:
    return bool(re.search(
        r"\b(joke|funny|make me laugh|crack me up)\b|జోక్|నవ్వు|चुटकुला|चुटकुले|जोक|हंसाओ|मज़ेदार",
        message,
        re.IGNORECASE,
    ))


def _normalize_joke(text: str) -> str:
    return " ".join(re.findall(r"[\w]+", text.lower()))


def _is_repeated_joke(candidate: str, previous_jokes: list[str]) -> bool:
    normalized_candidate = _normalize_joke(candidate)
    if not normalized_candidate:
        return False

    candidate_words = set(normalized_candidate.split())
    for previous in previous_jokes:
        normalized_previous = _normalize_joke(previous)
        if not normalized_previous:
            continue
        previous_words = set(normalized_previous.split())
        overlap = len(candidate_words & previous_words) / max(1, len(candidate_words | previous_words))
        if SequenceMatcher(None, normalized_candidate, normalized_previous).ratio() >= 0.72 or overlap >= 0.78:
            return True
    return False


def _stream_provider(
    provider_name: str,
    system_prompt: str,
    history: list[dict],
    message: str,
    language: str = "en-IN",
    request_timeout: float = 12.0,
    max_tokens_override: int | None = None,
) -> Iterator[Tuple[str, str]]:
    cfg = PROVIDERS.get(provider_name)
    if not cfg or not cfg["api_key"]:
        raise ValueError(f"Provider {provider_name} has no API key configured.")

    client = _get_client(provider_name)
    model = cfg["model"]

    # Keep enough recent context to avoid repeating jokes across several turns.
    clean_history = history[-12:] if len(history) > 12 else history
    is_joke = _is_joke_request(message)
    temperature = 0.85 if is_joke else 0.2
    max_tokens = 110 if is_joke else (360 if language in {"te-IN", "hi-IN"} else 180)
    if max_tokens_override and not is_joke:
        max_tokens = max_tokens_override

    messages = [{"role": "system", "content": system_prompt}]
    for turn in clean_history:
        role = "user" if turn.get("role") == "user" else "assistant"
        content = turn.get("content", "")
        if content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    if langfuse:
        yielded_any = False
        try:
            with langfuse.start_as_current_observation(
                as_type="span",
                name=f"chikki-{provider_name}-turn",
                input=message,
            ) as span:
                current_trace_id = langfuse.get_current_trace_id() or ""
                with propagate_attributes(trace_name="chikki-voice-turn"):
                    with langfuse.start_as_current_observation(
                        as_type="generation",
                        name=f"{provider_name}-generation",
                        model=model,
                        input=messages,
                    ) as gen:
                        stream = client.chat.completions.create(
                            model=model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            stream=True,
                            timeout=request_timeout,
                        )

                        collected = []
                        for chunk in stream:
                            if not chunk.choices:
                                continue
                            delta = chunk.choices[0].delta.content or ""
                            if delta:
                                collected.append(delta)
                                yielded_any = True
                                yield delta, current_trace_id

                        gen.update(output="".join(collected))
                span.update(output="".join(collected))
            langfuse.flush()
            return
        except GeneratorExit:
            return
        except Exception:
            # Once tokens have reached the user, retrying would duplicate them.
            if yielded_any:
                raise
            logger.warning("Traced call to %s failed; retrying without Langfuse", provider_name, exc_info=True)

    # Direct streaming fallback without Langfuse
    try:
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            timeout=request_timeout,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta, ""
    except GeneratorExit:
        return


def stream_chikki(
    message: str,
    history: list[dict],
    language: str = "en-IN",
    previous_jokes: list[str] | None = None,
    knowledge_context: str = "",
    meta: dict | None = None,
    detail: bool = False,
    voice_mode: bool = True,
) -> Iterator[Tuple[str, str]]:
    """Yields (token, trace_id) pairs with priority failover across all providers.

    knowledge_context is the formatted retrieval block appended to the system
    prompt for non-joke turns.
    """
    previous_jokes = previous_jokes or []
    is_joke = _is_joke_request(message)
    request_message = message.strip() if is_joke else _prepare_message(message, language, detail, voice_mode)
    max_tokens_override = detail_max_tokens(language, voice_mode) if detail and not is_joke else None
    if is_joke:
        response_language = RESPONSE_LANGUAGES.get(language, "English")
        system_prompt = (
            f"Tell one original, speakable software joke in {response_language}. "
            "Use at most two short sentences. Do not explain the joke, add an intro, "
            "or mention Akash. Never target the listener. Return only the joke."
        )
    else:
        system_prompt = build_system_prompt() + knowledge_context
        if not voice_mode:
            system_prompt += (
                "\n\nTEXT CHAT MODE: this reply is read on screen and not spoken, so the audio-formatting rules "
                "above do not apply here. Follow the formatting in the instruction after the visitor's message "
                "(short, **bold** key terms, optional '- ' bullets)."
            )
    if is_joke and previous_jokes:
        joke_memory = "\n".join(f"- {joke[:180]}" for joke in previous_jokes[-5:])
        system_prompt += (
            "\n\nJOKES ALREADY TOLD IN THIS CONVERSATION (never reuse their premise, setup, or punchline):\n"
            f"{joke_memory}\nCreate a genuinely different joke, preferably from another software topic."
        )
    last_error = None

    candidates = circuit_breaker.order(PRIORITY_ORDER)

    accepted_candidate_attempts = 0
    for provider in candidates:
        if not PROVIDERS.get(provider, {}).get("api_key"):
            continue

        try:
            if is_joke:
                rejected_jokes = list(previous_jokes)
                while accepted_candidate_attempts < 2:
                    attempt = accepted_candidate_attempts
                    attempt_prompt = system_prompt
                    if attempt > 0:
                        attempt_prompt += (
                            "\nYour previous candidate repeated a joke. Do not reuse this rejected candidate or its premise: "
                            f"{rejected_jokes[-1]}"
                        )
                    candidate_tokens = list(_stream_provider(
                        provider,
                        attempt_prompt,
                        history[-4:],
                        request_message,
                        language,
                        request_timeout=8.0,
                    ))
                    candidate = "".join(token for token, _ in candidate_tokens).strip()
                    if not candidate_tokens:
                        break
                    accepted_candidate_attempts += 1
                    circuit_breaker.record_success(provider)
                    if meta is not None:
                        meta["provider"] = provider
                    if not _is_repeated_joke(candidate, rejected_jokes):
                        yield from candidate_tokens
                        return
                    rejected_jokes.append(candidate)
                if accepted_candidate_attempts >= 2:
                    break
                continue

            iterator = _stream_provider(
                provider, system_prompt, history, request_message, language,
                max_tokens_override=max_tokens_override,
            )
            first_token_pair = next(iterator, ("", ""))

            if first_token_pair[0]:
                if meta is not None:
                    meta["provider"] = provider
                yield first_token_pair
                for token_pair in iterator:
                    yield token_pair
                circuit_breaker.record_success(provider)
                return

            logger.warning("Provider %s returned an empty stream", provider)
            circuit_breaker.record_failure(provider, "empty")

        except GeneratorExit:
            return
        except Exception as e:
            last_error = e
            circuit_breaker.record_failure(provider, _classify_error(e))
            continue

    kind = _classify_error(last_error) if last_error else "unknown"
    fallback_messages = {
        "auth": "Authentication failed on my inference providers. Akash will need to check the API keys.",
        "model_retired": "The configured model version has expired. Akash needs to update the model string.",
        "rate_limit": "High traffic hit the current LLM tier. Please ask me again in a moment.",
        "timeout": "The upstream provider took too long to answer. Could you repeat that?",
        "network": "I ran into a connection glitch. Please ask once more.",
        "empty": "I didn't receive a token stream back. Let's try that again.",
        "unknown": "I had trouble processing that question. Let's try again.",
    }
    raise ChikkiAIError(fallback_messages[kind], kind=kind)


def probe_providers(timeout: float = 20.0) -> dict[str, tuple[bool, str]]:
    """Sends a tiny request to every configured provider. Returns {provider: (ok, kind)}.

    kind is "ok", or one of auth, model_retired, rate_limit, timeout, network, unknown.
    Used by the daily health check so a retired model or exhausted quota is noticed.
    """
    results: dict[str, tuple[bool, str]] = {}
    for provider, cfg in PROVIDERS.items():
        if not cfg.get("api_key"):
            continue
        try:
            _get_client(provider).chat.completions.create(
                model=cfg["model"],
                messages=[{"role": "user", "content": "Reply with one word."}],
                max_tokens=5,
                timeout=timeout,
            )
            results[provider] = (True, "ok")
        except Exception as error:
            results[provider] = (False, _classify_error(error))
    return results


def complete_text(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 700,
    temperature: float = 0.2,
    timeout: float = 25.0,
) -> str:
    """Single non-streaming completion with the same provider failover as chat."""
    last_error = None
    for provider in circuit_breaker.order(PRIORITY_ORDER):
        cfg = PROVIDERS.get(provider, {})
        if not cfg.get("api_key"):
            continue
        try:
            response = _get_client(provider).chat.completions.create(
                model=cfg["model"],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
            )
            text = (response.choices[0].message.content or "").strip()
            if text:
                circuit_breaker.record_success(provider)
                return text
            circuit_breaker.record_failure(provider, "empty")
        except Exception as error:
            last_error = error
            circuit_breaker.record_failure(provider, _classify_error(error))
    kind = _classify_error(last_error) if last_error else "unknown"
    raise ChikkiAIError("I couldn't analyse that right now. Please try again in a moment.", kind=kind)


def ask_chikki(
    message: str,
    history: list[dict],
    language: str = "en-IN",
) -> Tuple[str, str]:
    chunks = []
    final_trace_id = ""
    for delta, tid in stream_chikki(message, history, language):
        chunks.append(delta)
        if tid:
            final_trace_id = tid

    reply = "".join(chunks).strip()
    if not reply:
        raise ChikkiAIError("Empty reply generated", kind="empty")
    return reply, final_trace_id