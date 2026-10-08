import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function FeedbackDashboard({ isOpen, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [resAnalytics, resLogs] = await Promise.all([
        fetch(`${BASE_URL}/feedback/analytics`, { cache: "no-store" }),
        fetch(`${BASE_URL}/feedback/recent?limit=50`, { cache: "no-store" }),
      ]);
      if (!resAnalytics.ok || !resLogs.ok) {
        throw new Error(`Feedback service returned ${resAnalytics.status}/${resLogs.status}`);
      }
      const [analyticsData, logData] = await Promise.all([
        resAnalytics.json(),
        resLogs.json(),
      ]);
      setAnalytics(analyticsData);
      setRecentLogs(Array.isArray(logData) ? logData : logData.items || []);
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📊</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-chikki-purpleLight tracking-wide">
                CHIKKI FEEDBACK LOGS & ANALYTICS
              </h2>
              <p className="text-[10px] text-gray-400">Real-time user feedback, ratings, and written comments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 chikki-scroll">
          {loading && !analytics ? (
            <div className="text-center py-16 text-xs text-gray-400">Loading telemetry data...</div>
          ) : (
            <>
              {loadError && (
                <div role="alert" className="flex items-center justify-between gap-3 border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  <span>{loadError}</span>
                  <button type="button" onClick={fetchData} className="shrink-0 underline underline-offset-2">
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
                  onClick={fetchData}
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