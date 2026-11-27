"""Instant, polite replies to greetings, thanks and goodbyes.

These need no resume facts and no model, so they are answered at once (and the audio for each is cached after
the first time). Only a message that is nothing but the greeting counts: "thanks, now tell me about his
projects" goes to the model as usual.
"""

import random
import re

_FILLER = r"(?:\s+(?:so much|a lot|very much|chikki|again|buddy|bro|friend|there|everyone|all|to you|too))*"


def _pattern(words: str) -> re.Pattern:
    return re.compile(rf"^\s*(?:(?:ok|okay|hey|hi|so|well|great|cool|nice|alright)[\s,]+)?(?:{words}){_FILLER}[\s.!?,।]*$", re.IGNORECASE)


KINDS = {
    "thanks": (
        _pattern(r"thanks|thank you|thank u|thx|ty|many thanks|much appreciated|i appreciate it|ధన్యవాదాలు|థాంక్స్|థ్యాంక్స్|ధన్యవాదములు|धन्यवाद|शुक्रिया|थैंक्स|थैंक यू|थैंक"),
        "grateful",
        {
            "en-IN": [
                "You're very welcome! It was a pleasure. Is there anything else you'd like to know about Akash?",
                "Happy to help! If you'd like, I can tell you more about his projects or skills.",
            ],
            "te-IN": ["చాలా సంతోషం! ఆకాశ్ గురించి ఇంకేమైనా తెలుసుకోవాలనుకుంటే అడగండి."],
            "hi-IN": ["आपका बहुत स्वागत है! आकाश के बारे में कुछ और जानना हो तो ज़रूर पूछिए।"],
        },
    ),
    "bye": (
        _pattern(r"bye|goodbye|good bye|bye bye|see you|see ya|see you later|take care|good night|talk to you later|ttyl|that's all|that is all|that'?s it|i'?m done|శెలవు|బై|గుడ్ నైట్|अलविदा|बाय|गुड नाइट"),
        "happy",
        {
            "en-IN": [
                "Thank you for stopping by! If you'd like to reach Akash, the Contact button is right here. Take care!",
                "It was lovely talking with you. Have a wonderful day, and feel free to come back anytime!",
            ],
            "te-IN": ["వచ్చినందుకు ధన్యవాదాలు! ఆకాశ్‌ను సంప్రదించాలంటే Contact బటన్ ఇక్కడే ఉంది. జాగ్రత్త!"],
            "hi-IN": ["आने के लिए धन्यवाद! आकाश से संपर्क करना हो तो Contact बटन यहीं है। अपना ख्याल रखिए!"],
        },
    ),
    "hello": (
        _pattern(r"hi|hello|hey|hii+|heya|hey chikki|hello chikki|hi chikki|good morning|good afternoon|good evening|namaste|namaskar|నమస్తే|నమస్కారం|హలో|హాయ్|नमस्ते|नमस्कार|हेलो|हैलो|हाय"),
        "happy",
        {
            "en-IN": [
                "Hello, and welcome! I'm Chikki, Akash's assistant. What would you like to know about him?",
                "Hi there! Lovely to meet you. Ask me anything about Akash's work, projects or skills.",
            ],
            "te-IN": ["నమస్తే! నేను చిక్కీని, ఆకాశ్ అసిస్టెంట్‌ని. ఆయన గురించి ఏమి తెలుసుకోవాలనుకుంటున్నారు?"],
            "hi-IN": ["नमस्ते! मैं चिक्की हूँ, आकाश की असिस्टेंट। आप उनके बारे में क्या जानना चाहेंगे?"],
        },
    ),
}


def quick_reply(message: str, language: str = "en-IN", rng=random) -> str | None:
    """The full reply (with its hidden mood tag) for a plain greeting, thanks or goodbye, or None."""
    text = message.strip()
    if not text or len(text.split()) > 6:
        return None
    for pattern, mood, replies in KINDS.values():
        if pattern.match(text):
            options = replies.get(language) or replies["en-IN"]
            return f"[[mood:{mood}]] {rng.choice(options)}"
    return None
