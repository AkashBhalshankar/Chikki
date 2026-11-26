// Tells visitors who Chikki represents. Everything comes from optional VITE_ settings
// and falls back to values already used across the app.

const NAME = import.meta.env.VITE_PROFILE_NAME || "Akash Bhalshankar";
const TITLE = import.meta.env.VITE_PROFILE_TITLE || "AI Engineer";
const PHOTO = import.meta.env.VITE_PROFILE_PHOTO_URL || "";
const OPEN_TO_WORK_RAW = import.meta.env.VITE_OPEN_TO_WORK;
// Unset shows the default text; set it to "off" to hide, or to your own wording.
const OPEN_TO_WORK =
  OPEN_TO_WORK_RAW && ["off", "false", "0"].includes(OPEN_TO_WORK_RAW.toLowerCase())
    ? ""
    : OPEN_TO_WORK_RAW || "Open to AI Engineer roles";

const INITIALS = NAME.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

function Avatar({ size }) {
  const style = { width: size, height: size };
  return PHOTO ? (
    <img src={PHOTO} alt={NAME} style={style} className="shrink-0 rounded-full border border-chikki-purple/50 object-cover" />
  ) : (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size * 0.38 }}
      className="profile-avatar flex shrink-0 items-center justify-center rounded-full border border-chikki-purple/50 font-semibold text-chikki-purpleLight"
    >
      {INITIALS}
    </span>
  );
}

/** Full card for the start screen. */
export function ProfileCard() {
  return (
    <div className="profile-card mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-gray-800 bg-zinc-900/40 px-4 py-3 text-left">
      <Avatar size={52} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Chikki represents</p>
        <p className="truncate text-sm font-semibold text-gray-100">{NAME}</p>
        <p className="text-xs text-gray-400">{TITLE}</p>
        {OPEN_TO_WORK && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {OPEN_TO_WORK}
          </p>
        )}
      </div>
    </div>
  );
}

/** One-line version for the screen headers. */
export function ProfileLine() {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-gray-500">
      <Avatar size={16} />
      <span className="truncate">
        {NAME} · {TITLE}
      </span>
    </p>
  );
}
