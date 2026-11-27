// Turns a question and Chikki's answer into a clean 1200x630 picture that can be shared on LinkedIn,
// WhatsApp or in an email. Everything is drawn in the browser; nothing is uploaded.

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 72;

// Splits text into lines that fit `maxWidth`, using `measure(text)` for the width of a piece of text.
// Pure, so it can be tested without a canvas. Long words are broken rather than overflowing.
export function wrapLines(text, maxWidth, measure) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    if (!paragraph.trim()) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      let piece = word;
      while (measure(piece) > maxWidth && piece.length > 1) {
        // a single word wider than the line: cut it at the last character that fits
        let cut = piece.length - 1;
        while (cut > 1 && measure(piece.slice(0, cut)) > maxWidth) cut -= 1;
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(piece.slice(0, cut));
        piece = piece.slice(cut);
      }
      const candidate = line ? `${line} ${piece}` : piece;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = piece;
      }
    }
    if (line) lines.push(line);
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// Keeps at most `maxLines` lines; the last kept line ends with an ellipsis when something was cut.
export function clampLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:\s]+$/, "")}…`;
  return kept;
}

export async function renderAnswerCard({ question, answer }) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#0b0b10");
  gradient.addColorStop(1, "#1b1740");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const font = (size, weight = 400) => `${weight} ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
  const measure = (size, weight) => (text) => {
    ctx.font = font(size, weight);
    return ctx.measureText(text).width;
  };
  const maxWidth = WIDTH - PAD * 2;

  // the question
  ctx.fillStyle = "#AFA9EC";
  ctx.font = font(24, 600);
  ctx.fillText("QUESTION", PAD, 78);
  ctx.fillStyle = "#ffffff";
  const questionLines = clampLines(wrapLines(question, maxWidth, measure(36, 600)), 2);
  ctx.font = font(36, 600);
  questionLines.forEach((line, i) => ctx.fillText(line, PAD, 130 + i * 46));

  // a divider
  const dividerY = 130 + questionLines.length * 46 + 8;
  ctx.fillStyle = "rgba(129, 140, 248, 0.45)";
  ctx.fillRect(PAD, dividerY, 96, 4);

  // the answer
  ctx.fillStyle = "#e4e4ec";
  const answerTop = dividerY + 52;
  const lineHeight = 38;
  const room = Math.floor((HEIGHT - 100 - answerTop) / lineHeight);
  // blank lines between paragraphs would waste the little room there is, so they are dropped
  const answerLines = clampLines(wrapLines(String(answer).replace(/\n{2,}/g, "\n"), maxWidth, measure(28)), Math.max(room, 4));
  ctx.font = font(28);
  answerLines.forEach((line, i) => ctx.fillText(line, PAD, answerTop + i * lineHeight));

  // footer
  ctx.fillStyle = "#6ee7b7";
  ctx.font = font(24, 500);
  ctx.fillText("✓ Checked against Akash's resume", PAD, HEIGHT - 48);
  ctx.fillStyle = "#8b8fa8";
  ctx.textAlign = "right";
  ctx.fillText("Chikki · akashbhalshankar.com", WIDTH - PAD, HEIGHT - 48);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the card"))), "image/png");
  });
}

// Opens the share sheet where the device supports sharing files, otherwise downloads the picture.
export async function shareAnswerCard({ question, answer }) {
  const blob = await renderAnswerCard({ question, answer });
  const file = new File([blob], "chikki-answer.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Chikki", text: "Asked Chikki about Akash: akashbhalshankar.com" });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "chikki-answer.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
