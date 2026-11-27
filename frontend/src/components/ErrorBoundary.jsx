import { Component } from "react";

// If something in the page ever crashes, show a calm message with a way out instead of a blank screen.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("Chikki crashed:", error);
  }

  reload = () => window.location.reload();

  startFresh = () => {
    try {
      localStorage.removeItem("chikki_chat_history");
    } catch (_) {
      // nothing to clear
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090b] px-6 text-center font-mono text-gray-200" role="alert">
        <div className="text-3xl" aria-hidden="true">🤖</div>
        <h1 className="text-base font-semibold text-white">Chikki tripped over something</h1>
        <p className="max-w-sm text-xs leading-relaxed text-gray-400">
          Sorry about that. Reloading usually fixes it. If it keeps happening, start fresh: it clears this chat on your device only.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={this.reload} className="rounded-lg border border-indigo-500 bg-indigo-600/30 px-4 py-2 text-xs text-white">Reload</button>
          <button type="button" onClick={this.startFresh} className="rounded-lg border border-gray-600 px-4 py-2 text-xs text-gray-300">Start fresh</button>
        </div>
      </div>
    );
  }
}
