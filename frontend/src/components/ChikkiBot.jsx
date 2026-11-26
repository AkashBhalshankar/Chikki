import { useEffect, useState } from "react";
import { AnimatePresence, motion, useTransform } from "framer-motion";
import { mouthLevel } from "../voiceLevel.js";
import { seasonFor } from "../seasonal.js";

// Central style config per state - drives colors, eye shape, mouth path, and pose.
const STATES = {
  idle: { stroke: "#5B4FE9", eyeFill: "#AFA9EC", mouth: "M 78 62 Q 90 62 102 62", coreFill: "#1c1c1c", blink: true },
  listening: { stroke: "#7F77DD", eyeFill: "#0d0d0d", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#26215C", ringsIn: true },
  thinking: { stroke: "#AFA9EC", eyeFill: "#AFA9EC", mouth: "M 82 63 L 98 63", coreFill: "#1c1c1c", dots: true },
  speaking: { stroke: "#7F77DD", eyeFill: "#fff", mouth: "M 78 60 Q 90 63 102 60", coreFill: "#5B4FE9", ringsOutHead: true, talking: true },
  greet: { stroke: "#5B4FE9", eyeFill: "#AFA9EC", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#1c1c1c", wave: true },
  celebrate: { stroke: "#5B4FE9", eyeFill: "#fff", mouth: "M 78 58 Q 90 68 102 58", coreFill: "#5B4FE9", jump: true, confetti: true, armsUp: true },
  happy: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 76 58 Q 90 72 104 58", coreFill: "#27500A", blush: true },
  excited: { stroke: "#D85A30", eyeFill: "#fff", mouth: "M 76 57 Q 90 74 104 57", coreFill: "#7A260D", jump: true, sparkles: true, wideEyes: true },
  surprised: { stroke: "#D85A30", eyeFill: "#fff", mouth: "M 84 61 A 6 7 0 1 0 96 61 A 6 7 0 1 0 84 61", coreFill: "#7A260D", wideEyes: true },
  sad: { stroke: "#4A73A8", eyeFill: "#A8C7E8", mouth: "M 78 68 Q 90 58 102 68", coreFill: "#19324D", tears: true },
  love: { stroke: "#D85A78", eyeFill: "#F28BA5", mouth: "M 76 60 Q 90 72 104 60", coreFill: "#6B1830", hearts: true },
  wink: { stroke: "#D8A52F", eyeFill: "#F4D77A", mouth: "M 78 60 Q 90 68 102 60", coreFill: "#5D4307", wink: true },
  concerned: { stroke: "#AFA9EC", eyeFill: "#AFA9EC", mouth: "M 82 67 Q 90 62 98 67", coreFill: "#29245C", brows: true },
  curious: { stroke: "#4AA3A2", eyeFill: "#8FE1D8", mouth: "M 82 62 Q 90 66 98 62", coreFill: "#124746", headTilt: 8, dots: true, wideEyes: true },
  playful: { stroke: "#D8A52F", eyeFill: "#F4D77A", mouth: "M 76 59 Q 90 73 104 59", coreFill: "#5D4307", wink: true, sparkles: true },
  encouraging: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 76 58 Q 90 72 104 58", coreFill: "#27500A", bounce: true, blush: true, armUp: true },
  neutral: { stroke: "#8A8A8A", eyeFill: "#D0D0D0", mouth: "M 80 63 L 100 63", coreFill: "#303030" },
  relieved: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 62 Q 90 68 102 62", coreFill: "#27500A", closedEyes: true, puff: true },
  apologetic: { stroke: "#7B8FA8", eyeFill: "#B8C9DA", mouth: "M 82 67 Q 90 63 98 67", coreFill: "#243445", blush: true, headTilt: -5, sweat: true },
  confident: { stroke: "#5B4FE9", eyeFill: "#C8C3FF", mouth: "M 76 60 Q 90 70 104 60", coreFill: "#3C3489", brows: true, bounce: true },
  skeptical: { stroke: "#A68A42", eyeFill: "#E4CE83", mouth: "M 82 64 Q 90 61 98 64", coreFill: "#4B3A0B", sideEyes: true, headTilt: -4, browRaised: true },
  grateful: { stroke: "#D85A78", eyeFill: "#F28BA5", mouth: "M 78 60 Q 90 69 102 60", coreFill: "#6B1830", closedEyes: true, hearts: true, headTilt: 7, headDip: true },
  focused: { stroke: "#4A73A8", eyeFill: "#A8C7E8", mouth: "M 82 63 L 98 63", coreFill: "#19324D", brows: true },
  determined: { stroke: "#D85A30", eyeFill: "#F0A078", mouth: "M 80 62 L 100 62", coreFill: "#7A260D", browsAngry: true, bounce: true },
  shy: { stroke: "#B56A9B", eyeFill: "#E6A5CB", mouth: "M 84 63 Q 90 66 96 63", coreFill: "#512442", blush: true, headTilt: -5 },
  joyful: { stroke: "#D8A52F", eyeFill: "#F4D77A", mouth: "M 74 57 Q 90 76 106 57", coreFill: "#5D4307", closedEyes: true, sparkles: true, bounce: true },
  laughing: { stroke: "#D85A30", eyeFill: "#fff", mouth: "M 74 56 Q 90 79 106 56", coreFill: "#7A260D", closedEyes: true, sparkles: true, jump: true },
  confused: { stroke: "#AFA9EC", eyeFill: "#AFA9EC", mouth: "M 82 64 Q 90 60 98 64", coreFill: "#1c1c1c", headTilt: -12, question: true },
  error: { stroke: "#993C1D", eyeFill: "none", mouth: "M 82 66 L 98 66", coreFill: "#4A1B0C", xmarks: true },
  ready: { stroke: "#5B4FE9", eyeFill: "#fff", mouth: "M 78 62 Q 90 66 102 62", coreFill: "#3C3489", brows: true, bounce: true, ready: true },
  nod: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 60 Q 90 66 102 60", coreFill: "#173404", headDip: true },
  wake: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 60 Q 90 68 102 60", coreFill: "#173404", stretch: true },
  interrupted: { stroke: "#5B4FE9", eyeFill: "#fff", mouth: "M 84 66 A 6 4 0 1 0 96 66", coreFill: "#1c1c1c", shiver: true, bang: true, wideEyes: true },
  proud: { stroke: "#639922", eyeFill: "#97C459", mouth: "M 78 60 Q 90 67 102 60", coreFill: "#27500A", medal: true, brows: true },
  sleepy: { stroke: "#3C3489", eyeFill: "#7F77DD", mouth: "M 82 63 Q 90 65 98 63", coreFill: "#1c1c1c", dim: true, closedEyes: true, zzz: true },
};


// ---- smoothing helpers -------------------------------------------------------------------------
// Every mouth is stored as one quadratic curve so Framer Motion can blend between any two faces.
// Round mouths (surprised, interrupted) are an ellipse that fades in instead.
function parseMouth(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  if (d.includes(" A ")) {
    const [x1, y1, rx, ry, , , , x2] = nums;
    return { d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1} ${x2} ${y1}`, round: { cx: (x1 + x2) / 2, cy: y1, rx, ry } };
  }
  if (d.includes(" L ")) {
    const [x1, y1, x2, y2] = nums;
    return { d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2} ${x2} ${y2}`, round: null };
  }
  return { d, round: null };
}

const SPRING = { type: "spring", stiffness: 260, damping: 26 };
const COLOR = { duration: 0.4, ease: "easeInOut" };
const FADE = { duration: 0.25 };

// A decoration that fades and scales in and out as the face changes.
function Pop({ show, children, id }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.g key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
          {children}
        </motion.g>
      )}
    </AnimatePresence>
  );
}

const ARC_CLOSED = ["M 74 50 Q 78 54 82 50", "M 98 50 Q 102 54 106 50"];
const ARC_WINK = "M 73 50 Q 77 46 81 50";

export default function ChikkiBot({ state = "idle", expression = "confident", size, className, onClick, faceOnly = false, season }) {
  const festive = season === undefined ? seasonFor(new Date()) : season;
  const [isHovered, setIsHovered] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [liveMouth, setLiveMouth] = useState(mouthLevel.get() >= 0);
  useEffect(() => mouthLevel.on("change", (v) => setLiveMouth((was) => (v >= 0) !== was ? v >= 0 : was)), []);
  const talkPath = useTransform(mouthLevel, (v) => `M 80 59 Q 90 ${60 + Math.max(0, v) * 15} 100 59 Z`);

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

  const mouth = parseMouth(cfg.mouth);
  const hasEyes = cfg.eyeFill !== "none";
  const eyeColor = hasEyes ? cfg.eyeFill : "#AFA9EC";
  const eyeR = cfg.wideEyes ? 7 : cfg.ready ? 6.5 : 5;
  const leftClosed = hasEyes && (cfg.closedEyes || cfg.wink);
  const rightClosed = hasEyes && cfg.closedEyes;
  const blinks = cfg.blink || (!cfg.closedEyes && !cfg.wink && hasEyes); // everyone blinks now and then
  const talkingLive = cfg.talking && liveMouth;
  const armColor = safeState === "error" ? "#8a8a8a" : "#D85A30";

  return (
    <motion.svg
      width={fluid ? undefined : size || 180}
      height={fluid ? undefined : (size || 180) * (faceOnly ? 0.68 : 1.17)}
      viewBox={faceOnly ? "38 6 104 71" : "0 0 180 210"}
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
      style={{ cursor: onClick ? "pointer" : "default", ...(fluid ? { aspectRatio: faceOnly ? "104 / 71" : "180 / 210" } : {}) }}
      animate={{
        y: cfg.jump ? [0, -14, 0] : cfg.bounce ? [0, -3, 0] : cfg.dim ? [0, 2, 0] : [0, -4, 0],
        x: cfg.shiver ? [0, -2, 2, 0] : 0,
      }}
      transition={{ duration: cfg.jump ? 0.5 : 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* speaking rings from behind the head */}
      <Pop show={cfg.ringsOutHead} id="rings">
        <motion.circle cx="90" cy="50" r="16" fill="none" stroke="#7F77DD" strokeWidth="2"
          animate={{ scale: [1, 2.625], opacity: [0.8, 0] }} style={{ transformOrigin: "90px 50px" }} transition={{ duration: 1.2, repeat: Infinity }} />
        <motion.circle cx="90" cy="50" r="16" fill="none" stroke="#AFA9EC" strokeWidth="2"
          animate={{ scale: [1, 2.625], opacity: [0.8, 0] }} style={{ transformOrigin: "90px 50px" }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
      </Pop>

      <motion.g animate={cfg.headDip ? { y: [0, 5, 0, 5, 0] } : { y: 0 }} transition={cfg.headDip ? { duration: 1.1, repeat: Infinity } : SPRING}>
        <motion.rect x="65" y="30" width="50" height="42" rx="8" fill="#3A3A3A" strokeWidth="2"
          initial={false} animate={{ rotate: cfg.headTilt || 0, stroke: cfg.stroke }}
          transition={{ rotate: SPRING, stroke: COLOR }} style={{ transformOrigin: "90px 50px" }} />

        {festive === "santa" && (
          <g>
            <path d="M 68 31 Q 78 6 104 9 Q 110 20 112 31 Z" fill="#D93636" />
            <rect x="64" y="28" width="52" height="6" rx="3" fill="#F5F5F5" />
            <circle cx="106" cy="9" r="5" fill="#F5F5F5" />
          </g>
        )}
        {festive === "party" && (
          <g>
            <path d="M 78 31 L 90 4 L 102 31 Z" fill="#F4D77A" stroke="#D8A52F" strokeWidth="1" />
            <circle cx="86" cy="22" r="2" fill="#F28BA5" />
            <circle cx="93" cy="14" r="2" fill="#8FE1D8" />
            <circle cx="90" cy="3" r="3" fill="#F28BA5" />
          </g>
        )}
        {festive === "tricolor" && (
          <g>
            <rect x="65" y="27" width="50" height="3" rx="1.5" fill="#FF9933" />
            <rect x="65" y="30" width="50" height="3" fill="#FFFFFF" />
            <rect x="65" y="33" width="50" height="3" rx="1.5" fill="#138808" />
          </g>
        )}
        {festive === "diya" && (
          <g>
            <motion.path d="M 90 12 Q 97 21 90 27 Q 83 21 90 12 Z" fill="#FFB020"
              animate={{ scaleY: [1, 1.15, 0.95, 1], opacity: [0.9, 1, 0.85, 0.9] }}
              style={{ transformOrigin: "90px 27px" }} transition={{ duration: 0.9, repeat: Infinity }} />
            <path d="M 81 28 Q 90 36 99 28 Z" fill="#B5651D" />
          </g>
        )}

        <Pop show={cfg.browsAngry} id="browsAngry">
          <path d="M 71 36 L 82 41" stroke="#F0A078" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 98 41 L 109 36" stroke="#F0A078" strokeWidth="2.2" strokeLinecap="round" />
        </Pop>
        <Pop show={cfg.browRaised} id="browRaised">
          <path d="M 71 35 Q 77 31 83 34" fill="none" stroke="#E4CE83" strokeWidth="2" strokeLinecap="round" />
          <path d="M 98 40 L 108 41" stroke="#E4CE83" strokeWidth="2" strokeLinecap="round" />
        </Pop>
        <Pop show={cfg.brows} id="brows">
          <path d="M 72 40 L 80 38" stroke="#AFA9EC" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M 100 38 L 108 40" stroke="#AFA9EC" strokeWidth="1.8" strokeLinecap="round" />
        </Pop>

        {/* Eyes: open eyes slide, grow and recolour smoothly; closed eyes fade in over them. */}
        <motion.g style={{ transformOrigin: "90px 50px" }}
          animate={blinks ? { scaleY: [1, 1, 1, 0.1, 1] } : { scaleY: 1 }}
          transition={blinks ? { duration: 4.5, repeat: Infinity, times: [0, 0.88, 0.92, 0.96, 1] } : SPRING}>
          <motion.circle initial={false} animate={{ cx: 80 + eyeOffset.x, cy: 50 + eyeOffset.y, r: eyeR, fill: eyeColor, opacity: hasEyes && !leftClosed ? 1 : 0 }}
            transition={{ cx: { type: "spring", stiffness: 300, damping: 24 }, cy: { type: "spring", stiffness: 300, damping: 24 }, r: SPRING, fill: COLOR, opacity: FADE }} />
          <motion.circle initial={false} animate={{ cx: (cfg.sideEyes ? 103 : 100) + eyeOffset.x, cy: 50 + eyeOffset.y, r: eyeR, fill: eyeColor, opacity: hasEyes && !rightClosed ? 1 : 0 }}
            transition={{ cx: { type: "spring", stiffness: 300, damping: 24 }, cy: { type: "spring", stiffness: 300, damping: 24 }, r: SPRING, fill: COLOR, opacity: FADE }} />
          <motion.path d={cfg.closedEyes ? ARC_CLOSED[0] : ARC_WINK} fill="none" strokeLinecap="round"
            initial={false} animate={{ stroke: eyeColor, opacity: leftClosed ? 1 : 0, strokeWidth: cfg.closedEyes ? 2 : 2.5 }} transition={{ stroke: COLOR, opacity: FADE }} />
          <motion.path d={ARC_CLOSED[1]} fill="none" strokeLinecap="round" strokeWidth="2"
            initial={false} animate={{ stroke: eyeColor, opacity: rightClosed ? 1 : 0 }} transition={{ stroke: COLOR, opacity: FADE }} />
        </motion.g>
        <Pop show={!hasEyes} id="xeyes">
          <path d="M 73 42 L 81 48 M 81 42 L 73 48" stroke="#E24B4A" strokeWidth="2" />
          <path d="M 99 42 L 107 48 M 107 42 L 99 48" stroke="#E24B4A" strokeWidth="2" />
        </Pop>

        {/* Mouth: one curve that morphs; a round mouth fades in for "oh"; the voice drives it when speaking. */}
        <motion.path
          fill="none" strokeWidth="2.5" strokeLinecap="round"
          initial={false}
          animate={{ d: mouth.d, stroke: eyeColor, opacity: mouth.round || talkingLive ? 0 : 1 }}
          transition={{ d: SPRING, stroke: COLOR, opacity: FADE }}
        />
        {cfg.talking && !liveMouth && (
          <motion.path d={mouth.d} fill="none" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round"
            animate={{ d: [mouth.d, "M 80 59 Q 90 70 100 59", mouth.d] }} transition={{ duration: 0.35, repeat: Infinity }} />
        )}
        {talkingLive && (
          <motion.path d={talkPath} stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill={eyeColor} fillOpacity="0.4" />
        )}
        <motion.ellipse initial={false}
          animate={{ cx: mouth.round?.cx ?? 90, cy: mouth.round?.cy ?? 62, rx: mouth.round?.rx ?? 4, ry: mouth.round?.ry ?? 4, opacity: mouth.round ? 1 : 0, stroke: eyeColor }}
          transition={{ default: SPRING, opacity: FADE, stroke: COLOR }} fill="none" strokeWidth="2.5" />

        <Pop show={cfg.dots} id="dots">
          {[[120, 35], [130, 30], [140, 27]].map(([x, y], i) => (
            <motion.circle key={i} cx={x} cy={y} r="3" fill="#AFA9EC"
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </Pop>

        <Pop show={cfg.sparkles} id="sparkles">
          {[[50, 40], [135, 45], [90, 15]].map(([x, y], i) => (
            <motion.circle key={i} cx={x} cy={y} r="3" fill="#97C459"
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </Pop>

        <Pop show={cfg.blush} id="blush">
          <circle cx="73" cy="59" r="4" fill="#D85A78" opacity="0.55" />
          <circle cx="107" cy="59" r="4" fill="#D85A78" opacity="0.55" />
        </Pop>

        <Pop show={cfg.tears} id="tears">
          <motion.path d="M 78 56 Q 76 63 78 65" fill="#7DB7E8" stroke="#7DB7E8" strokeWidth="2" animate={{ y: [0, 4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <motion.path d="M 102 56 Q 104 63 102 65" fill="#7DB7E8" stroke="#7DB7E8" strokeWidth="2" animate={{ y: [0, 4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }} />
        </Pop>

        <Pop show={cfg.hearts} id="hearts">
          <motion.g animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <text x="40" y="35" fill="#F28BA5" fontSize="13">&#9829;</text>
            <text x="132" y="28" fill="#F28BA5" fontSize="11">&#9829;</text>
          </motion.g>
        </Pop>

        <Pop show={cfg.sweat} id="sweat">
          <motion.path d="M 119 38 Q 115 44 119 47 Q 123 44 119 38" fill="#7DB7E8" animate={{ y: [0, 5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }} />
        </Pop>

        <Pop show={cfg.puff} id="puff">
          {[[112, 66, 0], [118, 62, 0.3], [124, 58, 0.6]].map(([x, y, d], i) => (
            <motion.circle key={i} cx={x} cy={y} r={2 + i} fill="#97C459" animate={{ opacity: [0, 0.8, 0], x: [0, 4, 8] }} transition={{ duration: 1.6, repeat: Infinity, delay: d }} />
          ))}
        </Pop>

        <Pop show={cfg.question} id="question">
          <motion.text x="118" y="34" fill="#AFA9EC" fontSize="20" fontWeight="bold" animate={{ y: [0, -4, 0], rotate: [0, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>?</motion.text>
        </Pop>

        <Pop show={cfg.bang} id="bang">
          <motion.text x="119" y="34" fill="#E24B4A" fontSize="22" fontWeight="bold" animate={{ scale: [1, 1.25, 1] }} style={{ transformOrigin: "122px 28px" }} transition={{ duration: 0.5, repeat: Infinity }}>!</motion.text>
        </Pop>

        <Pop show={cfg.zzz} id="zzz">
          {[[116, 38, 11, 0], [126, 28, 14, 0.5], [136, 17, 17, 1]].map(([x, y, fontSize, d], i) => (
            <motion.text key={i} x={x} y={y} fill="#7F77DD" fontSize={fontSize} fontWeight="bold" animate={{ opacity: [0, 1, 0], y: [y + 4, y - 4] }} transition={{ duration: 2.4, repeat: Infinity, delay: d }}>z</motion.text>
          ))}
        </Pop>

        <Pop show={cfg.confetti} id="confetti">
          {[[40, 18, "#F4D77A"], [64, 8, "#F28BA5"], [116, 10, "#97C459"], [142, 22, "#8FE1D8"], [90, 4, "#D85A30"], [28, 52, "#AFA9EC"], [152, 56, "#F4D77A"]].map(([x, y, color], i) => (
            <motion.rect key={i} x={x} y={y} width="5" height="5" rx="1" fill={color}
              animate={{ y: [0, 26], rotate: [0, 180], opacity: [1, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }} />
          ))}
        </Pop>
      </motion.g>

      {!faceOnly && (
        <>
          <rect x="67" y="75" width="46" height="55" rx="6" fill="#2A2A2A" stroke="#444" strokeWidth="1" />

          <Pop show={cfg.ringsIn} id="ringsIn">
            <motion.circle cx="90" cy="100" r="24" fill="none" stroke="#7F77DD" strokeWidth="2"
              animate={{ scale: [1.58, 0.58], opacity: [0, 0.9] }} style={{ transformOrigin: "90px 100px" }} transition={{ duration: 1.3, repeat: Infinity }} />
            <motion.circle cx="90" cy="100" r="24" fill="none" stroke="#AFA9EC" strokeWidth="2"
              animate={{ scale: [1.58, 0.58], opacity: [0, 0.9] }} style={{ transformOrigin: "90px 100px" }} transition={{ duration: 1.3, repeat: Infinity, delay: 0.45 }} />
          </Pop>

          <motion.circle cx="90" cy="100" r="10" strokeWidth="1.5" initial={false}
            animate={{ fill: cfg.coreFill, stroke: cfg.stroke, opacity: cfg.dim ? [0.3, 0.6, 0.3] : cfg.ringsIn ? [0.5, 1, 0.5] : 1 }}
            transition={{ fill: COLOR, stroke: COLOR, opacity: { duration: cfg.dim ? 3 : 1, repeat: cfg.dim || cfg.ringsIn ? Infinity : 0 } }} />

          <Pop show={cfg.medal} id="medal">
            <path d="M 90 114 L 92.4 119 L 98 119.7 L 94 123.5 L 95 129 L 90 126.3 L 85 129 L 86 123.5 L 82 119.7 L 87.6 119 Z" fill="#F4D77A" stroke="#D8A52F" strokeWidth="0.8" />
          </Pop>

          <motion.g style={{ transformOrigin: "53px 80px" }} initial={false}
            animate={cfg.wave ? { rotate: [0, -25, 0, -25, 0], y: 0 } : cfg.jump || cfg.armsUp ? { y: -16, rotate: 0 } : cfg.stretch ? { y: [-8, 0], rotate: [-10, 0] } : { y: 0, rotate: 0 }}
            transition={cfg.wave ? { duration: 0.6, repeat: 3 } : cfg.stretch ? { duration: 0.9, repeat: Infinity } : SPRING}>
            <rect x="45" y="85" width="16" height="26" rx="4" fill="#2A2A2A" />
            <motion.circle cx="53" cy="80" r="14" initial={false} animate={{ fill: armColor }} transition={COLOR} />
          </motion.g>

          <motion.g style={{ transformOrigin: "127px 80px" }} initial={false}
            animate={cfg.jump || cfg.armUp || cfg.armsUp ? { y: -16 } : { y: 0 }} transition={SPRING}>
            <rect x="119" y="85" width="16" height="26" rx="4" fill="#2A2A2A" />
            <motion.circle cx="127" cy="80" r="14" initial={false} animate={{ fill: armColor }} transition={COLOR} />
          </motion.g>

          <rect x="73" y="130" width="14" height="30" rx="4" fill="#2A2A2A" />
          <rect x="93" y="130" width="14" height="30" rx="4" fill="#2A2A2A" />
        </>
      )}
    </motion.svg>
  );
}
