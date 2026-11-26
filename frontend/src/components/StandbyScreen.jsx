import ChikkiBot from "./ChikkiBot.jsx";
import AppFooter from "./AppFooter.jsx";
import { ProfileCard } from "./ProfileBadge.jsx";

export default function StandbyScreen({
  state,
  onEnableMic,
  onTypeInstead,
  sharedLabel,
  serverState = "ready",
  theme = "dark",
  onToggleTheme,
}) {
  return (
    <div className="min-h-screen dot-grid px-5 py-6 sm:px-8">
      <div className="app-shell flex min-h-[calc(100vh-3rem)] flex-col">
        <header className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-lg tracking-[0.18em] text-chikki-purpleLight">CHIKKI</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-600">AI career assistant</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-gray-600 sm:inline">Voice-first portfolio</span>
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                title={theme === "light" ? "Dark theme" : "Light theme"}
                className="action-button !min-h-0 px-2.5 py-1 text-sm"
              >
                {theme === "light" ? "🌙" : "☀️"}
              </button>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 px-2">
            <ProfileCard />
          </div>
          <ChikkiBot state={state} size={160} />

          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-gray-600">
            {serverState === "waking" ? (
              <span role="status"><span className="text-amber-400">●</span> Waking up Chikki…</span>
            ) : (
              <span><span className="text-chikki-green">●</span> Online</span>
            )}
            <span className="text-gray-800">/</span>
            <span>Standby</span>
          </div>

          {sharedLabel && typeof onTypeInstead === "function" && (
            <div className="mt-8 max-w-md rounded-xl border border-chikki-purple/50 bg-chikki-purple/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Someone shared this with you</p>
              <p className="mt-1 text-sm text-gray-200">{sharedLabel}</p>
              <button type="button" onClick={onTypeInstead} className="action-button primary-action mt-3 px-5">
                See Chikki&apos;s answer
              </button>
            </div>
          )}

          {serverState === "waking" && (
            <p className="mt-3 max-w-sm text-xs text-amber-300/90">
              Chikki was asleep and is starting up. The first answer can take up to a minute; after that it is quick.
            </p>
          )}

          <p className="mt-8 text-sm text-gray-400">Say <span className="text-chikki-purpleLight">“Hey Chikki”</span> to begin.</p>

          <button type="button" onClick={onEnableMic} className="action-button primary-action mt-5 px-5">
            Click to start
          </button>

          {typeof onTypeInstead === "function" && (
            <button type="button" onClick={onTypeInstead} className="mt-4 text-xs text-gray-600 underline underline-offset-4 hover:text-chikki-purpleLight">
              Use text chat instead
            </button>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}