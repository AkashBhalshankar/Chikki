const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

const WS_URL = BASE_URL.replace(/^http/, "ws");

/**
 * Fetches spoken audio for a short fixed line (e.g. the wake greeting)
 * via the existing /tts REST endpoint.
 */
export async function fetchGreetingAudio(text, language = "en-IN") {
  const res = await fetch(`${BASE_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) throw new Error("TTS request failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadResumePdf(url, focus = "", profileLinks = {}) {
  const requestUrl = new URL(url, window.location.origin);
  const res = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      focus: focus.trim(),
      linkedin_url: profileLinks.linkedin || "",
      github_url: profileLinks.github || "",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Resume download failed: ${res.status}`);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/pdf")) {
    throw new Error("Resume endpoint did not return a PDF");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "akash-bhalshankar-resume.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function sendFeedback({
  value,
  question,
  reply,
  mode,
  user_comment,
  trace_id,
  session_id,
}) {
  try {
    await fetch(`${BASE_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value,
        question,
        reply,
        mode,
        user_comment,
        trace_id,
        session_id,
      }),
    });
  } catch {}
}

export function connectVoiceSocket({
  onOpen,
  onDelta,
  onText,
  onAudio,
  onAudioChunk,
  onError,
  onClose,
}) {
  let socket = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let manuallyClosed = false;
  const outgoingQueue = [];

  const flushQueue = () => {
    while (outgoingQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
      const payload = outgoingQueue.shift();
      socket.send(JSON.stringify(payload));
    }
  };

  const openSocket = () => {
    if (manuallyClosed) return;
    const connection = new WebSocket(`${WS_URL}/ws/voice`);
    socket = connection;

    connection.onopen = () => {
      if (socket !== connection) return;
      reconnectAttempt = 0;
      onOpen?.();
      flushQueue();
    };

    connection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 1. Support both "token" and "delta"
        if (data.type === "token" || data.type === "delta") {
          const textToken = data.token ?? data.text ?? "";
          onDelta?.(textToken, data.trace_id, data.turn_id);
          return;
        }

        // 2. Audio chunk with audio data + text for subtitle sync
        if (data.type === "audio_chunk") {
          onAudioChunk?.(
            {
              data: data.data,
              mime: data.mime || "audio/mpeg",
              text: data.text || "",
              turn_id: data.turn_id,
            },
            data.mime || "audio/mpeg",
            data.tone || null,
            data.trace_id
          );
          return;
        }

        // 3. Sentence chunk fallback (if raw text without audio arrives)
        if (data.type === "sentence_chunk" && !data.data) {
          fetch(`${WS_URL.replace("ws://", "http://").replace("wss://", "https://")}/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.text }),
          })
            .then((res) => res.blob())
            .then(async (blob) => {
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = () => {
                const base64data = reader.result.split(",")[1];
                onAudioChunk?.(
                  { data: base64data, mime: "audio/mpeg", text: data.text, turn_id: data.turn_id },
                  "audio/mpeg",
                  null,
                  data.trace_id
                );
              };
            })
            .catch(() => {});
          return;
        }

        // 4. Final text or error completion
        if (data.type === "text" || data.type === "error" || data.type === "done") {
          onText?.(data.reply || data.full_text || "", {
            isError: data.type === "error",
            kind: data.kind ?? data.meta?.kind ?? null,
            trace_id: data.trace_id ?? (data.meta ? data.meta.trace_id : null),
            turn_id: data.turn_id ?? (data.meta ? data.meta.turn_id : null),
          });
          return;
        }

        if (data.type === "audio") {
          onAudio?.(data.data, data.mime, data.trace_id);
        }
      } catch (error) {
        onError?.(error);
      }
    };

    connection.onerror = (error) => {
      onError?.(error);
    };

    connection.onclose = (event) => {
      if (socket !== connection) return;
      socket = null;
      onClose?.(event);
      if (manuallyClosed) return;
      const delay = Math.min(250 * (2 ** reconnectAttempt), 5000);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(openSocket, delay);
    };
  };

  openSocket();

  const client = {
    sync: (history, joke_history = []) => {
      const payload = { type: "sync", history, joke_history };
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        return true;
      }
      outgoingQueue.push(payload);
      return true;
    },

    send: (message, { voice = true, session_id = null, language = "en-IN", turn_id = null } = {}) => {
      const payload = { message, voice, session_id, language, turn_id };
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        return true;
      }

      if (socket?.readyState === WebSocket.CONNECTING || !socket) {
        outgoingQueue.push(payload);
        return true;
      }

      return false;
    },

    interrupt: () => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "interrupt" }));
      }
    },

    close: () => {
      manuallyClosed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    },

    get raw() {
      return socket;
    },
  };

  return client;
}