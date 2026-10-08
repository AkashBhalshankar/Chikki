import { useState } from "react";
import { motion } from "framer-motion";

// Central style config per state - drives colors, eye shape, mouth path, and pose.
const STATES = {
  idle: { stroke: "#5B4FE9", eyeFill: "#AFA9EC", mouth: "M 78 62 Q 90 62 102 62", coreFill: "#1c1c1c" },
  listening: { stroke: "#7F77DD", eyeFill: "#0d0d0d", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#26215C", ringsIn: true },
  thinking: { stroke: "#AFA9EC", eyeFill: "#AFA9EC", mouth: "M 82 63 L 98 63", coreFill: "#1c1c1c", dots: true },
  speaking: { stroke: "#7F77DD", eyeFill: "#fff", mouth: "M 78 60 Q 90 63 102 60", coreFill: "#5B4FE9", ringsOutHead: true, talking: true },
  greet: { stroke: "#5B4FE9", eyeFill: "#AFA9EC", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#1c1c1c", wave: true },
  celebrate: { stroke: "#5B4FE9", eyeFill: "#fff", mouth: "M 78 58 Q 90 68 102 58", coreFill: "#5B4FE9", jump: true, sparkles: true },
  happy: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 76 58 Q 90 72 104 58", coreFill: "#27500A", blush: true },
  excited: { stroke: "#D85A30", eyeFill: "#fff", mouth: "M 76 57 Q 90 74 104 57", coreFill: "#7A260D", jump: true, sparkles: true, wideEyes: true },
  surprised: { stroke: "#D85A30", eyeFill: "#fff", mouth: "M 84 61 A 6 7 0 1 0 96 61 A 6 7 0 1 0 84 61", coreFill: "#7A260D", wideEyes: true },
  sad: { stroke: "#4A73A8", eyeFill: "#A8C7E8", mouth: "M 78 68 Q 90 58 102 68", coreFill: "#19324D", tears: true },
  love: { stroke: "#D85A78", eyeFill: "#F28BA5", mouth: "M 76 60 Q 90 72 104 60", coreFill: "#6B1830", hearts: true },
  wink: { stroke: "#D8A52F", eyeFill: "#F4D77A", mouth: "M 78 60 Q 90 68 102 60", coreFill: "#5D4307", wink: true },
  concerned: { stroke: "#AFA9EC", eyeFill: "#AFA9EC", mouth: "M 82 67 Q 90 62 98 67", coreFill: "#29245C", brows: true },
  curious: { stroke: "#4AA3A2", eyeFill: "#8FE1D8", mouth: "M 82 62 Q 90 66 98 62", coreFill: "#124746", headTilt: 8, dots: true, wideEyes: true },
  playful: { stroke: "#D8A52F", eyeFill: "#F4D77A", mouth: "M 76 59 Q 90 73 104 59", coreFill: "#5D4307", wink: true, sparkles: true },
  encouraging: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 76 58 Q 90 72 104 58", coreFill: "#27500A", bounce: true, blush: true },
  neutral: { stroke: "#8A8A8A", eyeFill: "#D0D0D0", mouth: "M 80 63 L 100 63", coreFill: "#303030" },
  relieved: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 62 Q 90 68 102 62", coreFill: "#27500A", closedEyes: true },
  apologetic: { stroke: "#7B8FA8", eyeFill: "#B8C9DA", mouth: "M 82 67 Q 90 63 98 67", coreFill: "#243445", blush: true, headTilt: -5 },
  confident: { stroke: "#5B4FE9", eyeFill: "#C8C3FF", mouth: "M 76 60 Q 90 70 104 60", coreFill: "#3C3489", brows: true, bounce: true },
  skeptical: { stroke: "#A68A42", eyeFill: "#E4CE83", mouth: "M 82 64 Q 90 61 98 64", coreFill: "#4B3A0B", sideEyes: true, headTilt: -4 },
  grateful: { stroke: "#D85A78", eyeFill: "#F28BA5", mouth: "M 78 60 Q 90 69 102 60", coreFill: "#6B1830", closedEyes: true, hearts: true },
  focused: { stroke: "#4A73A8", eyeFill: "#A8C7E8", mouth: "M 82 63 L 98 63", coreFill: "#19324D", brows: true },
  determined: { stroke: "#D85A30", eyeFill: "#F0A078", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#7A260D", brows: true, bounce: true },
  shy: { stroke: "#B56A9B", eyeFill: "#E6A5CB", mouth: "M 84 63 Q 90 66 96 63", coreFill: "#512442", blush: true, headTilt: -5 },
  joyful: { stroke: "#D8A52F", eyeFill: "#F4D77A", mouth: "M 74 57 Q 90 76 106 57", coreFill: "#5D4307", closedEyes: true, sparkles: true, bounce: true },
  laughing: { stroke: "#D85A30", eyeFill: "#fff", mouth: "M 74 56 Q 90 79 106 56", coreFill: "#7A260D", closedEyes: true, sparkles: true, jump: true },
  confused: { stroke: "#AFA9EC", eyeFill: "#AFA9EC", mouth: "M 82 64 Q 90 60 98 64", coreFill: "#1c1c1c", headTilt: -12 },
  error: { stroke: "#993C1D", eyeFill: "none", mouth: "M 82 66 L 98 66", coreFill: "#4A1B0C", xmarks: true },
  ready: { stroke: "#5B4FE9", eyeFill: "#fff", mouth: "M 78 62 Q 90 66 102 62", coreFill: "#3C3489", brows: true, bounce: true },
  nod: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#173404" },
  wake: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 60 Q 90 68 102 60", coreFill: "#173404", stretch: true },
  interrupted: { stroke: "#5B4FE9", eyeFill: "#fff", mouth: "M 84 66 A 6 4 0 1 0 96 66", coreFill: "#1c1c1c", shiver: true },
  proud: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 60 Q 90 67 102 60", coreFill: "#27500A" },
  sleepy: { stroke: "#3C3489", eyeFill: "#7F77DD", mouth: "M 82 63 Q 90 65 98 63", coreFill: "#1c1c1c", dim: true },
};

export default function ChikkiBot({ state = "idle", expression = "confident", size, className, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const safeState = typeof state === "string" && STATES[state] ? state : "idle";
  const safeExpression = typeof expression === "string" && STATES[expression] ? expression : "confident";
  const isSpeaking = safeState === "speaking";
  const cfg = {
    ...STATES.idle,
    ...STATES[isSpeaking ? safeExpression : safeState],
    ...(isSpeaking ? { ringsOutHead: true, talking: true } : {}),
    ...(isHovered
      ? {
          ...STATES.laughing,
          wave: true,
          ...(isSpeaking ? { ringsOutHead: true, talking: true } : {}),
        }
      : {}),
  };
  const fluid = Boolean(className);

  return (
    <motion.svg
      width={fluid ? undefined : size || 180}
      height={fluid ? undefined : (size || 180) * 1.17}
      viewBox="0 0 180 210"
      className={className}
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => {
        setIsHovered(false);
        setEyeOffset({ x: 0, y: 0 });
      }}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        setEyeOffset({ x: x * 2.5, y: y * 1.5 });
      }}
      style={{ cursor: onClick ? "pointer" : "default", ...(fluid ? { aspectRatio: "180 / 210" } : {}) }}
      animate={{
        y: cfg.jump ? [0, -14, 0] : cfg.bounce ? [0, -3, 0] : cfg.sleepy || cfg.dim ? [0, 2, 0] : [0, -4, 0],
        x: cfg.shiver ? [0, -2, 2, 0] : 0,
      }}
      transition={{ duration: cfg.jump ? 0.5 : 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* speaking rings from behind the head */}
      {cfg.ringsOutHead && (
        <>
          <motion.circle cx="90" cy="50" r="16" fill="none" stroke="#7F77DD" strokeWidth="2"
            animate={{ scale: [1, 2.625], opacity: [0.8, 0] }} style={{ transformOrigin: "90px 50px" }} transition={{ duration: 1.2, repeat: Infinity }} />
          <motion.circle cx="90" cy="50" r="16" fill="none" stroke="#AFA9EC" strokeWidth="2"
            animate={{ scale: [1, 2.625], opacity: [0.8, 0] }} style={{ transformOrigin: "90px 50px" }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
        </>
      )}

      <motion.rect x="65" y="30" width="50" height="42" rx="8" fill="#3A3A3A" stroke={cfg.stroke} strokeWidth="2"
        animate={{ rotate: cfg.headTilt || 0 }} style={{ transformOrigin: "90px 50px" }} />

      {cfg.brows && (
        <>
          <path d="M 72 40 L 80 38" stroke="#AFA9EC" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M 100 38 L 108 40" stroke="#AFA9EC" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {cfg.eyeFill !== "none" ? (
        <>
          {cfg.closedEyes ? <><path d="M 74 50 Q 78 54 82 50" fill="none" stroke={cfg.eyeFill} strokeWidth="2" strokeLinecap="round" /><path d="M 98 50 Q 102 54 106 50" fill="none" stroke={cfg.eyeFill} strokeWidth="2" strokeLinecap="round" /></> : cfg.wink ? <path d="M 73 50 Q 77 46 81 50" fill="none" stroke={cfg.eyeFill} strokeWidth="2.5" strokeLinecap="round" /> : <circle cx={80 + eyeOffset.x} cy={50 + eyeOffset.y} r={cfg.wideEyes ? 7 : cfg.ready ? 6.5 : 5} fill={cfg.eyeFill} />}
          {!cfg.closedEyes && <circle cx={(cfg.sideEyes ? 103 : 100) + eyeOffset.x} cy={50 + eyeOffset.y} r={cfg.wideEyes ? 7 : cfg.ready ? 6.5 : 5} fill={cfg.eyeFill} />}
        </>
      ) : (
        <>
          <path d="M 73 42 L 81 48 M 81 42 L 73 48" stroke="#E24B4A" strokeWidth="2" />
          <path d="M 99 42 L 107 48 M 107 42 L 99 48" stroke="#E24B4A" strokeWidth="2" />
        </>
      )}

      <motion.path
        d={cfg.mouth}
        fill="none"
        stroke={cfg.eyeFill !== "none" ? cfg.eyeFill : "#AFA9EC"}
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={cfg.talking ? { d: [cfg.mouth, "M 80 59 Q 90 70 100 59", cfg.mouth] } : {}}
        transition={cfg.talking ? { duration: 0.35, repeat: Infinity } : {}}
      />

      {cfg.dots && (
        <>
          {[[120, 35], [130, 30], [140, 27]].map(([x, y], i) => (
            <motion.circle key={i} cx={x} cy={y} r="3" fill="#AFA9EC"
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </>
      )}

      {cfg.sparkles && (
        <>
          {[[50, 40], [135, 45], [90, 15]].map(([x, y], i) => (
            <motion.circle key={i} cx={x} cy={y} r="3" fill="#97C459"
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </>
      )}

      {cfg.blush && <><circle cx="73" cy="59" r="4" fill="#D85A78" opacity="0.55" /><circle cx="107" cy="59" r="4" fill="#D85A78" opacity="0.55" /></>}

      {cfg.tears && <><motion.path d="M 78 56 Q 76 63 78 65" fill="#7DB7E8" stroke="#7DB7E8" strokeWidth="2" animate={{ y: [0, 4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} /><motion.path d="M 102 56 Q 104 63 102 65" fill="#7DB7E8" stroke="#7DB7E8" strokeWidth="2" animate={{ y: [0, 4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }} /></>}

      {cfg.hearts && <motion.g animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}><text x="40" y="35" fill="#F28BA5" fontSize="13">&#9829;</text><text x="132" y="28" fill="#F28BA5" fontSize="11">&#9829;</text></motion.g>}

      <rect x="67" y="75" width="46" height="55" rx="6" fill="#2A2A2A" stroke="#444" strokeWidth="1" />

      {cfg.ringsIn && (
        <>
          <motion.circle cx="90" cy="100" r="24" fill="none" stroke="#7F77DD" strokeWidth="2"
            animate={{ scale: [1.58, 0.58], opacity: [0, 0.9] }} style={{ transformOrigin: "90px 100px" }} transition={{ duration: 1.3, repeat: Infinity }} />
          <motion.circle cx="90" cy="100" r="24" fill="none" stroke="#AFA9EC" strokeWidth="2"
            animate={{ scale: [1.58, 0.58], opacity: [0, 0.9] }} style={{ transformOrigin: "90px 100px" }} transition={{ duration: 1.3, repeat: Infinity, delay: 0.45 }} />
        </>
      )}

      <motion.circle cx="90" cy="100" r="10" fill={cfg.coreFill} stroke={cfg.stroke} strokeWidth="1.5"
        initial={{ opacity: cfg.dim ? 0.3 : cfg.ringsIn ? 0.5 : 1 }}
        animate={{ opacity: cfg.dim ? [0.3, 0.6, 0.3] : cfg.ringsIn ? [0.5, 1, 0.5] : 1 }}
        transition={{ duration: cfg.dim ? 3 : 1, repeat: Infinity }} />

      <motion.g style={{ transformOrigin: "53px 80px" }}
        animate={cfg.wave ? { rotate: [0, -25, 0, -25, 0] } : cfg.jump || cfg.celebrate ? { y: -16 } : cfg.stretch ? { y: [-8, 0], rotate: [-10, 0] } : {}}
        transition={cfg.wave ? { duration: 0.6, repeat: 3 } : cfg.stretch ? { duration: 0.9, repeat: Infinity } : {}}>
        <rect x="45" y="85" width="16" height="26" rx="4" fill="#2A2A2A" />
        <circle cx="53" cy="80" r="14" fill={safeState === "error" ? "#8a8a8a" : "#D85A30"} />
      </motion.g>

      <motion.g style={{ transformOrigin: "127px 80px" }}
        animate={cfg.jump || cfg.celebrate ? { y: -16 } : {}}>
        <rect x="119" y="85" width="16" height="26" rx="4" fill="#2A2A2A" />
        <circle cx="127" cy="80" r="14" fill={safeState === "error" ? "#8a8a8a" : "#D85A30"} />
      </motion.g>

      <rect x="73" y="130" width="14" height="30" rx="4" fill="#2A2A2A" />
      <rect x="93" y="130" width="14" height="30" rx="4" fill="#2A2A2A" />
    </motion.svg>
  );
}