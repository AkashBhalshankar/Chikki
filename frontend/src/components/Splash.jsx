import { useEffect, useState } from "react";

const installed = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (_) {
    return false;
  }
};

// A short branded opening when the app is launched from the home screen (not in a normal browser tab).
export default function Splash() {
  const [show, setShow] = useState(() => {
    try {
      if (!installed() || sessionStorage.getItem("chikki_splash")) return false;
      sessionStorage.setItem("chikki_splash", "1");
      return true;
    } catch (_) {
      return false;
    }
  });
  useEffect(() => {
    if (!show) return undefined;
    const timer = window.setTimeout(() => setShow(false), 1300);
    return () => window.clearTimeout(timer);
  }, [show]);
  if (!show) return null;
  return (
    <div className="splash" role="presentation">
      <div className="boot-bot"><i /><i /></div>
      <div className="splash-name">CHIKKI</div>
      <div className="splash-tag">Akash Bhalshankar's AI career assistant</div>
    </div>
  );
}
