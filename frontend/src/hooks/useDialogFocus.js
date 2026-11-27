import { useEffect } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keyboard and screen-reader behaviour for every open window (role="dialog"): focus moves into it when it opens,
// Tab stays inside it, and focus returns to what opened it when it closes. One place handles all the windows.
export default function useDialogFocus() {
  useEffect(() => {
    let current = null;
    let opener = null;

    const sync = () => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (dialog && dialog !== current) {
        opener = document.activeElement;
        current = dialog;
        dialog.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
      } else if (!dialog && current) {
        current = null;
        opener?.focus?.({ preventScroll: true });
        opener = null;
      }
    };

    const onKey = (event) => {
      if (event.key !== "Tab" || !current) return;
      const items = [...current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
    };
  }, []);
}
