import ChikkiBot from "./ChikkiBot.jsx";
import AppFooter from "./AppFooter.jsx";
import { ProfileCard } from "./ProfileBadge.jsx";
import GithubStrip from "./GithubStrip.jsx";
import { PROJECTS } from "../projects.js";

export default function StandbyScreen({
  state,
  onEnableMic,
  onTypeInstead,
  onDownloadResume,
  onOpenContact,
  sharedLabel,
  serverState = "ready",
  theme = "dark",
  onToggleTheme,
}) {
  return (
    <div className="view-fade fit-viewport dot-grid px-5 py-4 sm:px-8">
      <div className="app-shell flex h-full flex-col">
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

        <main className="fit-main flex-1 py-3 text-center">
          <div className="fit-inner">
          <div className="fit-hide-short mb-3 px-2">
            <ProfileCard />
          </div>
          <ChikkiBot state={state} className="fit-bot" />

          <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-gray-600">
            {serverState === "waking" ? (
              <span role="status"><span className="text-amber-400">●</span> Waking up Chikki…</span>
            ) : (
              <span><span className="text-chikki-green">●</span> Online</span>
            )}
            <span className="text-gray-800">/</span>
            <span>Standby</span>
          </div>

          {sharedLabel && typeof onTypeInstead === "function" && (
            <div className="mt-4 max-w-md rounded-xl border border-chikki-purple/50 bg-chikki-purple/10 p-4">
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

          <p className="fit-hide-short mt-3 max-w-md px-2 text-sm leading-relaxed text-gray-300">
            Ask about Akash&apos;s skills, projects or fit for your role. Every answer is checked against his verified resume.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {onDownloadResume && (
              <button type="button" onClick={onDownloadResume} className="action-button primary-action text-xs">📄 Resume PDF</button>
            )}
            {onOpenContact && (
              <button type="button" onClick={onOpenContact} className="action-button primary-action text-xs">✉️ Contact Akash</button>
            )}
          </div>

          <div className="mt-3 flex max-w-xl flex-wrap items-center justify-center gap-2" aria-label="Live projects">
            {PROJECTS.filter((project) => project.url).map((project) => (
              <a
                key={project.id}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-1.5 rounded-lg border border-gray-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-chikki-purple hover:text-white"
              >
                <span className="font-medium">{project.name}</span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-[9px] text-emerald-300">Live</span>
              </a>
            ))}
          </div>

          <div className="fit-hide-short"><GithubStrip /></div>

          <p className="mt-4 text-sm text-gray-400">Say <span className="text-chikki-purpleLight">“Hey Chikki”</span> to begin.</p>

          <button type="button" onClick={onEnableMic} className="action-button primary-action mt-3 px-5">
            Click to start
          </button>

          {typeof onTypeInstead === "function" && (
            <button type="button" onClick={onTypeInstead} className="mt-3 text-xs text-gray-600 underline underline-offset-4 hover:text-chikki-purpleLight">
              Use text chat instead
            </button>
          )}
          </div>
        </main>
        <div className="fit-hide-short"><AppFooter /></div>
      </div>
    </div>
  );
}