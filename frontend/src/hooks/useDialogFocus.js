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

    // on a phone a window is a bottom sheet: pull its top edge down to close it
    let dragStart = null;
    let dragCard = null;
    const onTouchStart = (event) => {
      if (!current || window.innerWidth > 639) return;
      const card = current.firstElementChild;
      const touch = event.touches[0];
      if (!card || !card.contains(event.target)) return;
      const top = card.getBoundingClientRect().top;
      if (touch.clientY - top > 56) return; // only the top strip starts a drag, so scrolling inside still works
      dragStart = touch.clientY;
      dragCard = card;
    };
    const onTouchMove = (event) => {
      if (dragStart === null || !dragCard) return;
      const dy = Math.max(0, event.touches[0].clientY - dragStart);
      dragCard.style.transition = "none";
      dragCard.style.transform = `translateY(${dy}px)`;
    };
    const onTouchEnd = (event) => {
      if (dragStart === null || !dragCard) return;
      const dy = (event.changedTouches[0]?.clientY ?? dragStart) - dragStart;
      dragCard.style.transition = "transform 0.2s ease";
      dragCard.style.transform = "";
      dragStart = null;
      dragCard = null;
      if (dy > 90) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
    };
  }, []);
}
