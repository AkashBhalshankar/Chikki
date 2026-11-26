import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ADMIN_TOKEN_KEY = "chikki_admin_token";

function readStoredToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function storeToken(token) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

export default function FeedbackDashboard({ isOpen, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [adminToken, setAdminToken] = useState(readStoredToken);
  const [tokenInput, setTokenInput] = useState("");
  const [view, setView] = useState("usage");
  const [contacts, setContacts] = useState([]);
  const [usage, setUsage] = useState(null);

  const fetchData = async (token = adminToken) => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const headers = { "X-Admin-Token": token };
      const [resAnalytics, resLogs, resContacts] = await Promise.all([
        fetch(`${BASE_URL}/feedback/analytics`, { cache: "no-store", headers }),
        fetch(`${BASE_URL}/feedback/recent?limit=50`, { cache: "no-store", headers }),
        fetch(`${BASE_URL}/contact/recent?limit=50`, { cache: "no-store", headers }).catch(() => null),
      ]);
      if (resAnalytics.status === 401 || resLogs.status === 401) {
        storeToken("");
        setAdminToken("");
        setLoadError("That admin token was rejected. Please enter it again.");
        return;
      }
      if (resAnalytics.status === 503) {
        setLoadError("Admin access is not configured on the backend (set ADMIN_TOKEN).");
        return;
      }
      if (!resAnalytics.ok || !resLogs.ok) {
        throw new Error(`Feedback service returned ${resAnalytics.status}/${resLogs.status}`);
      }
      const [analyticsData, logData] = await Promise.all([
        resAnalytics.json(),
        resLogs.json(),
      ]);
      setAnalytics(analyticsData);
      setRecentLogs(Array.isArray(logData) ? logData : logData.items || []);
      try {
        const resUsage = await fetch(`${BASE_URL}/analytics/summary?days=30`, { cache: "no-store", headers });
        if (resUsage.ok) setUsage(await resUsage.json());
      } catch {}
      if (resContacts?.ok) {
        const contactData = await resContacts.json();
        setContacts(Array.isArray(contactData) ? contactData : []);
      }
    } catch {
      setLoadError("Feedback could not be loaded. Check the backend connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTokenSubmit = (event) => {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;
    storeToken(token);
    setAdminToken(token);
    setTokenInput("");
    fetchData(token);
  };

  if (!adminToken) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono">
        <form
          onSubmit={handleTokenSubmit}
          className="max-w-sm w-full rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 space-y-4 shadow-2xl"
        >
          <div>
            <h2 className="text-sm font-bold text-chikki-purpleLight tracking-wide">ADMIN ACCESS</h2>
            <p className="mt-1 text-[11px] text-gray-400">Feedback analytics are private. Enter the admin token to continue.</p>
          </div>
          {loadError && (
            <div role="alert" className="border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              {loadError}
            </div>
          )}
          <label className="block">
            <span className="sr-only">Admin token</span>
            <input
              type="password"
              autoComplete="off"
              autoFocus
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="Admin token"
              className="w-full rounded-lg border border-gray-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-chikki-purple"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700 text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg bg-chikki-purple/30 border border-chikki-purple text-chikki-purpleLight hover:bg-chikki-purple/40"
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    );
  }

  const filteredLogs = recentLogs.filter((item) => {
    if (filter === "with-comments") return Boolean(item.user_comment && item.user_comment.trim());
    if (filter === "helpful") return item.value === "helpful";
    if (filter === "needs-improvement") return item.value === "needs-improvement";
    return true;
  });

  const commentsCount = recentLogs.filter((item) => Boolean(item.user_comment && item.user_comment.trim())).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono">
      <div className="max-w-4xl w-full max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-gray-700 bg-[#0d0d12]">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📊</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-chikki-purpleLight tracking-wide">
                CHIKKI FEEDBACK LOGS & ANALYTICS
              </h2>
              <p className="text-[10px] text-gray-400">Real-time user feedback, ratings, and written comments</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {[["usage", "📈 Usage"], ["feedback", "📊 Feedback"], ["messages", `✉️ Messages (${contacts.length})`]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  view === key
                    ? "bg-chikki-purple/30 text-chikki-purpleLight border-chikki-purple"
                    : "text-gray-400 border-gray-700 hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700 transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 chikki-scroll">
          {view === "usage" ? (
            <UsagePanel usage={usage} />
          ) : view === "messages" ? (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500">No messages yet.</div>
              ) : (
                contacts.map((contact) => (
                  <div key={contact.id} className="p-4 rounded-xl border border-gray-800 bg-zinc-900/30 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-gray-200 font-semibold">
                        {contact.name}
                        {contact.company && <span className="text-gray-400 font-normal"> · {contact.company}</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {contact.at ? new Date(contact.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <a href={`mailto:${contact.email}`} className="text-chikki-purpleLight underline underline-offset-2">
                      {contact.email}
                    </a>
                    <p className="text-gray-300 whitespace-pre-wrap break-words">{contact.message}</p>
                    {contact.topics && (
                      <p className="text-[10px] text-gray-500">Asked Chikki about: {contact.topics}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : loading && !analytics ? (
            <div className="text-center py-16 text-xs text-gray-400">Loading telemetry data...</div>
          ) : (
            <>
              {loadError && (
                <div role="alert" className="flex items-center justify-between gap-3 border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  <span>{loadError}</span>
                  <button type="button" onClick={() => fetchData()} className="shrink-0 underline underline-offset-2">
                    Retry
                  </button>
                </div>
              )}

              {/* Analytics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3.5 rounded-xl border border-gray-800 bg-zinc-900/40">
                  <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">Total Feedback</div>
                  <div className="text-xl font-bold text-white mt-1">{analytics?.total || recentLogs.length}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-800/40 bg-emerald-950/20">
                  <div className="text-[10px] uppercase text-emerald-400 font-semibold tracking-wider">Satisfaction</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{analytics?.satisfaction_rate || "0%"}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-gray-800 bg-zinc-900/40">
                  <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">👍 / 👎</div>
                  <div className="text-sm font-bold text-gray-200 mt-1.5">
                    <span className="text-emerald-400">{analytics?.helpful || 0}</span> / <span className="text-rose-400">{analytics?.needs_improvement || 0}</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-indigo-800/40 bg-indigo-950/20">
                  <div className="text-[10px] uppercase text-indigo-300 font-semibold tracking-wider">💬 Comments</div>
                  <div className="text-xl font-bold text-indigo-300 mt-1">{commentsCount}</div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setFilter("all")}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      filter === "all" ? "bg-chikki-purple/30 text-chikki-purpleLight border border-chikki-purple" : "text-gray-400 hover:bg-zinc-800"
                    }`}
                  >
                    All ({recentLogs.length})
                  </button>
                  <button
                    onClick={() => setFilter("with-comments")}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      filter === "with-comments" ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500 font-semibold" : "text-gray-400 hover:bg-zinc-800"
                    }`}
                  >
                    💬 With Comments ({commentsCount})
                  </button>
                  <button
                    onClick={() => setFilter("needs-improvement")}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      filter === "needs-improvement" ? "bg-rose-500/20 text-rose-300 border border-rose-500/50" : "text-gray-400 hover:bg-zinc-800"
                    }`}
                  >
                    👎 Dislikes
                  </button>
                  <button
                    onClick={() => setFilter("helpful")}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      filter === "helpful" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50" : "text-gray-400 hover:bg-zinc-800"
                    }`}
                  >
                    👍 Likes
                  </button>
                </div>

                <button
                  onClick={() => fetchData()}
                  className="text-[11px] text-gray-400 hover:text-white px-2.5 py-1 rounded bg-zinc-800/80 hover:bg-zinc-800 transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>

              {/* Feedback Records List */}
              <div className="space-y-3">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-500">
                    No feedback records match this filter.
                  </div>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <div
                      key={log.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        log.user_comment
                          ? "bg-[#141320] border-indigo-500/40 shadow-sm"
                          : "bg-zinc-900/30 border-gray-800"
                      } space-y-2.5 text-xs`}
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.value === "helpful"
                                ? "bg-emerald-950 border border-emerald-600 text-emerald-300"
                                : "bg-rose-950 border border-rose-600 text-rose-300"
                            }`}
                          >
                            {log.value === "helpful" ? "👍 Liked" : "👎 Disliked"}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase bg-zinc-800/80 px-2 py-0.5 rounded">
                            {log.mode || "voice"} mode
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {log.at ? new Date(log.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : ""}
                        </span>
                      </div>

                      {/* Prominent User Comment Box */}
                      {log.user_comment && (
                        <div className="p-3 rounded-lg bg-indigo-950/50 border border-indigo-500/60 text-indigo-100 flex flex-col gap-1 shadow-inner">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                            <span>💬</span>
                            <span>USER COMMENT / FEEDBACK:</span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-white pl-3 border-l-2 border-indigo-400 mt-0.5">
                            &ldquo;{log.user_comment}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Question */}
                      {log.question && (
                        <div className="text-gray-300">
                          <span className="text-gray-500 text-[10px] uppercase font-semibold block">User Asked:</span>
                          <p className="text-gray-300 italic mt-0.5 pl-1">&ldquo;{log.question}&rdquo;</p>
                        </div>
                      )}

                      {/* Reply */}
                      {log.reply && (
                        <div className="text-gray-400">
                          <span className="text-gray-500 text-[10px] uppercase font-semibold block">Chikki Replied:</span>
                          <p className="text-gray-400 mt-0.5 pl-1 line-clamp-2">&ldquo;{log.reply}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Bars({ items, labelKey, valueKey = "count", empty = "No data yet." }) {
  if (!items?.length) return <p className="text-xs text-gray-500">{empty}</p>;
  const max = Math.max(...items.map((item) => item[valueKey]), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item[labelKey]} className="text-[11px]">
          <div className="flex justify-between gap-2 text-gray-300">
            <span className="truncate">{item[labelKey]}</span>
            <span className="text-gray-400">{item[valueKey]}</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded bg-zinc-800">
            <div className="h-1.5 rounded bg-chikki-purple" style={{ width: `${(item[valueKey] / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function objectToItems(obj = {}) {
  return Object.entries(obj).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function UsagePanel({ usage }) {
  if (!usage) return <div className="text-center py-16 text-xs text-gray-400">No usage data yet.</div>;
  const { totals, latency_ms: latency, daily } = usage;
  const maxDay = Math.max(...daily.map((d) => d.turns), 1);
  const cards = [
    ["Questions (30d)", totals.turns],
    ["Resume downloads", totals.resume_downloads],
    ["Messages left", totals.contact_messages],
    ["Failed answers", totals.failed_turns],
    ["Median reply", latency.p50 != null ? `${(latency.p50 / 1000).toFixed(1)}s` : "–"],
    ["Slow (p95)", latency.p95 != null ? `${(latency.p95 / 1000).toFixed(1)}s` : "–"],
  ];
  const card = "p-3.5 rounded-xl border border-gray-800 bg-zinc-900/40";
  const heading = "text-[10px] uppercase text-gray-400 font-semibold tracking-wider mb-2";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {cards.map(([label, value]) => (
          <div key={label} className={card}>
            <div className={heading}>{label}</div>
            <div className="text-xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className={card}>
        <div className={heading}>Questions per day</div>
        <div className="flex h-20 items-end gap-0.5">
          {daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.turns}`}
              className="flex-1 rounded-t bg-chikki-purple/70"
              style={{ height: `${Math.max((d.turns / maxDay) * 100, d.turns ? 6 : 2)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={card}><div className={heading}>Top questions</div><Bars items={usage.top_questions} labelKey="question" /></div>
        <div className={card}><div className={heading}>Top topics</div><Bars items={usage.top_topics} labelKey="topic" /></div>
        <div className={card}>
          <div className={heading}>Knowledge gaps (asked, nothing retrieved)</div>
          <Bars items={usage.knowledge_gaps} labelKey="question" empty="No gaps found." />
        </div>
        <div className={card}><div className={heading}>Languages</div><Bars items={objectToItems(usage.languages)} labelKey="name" /></div>
        <div className={card}><div className={heading}>Voice vs text</div><Bars items={objectToItems(usage.modes)} labelKey="name" /></div>
        <div className={card}><div className={heading}>Model providers used</div><Bars items={objectToItems(usage.providers)} labelKey="name" /></div>
        <div className={card}><div className={heading}>Failures by cause</div><Bars items={objectToItems(usage.failures)} labelKey="name" empty="No failures." /></div>
      </div>
    </div>
  );
}
