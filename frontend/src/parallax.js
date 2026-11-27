// The background glows drift slightly with the mouse, or with the tilt of a phone. Written to two CSS variables
// (--px and --py, from -1 to 1) that the page background reads. Off for people who prefer reduced motion.

export function startParallax() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
    const root = document.documentElement;
    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      root.style.setProperty("--px", px.toFixed(3));
      root.style.setProperty("--py", py.toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (event) => {
      px = (event.clientX / window.innerWidth - 0.5) * 2;
      py = (event.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };
    const onTilt = (event) => {
      if (event.gamma == null || event.beta == null) return;
      px = Math.max(-1, Math.min(1, event.gamma / 30));
      py = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
      schedule();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // iPhones ask for permission before sharing tilt, so only phones that share it freely are used
    const needsPermission = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
    if (!needsPermission) window.addEventListener("deviceorientation", onTilt, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
    };
  } catch (_) {
    return () => {};
  }
}
