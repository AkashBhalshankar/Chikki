import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { readSettings } from "../settings.js";

// Animations follow the device's "reduce motion" choice, and Calm mode in Settings turns movement off for everyone.
export default function CalmMotion({ children }) {
  const [calm, setCalm] = useState(() => readSettings().calm);
  useEffect(() => {
    const refresh = () => setCalm(readSettings().calm);
    window.addEventListener("chikki:settings", refresh);
    return () => window.removeEventListener("chikki:settings", refresh);
  }, []);
  return <MotionConfig reducedMotion={calm ? "always" : "user"}>{children}</MotionConfig>;
}
