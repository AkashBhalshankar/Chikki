// A calm notice at the top when the phone is offline or Chikki cannot be reached, with a way to still contact Akash.
export default function ConnectionBanner({ offline, lost, onContact }) {
  if (!offline && !lost) return null;
  return (
    <div role="status" aria-live="polite" className="conn-banner fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs">
      <span>
        {offline
          ? "You appear to be offline. Chikki will reconnect as soon as you're back."
          : "Having trouble reaching Chikki. Reconnecting…"}
      </span>
      <span className="flex gap-2">
        {onContact && (
          <button type="button" onClick={onContact} className="conn-banner-btn">✉️ Contact Akash</button>
        )}
        {!offline && (
          <button type="button" onClick={() => window.location.reload()} className="conn-banner-btn">Reload</button>
        )}
      </span>
    </div>
  );
}
