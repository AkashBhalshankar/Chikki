import { useEffect, useRef, useState } from "react";

/**
 * "More" dropdown that keeps the main button row short.
 * items: [{ key, label, href?, onClick?, keepOpen?, danger? }]
 * direction: "down" opens below the button, "up" opens above it.
 */
export default function MoreMenu({ items, direction = "down", label = "More" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener("chikki:open-menu", openMenu);
    return () => window.removeEventListener("chikki:open-menu", openMenu);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // a { heading } entry titles the group below it; a heading with nothing under it is dropped
  const present = items.filter(Boolean);
  const visible = present.filter((item, index) => !item.heading || (present[index + 1] && !present[index + 1].heading));
  if (!visible.some((item) => !item.heading)) return null;

  const itemClass = (danger) =>
    `flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-chikki-purple/15 ${
      danger ? "text-rose-300" : "text-gray-300"
    }`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="action-button"
      >
        {label} <span aria-hidden="true" className="ml-1 text-[9px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={`more-menu absolute right-0 z-40 w-52 overflow-hidden rounded-lg border border-gray-700 bg-zinc-900 shadow-xl ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {visible.map((item) => {
            if (item.heading) {
              return (
                <div key={item.key} role="presentation" className="more-heading">
                  {item.heading}
                </div>
              );
            }
            const close = () => !item.keepOpen && setOpen(false);
            return item.href ? (
              <a
                key={item.key}
                role="menuitem"
                href={item.href}
                target={item.href.startsWith("tel:") ? undefined : "_blank"}
                rel="noreferrer"
                onClick={close}
                className={itemClass(item.danger)}
              >
                {item.label}
              </a>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick?.();
                  close();
                }}
                className={itemClass(item.danger)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
