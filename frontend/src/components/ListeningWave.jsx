// A purely visual indicator (it does not touch the microphone): slow when waiting,
// lively while words are being recognised. Motion stops for visitors who prefer reduced motion.

const BARS = 7;

export default function ListeningWave({ hearing = false }) {
  return (
    <div
      className={`listening-wave ${hearing ? "is-hearing" : ""}`}
      role="img"
      aria-label={hearing ? "Hearing you" : "Listening"}
    >
      {Array.from({ length: BARS }, (_, index) => (
        <span key={index} className="wave-bar" style={{ animationDelay: `${index * 110}ms` }} />
      ))}
    </div>
  );
}
