import { motion, useTransform } from "framer-motion";
import { inputLevel } from "../voiceLevel.js";

// The listening indicator: a ring around a microphone that grows with how loud you are. Where the browser gives
// no live level (no server transcription), it breathes slowly instead, and faster once words are recognised.
export default function MicOrb({ hearing = false }) {
  const scale = useTransform(inputLevel, (level) => (level < 0 ? 1 : 1 + Math.min(level, 1) * 0.55));
  const glow = useTransform(inputLevel, (level) => (level < 0 ? 0.35 : 0.35 + Math.min(level, 1) * 0.65));
  return (
    <div className={`mic-orb ${hearing ? "is-hearing" : ""}`} role="img" aria-label={hearing ? "Hearing you" : "Listening"}>
      <motion.span className="mic-orb-ring" style={{ scale, opacity: glow }} />
      <span className="mic-orb-core" aria-hidden="true">🎤</span>
    </div>
  );
}
