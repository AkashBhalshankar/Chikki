import ChikkiBot from "./ChikkiBot.jsx";
import AppFooter from "./AppFooter.jsx";

export default function StandbyScreen({
  state,
  onEnableMic,
  onTypeInstead,
}) {
  return (
    <div className="min-h-screen dot-grid px-5 py-6 sm:px-8">
      <div className="app-shell flex min-h-[calc(100vh-3rem)] flex-col">
        <header className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-lg tracking-[0.18em] text-chikki-purpleLight">CHIKKI</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-600">AI career assistant</p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.18em] text-gray-600">Voice-first portfolio</span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-gray-600">Representing Akash Bhalshankar</p>
          <ChikkiBot state={state} size={160} />

          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-gray-600">
            <span><span className="text-chikki-green">●</span> Online</span>
            <span className="text-gray-800">/</span>
            <span>Standby</span>
          </div>

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