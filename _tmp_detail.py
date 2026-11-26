def edit(p, a, b):
    s = open(p, encoding="utf-8").read()
    assert a in s, (p, a[:60])
    open(p, "w", encoding="utf-8").write(s.replace(a, b, 1))

A = "backend/ai.py"
edit(A, 'def _prepare_message(message: str, language: str = "en-IN") -> str:',
'''DETAIL_PATTERN = re.compile(
    r"\b(tell me more|more details?|in detail|in depth|elaborate|explain (?:more|further)|go deeper|"
    r"deep dive|dig deeper|expand on)\b|विस्तार से|विस्तार में|और बताओ|और बताइए|वివరంగా|ఇంకా చెప్పు|ఇంకా చెప్పండి",
    re.IGNORECASE,
)


def is_detail_request(message: str) -> bool:
    """True when the visitor asks for a deeper, longer answer than the default."""
    return bool(DETAIL_PATTERN.search(message))


def detail_max_tokens(language: str, voice_mode: bool) -> int:
    base = 340 if voice_mode else 650
    return base * 2 if language in {"te-IN", "hi-IN"} else base


def _prepare_message(message: str, language: str = "en-IN", detail: bool = False, voice_mode: bool = True) -> str:''')
edit(A, 'Keep the spoken reply to at most 2 punchy sentences. Output complete words and sentences; never stop midway through a word."""',
'''{length_rule} Output complete words and sentences; never stop midway through a word."""''')
edit(A, '''    return f"""{message}

INSTRUCTION:''', '''    if detail and voice_mode:
        length_rule = (
            "The visitor asked for more depth, so ignore any earlier length limit and answer in 4 to 5 clear, "
            "specific sentences that sound natural aloud, using the retrieved knowledge when relevant."
        )
    elif detail:
        length_rule = (
            "The visitor asked for more depth, so ignore any earlier length limit and give a thorough answer of up "
            "to 8 sentences in short plain-text paragraphs (no markdown, bullets or emojis), using the retrieved "
            "knowledge for specifics."
        )
    else:
        length_rule = "Keep the spoken reply to at most 2 punchy sentences."
    return f"""{message}

INSTRUCTION:''')
edit(A, "    request_timeout: float = 12.0,\n) -> Iterator[Tuple[str, str]]:", "    request_timeout: float = 12.0,\n    max_tokens_override: int | None = None,\n) -> Iterator[Tuple[str, str]]:")
edit(A, "    max_tokens = 110 if is_joke else (360 if language in {\"te-IN\", \"hi-IN\"} else 180)\n",
"    max_tokens = 110 if is_joke else (360 if language in {\"te-IN\", \"hi-IN\"} else 180)\n    if max_tokens_override and not is_joke:\n        max_tokens = max_tokens_override\n")
edit(A, "    meta: dict | None = None,\n) -> Iterator", "    meta: dict | None = None,\n    detail: bool = False,\n    voice_mode: bool = True,\n) -> Iterator")
edit(A, "request_message = message.strip() if is_joke else _prepare_message(message, language)",
"request_message = message.strip() if is_joke else _prepare_message(message, language, detail, voice_mode)\n    max_tokens_override = detail_max_tokens(language, voice_mode) if detail and not is_joke else None")
edit(A, "iterator = _stream_provider(provider, system_prompt, history, request_message, language)",
"iterator = _stream_provider(\n                provider, system_prompt, history, request_message, language,\n                max_tokens_override=max_tokens_override,\n            )")

M = "backend/main.py"
edit(M, "from ai import ChikkiAIError, _is_joke_request, stream_chikki", "from ai import ChikkiAIError, _is_joke_request, is_detail_request, stream_chikki")
edit(M, "    conversation_jokes: list[str],\n):\n    full_reply = []", "    conversation_jokes: list[str],\n    detail: bool = False,\n):\n    full_reply = []")
edit(M, "knowledge_base.retrieve, f\"{user_msg}\n{previous_question[:300]}\"\n            )", "knowledge_base.retrieve,\n                f\"{user_msg}\n{previous_question[:300]}\",\n                5 if detail else TOP_K,\n            )")
edit(M, "                meta=turn_meta,\n", "                meta=turn_meta,\n                detail=detail,\n                voice_mode=voice_mode,\n")
edit(M, "from knowledge import format_context, knowledge_base, sources_for", "from knowledge import TOP_K, format_context, knowledge_base, sources_for")
edit(M, "                conversation_history,\n                conversation_jokes,\n            ))", "                conversation_history,\n                conversation_jokes,\n                bool(data.get(\"detail\")) or is_detail_request(user_msg),\n            ))")

F = "frontend/src/App.jsx"
edit(F, "  const suggestionsForReply = (reply) => {", "  const baseSuggestionsForReply = (reply) => {")
edit(F, "  const unlockAudioContext = () => {", '''  const suggestionsForReply = (reply) => {
    const base = baseSuggestionsForReply(reply);
    if (/joke|funny|laugh/i.test(reply)) return base;
    const more = {
      "te-IN": "దీని గురించి వివరంగా చెప్పు.",
      "hi-IN": "इसके बारे में विस्तार से बताओ।",
    }[currentLang] || "Tell me more about that.";
    return [more, base[0]];
  };

  const unlockAudioContext = () => {''')
print("ok")
