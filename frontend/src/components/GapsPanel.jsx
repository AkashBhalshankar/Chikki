import { useCallback, useEffect, useState } from "react";

// The owner's inbox: questions visitors asked that Chikki could not answer. Answering one adds it
// to what Chikki knows, so it can answer next time.
export default function GapsPanel({ baseUrl, token, onCount }) {
  const [data, setData] = useState({ gaps: [], notes: [] });
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const headers = { "X-Admin-Token": token, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/gaps`, { cache: "no-store", headers: { "X-Admin-Token": token } });
      if (!res.ok) throw new Error("Could not load the inbox.");
      const json = await res.json();
      setData(json);
      onCount?.(json.gaps.length);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [baseUrl, token, onCount]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (gap) => {
    const answer = (drafts[gap.key] || "").trim();
    if (answer.length < 3) return;
    setBusy(gap.key);
    try {
      const res = await fetch(`${baseUrl}/gaps/answer`, { method: "POST", headers, body: JSON.stringify({ question: gap.question, answer }) });
      if (!res.ok) throw new Error("Could not save that answer.");
      setDrafts((d) => ({ ...d, [gap.key]: "" }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const remove = async (id) => {
    setBusy(id);
    try {
      await fetch(`${baseUrl}/gaps/notes/${id}`, { method: "DELETE", headers });
      await load();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {error && <div role="alert" className="border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-rose-200">{error}</div>}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Unanswered questions</div>
        {data.gaps.length === 0 ? (
          <div className="py-6 text-center text-gray-500">Nothing waiting. Chikki answered everything it was asked.</div>
        ) : (
          <div className="space-y-3">
            {data.gaps.map((gap) => (
              <div key={gap.key} className="rounded-xl border border-gray-800 bg-zinc-900/30 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-gray-100">{gap.question}</div>
                  <span className="shrink-0 text-[10px] text-gray-400">asked {gap.count}×</span>
                </div>
                <textarea
                  rows={2}
                  value={drafts[gap.key] || ""}
                  onChange={(event) => setDrafts((d) => ({ ...d, [gap.key]: event.target.value }))}
                  placeholder="Type the true answer. Chikki will use it from now on."
                  className="w-full rounded border border-gray-700 bg-zinc-950 p-2 text-gray-200 outline-none focus:border-chikki-purple resize-none"
                />
                <div className="flex justify-end">
                  <button type="button" onClick={() => save(gap)} disabled={busy === gap.key || (drafts[gap.key] || "").trim().length < 3} className="action-button primary-action text-xs disabled:opacity-50">
                    {busy === gap.key ? "Saving..." : "Save answer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {data.notes.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Answers you added</div>
          <div className="space-y-2">
            {data.notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 p-3">
                <div>
                  <div className="font-semibold text-gray-200">{note.question}</div>
                  <div className="mt-0.5 text-gray-400">{note.answer}</div>
                </div>
                <button type="button" onClick={() => remove(note.id)} disabled={busy === note.id} className="text-[11px] text-rose-300 hover:text-rose-200">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
