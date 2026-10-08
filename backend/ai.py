import os
import re
from difflib import SequenceMatcher
from typing import Iterator, Tuple

from dotenv import load_dotenv
from langfuse import get_client, propagate_attributes
from openai import OpenAI

from resume import build_system_prompt

load_dotenv()

# -------------------------------------------------------------------------
# Observability: Langfuse
# -------------------------------------------------------------------------
langfuse = None
if os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY"):
    try:
        langfuse = get_client()
    except Exception:
        pass

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
        "model": os.environ.get("NVIDIA_MODEL", "meta/llama-3.2-11b-vision-instruct"),
    },
    "openrouter": {
        "api_key": os.environ.get("OPENROUTER_API_KEY"),
        "base_url": "https://openrouter.ai/api/v1",
        "model": os.environ.get("OPENROUTER_MODEL", "nex-agi/nex-n2.5-pro:free"),
    },
}

ACTIVE_PROVIDER = "groq"
_clients = {}


class ChikkiAIError(Exception):
    def __init__(self, message: str, kind: str = "unknown"):
        super().__init__(message)
        self.kind = kind


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


def _prepare_message(message: str, language: str = "en-IN") -> str:
    response_language = {
        "en-IN": "English",
        "te-IN": "Telugu",
        "hi-IN": "Hindi",
    }.get(language, "English")
    return f"""{message}

INSTRUCTION: Reply in {response_language}. Preserve technical product and programming terms in English where that is natural. Speak about Akash in the 3rd person and keep answers grounded strictly in the verified profile. Keep the spoken reply to at most 2 punchy sentences. Output complete words and sentences; never stop midway through a word."""


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

    messages = [{"role": "system", "content": system_prompt}]
    for turn in clean_history:
        role = "user" if turn.get("role") == "user" else "assistant"
        content = turn.get("content", "")
        if content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    if langfuse:
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
                                yield delta, current_trace_id

                        gen.update(output="".join(collected))
                span.update(output="".join(collected))
            langfuse.flush()
            return
        except GeneratorExit:
            return
        except Exception:
            pass

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
) -> Iterator[Tuple[str, str]]:
    """Yields (token, trace_id) pairs with priority failover across all providers."""
    global ACTIVE_PROVIDER

    previous_jokes = previous_jokes or []
    is_joke = _is_joke_request(message)
    request_message = message.strip() if is_joke else _prepare_message(message, language)
    if is_joke:
        response_language = {
            "en-IN": "English",
            "te-IN": "Telugu",
            "hi-IN": "Hindi",
        }.get(language, "English")
        system_prompt = (
            f"Tell one original, speakable software joke in {response_language}. "
            "Use at most two short sentences. Do not explain the joke, add an intro, "
            "or mention Akash. Never target the listener. Return only the joke."
        )
    else:
        system_prompt = build_system_prompt()
    if is_joke and previous_jokes:
        joke_memory = "\n".join(f"- {joke[:180]}" for joke in previous_jokes[-5:])
        system_prompt += (
            "\n\nJOKES ALREADY TOLD IN THIS CONVERSATION (never reuse their premise, setup, or punchline):\n"
            f"{joke_memory}\nCreate a genuinely different joke, preferably from another software topic."
        )
    last_error = None

    priority_order = ["groq", "gemini", "nvidia", "openrouter"]

    if ACTIVE_PROVIDER in priority_order:
        candidates = [ACTIVE_PROVIDER] + [p for p in priority_order if p != ACTIVE_PROVIDER]
    else:
        candidates = priority_order

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
                    if not _is_repeated_joke(candidate, rejected_jokes):
                        yield from candidate_tokens
                        if ACTIVE_PROVIDER != provider:
                            ACTIVE_PROVIDER = provider
                        return
                    rejected_jokes.append(candidate)
                if accepted_candidate_attempts >= 2:
                    break
                continue

            iterator = _stream_provider(provider, system_prompt, history, request_message, language)
            first_token_pair = next(iterator, ("", ""))

            if first_token_pair[0]:
                yield first_token_pair
                for token_pair in iterator:
                    yield token_pair

                if ACTIVE_PROVIDER != provider:
                    ACTIVE_PROVIDER = provider
                return

        except GeneratorExit:
            return
        except Exception as e:
            last_error = e
            kind = _classify_error(e)
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