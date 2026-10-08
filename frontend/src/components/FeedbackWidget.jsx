import { useState } from "react";

/**
 * onSubmit(value, comment) is called once, when the user either hits
 * "Send" after optionally typing a comment, or clicks "Skip" to submit
 * with no comment at all. The comment box only appears after a rating
 * is picked, so most people can still leave feedback in one click.
 */
export default function FeedbackWidget({ onSubmit, compact = false }) {
  const [pendingValue, setPendingValue] = useState(null); // "helpful" | "needs-improvement" | null
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-[10px] text-gray-500">Thanks for the feedback.</p>;
  }

  if (pendingValue) {
    const finish = (finalComment) => {
      onSubmit(pendingValue, finalComment);
      setDone(true);
    };

    return (
      <div className={compact ? "mt-2" : "mt-3"}>
        <p className="text-[10px] text-gray-500 mb-1">
          {pendingValue === "helpful"
            ? "Anything that could make it even better? (optional)"
            : "What should Chikki have done differently? (optional)"}
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Type a note, or just skip..."
          className="w-full rounded-md border border-gray-700 bg-chikki-panel px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-chikki-purple resize-none"
        />
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => finish(comment)}
            className="rounded-md border border-chikki-purple bg-chikki-purple/20 px-3 py-1 text-[10px] text-chikki-purpleLight hover:bg-chikki-purple/30"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => finish("")}
            className="rounded-md border border-gray-700 px-3 py-1 text-[10px] text-gray-500 hover:text-gray-300"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-[10px] text-gray-600">
      <span>Was that helpful?</span>
      <button type="button" onClick={() => setPendingValue("helpful")} className="hover:text-chikki-green">
        Yes
      </button>
      <button type="button" onClick={() => setPendingValue("needs-improvement")} className="hover:text-red-300">
        Not quite
      </button>
    </div>
  );
}