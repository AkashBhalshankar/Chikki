import { useState } from "react";

/**
 * Text fallback that feeds into the exact same pipeline as voice.
 * onSubmit should be the same handler voice transcripts already use -
 * this is just a different way to produce the same "message" string.
 */
export default function ChatInput({ onSubmit, disabled }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex w-full max-w-md items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type your question to Chikki..."
        className="flex-1 rounded-md bg-chikki-panel border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-chikki-purple disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-md bg-chikki-purple/20 border border-chikki-purple px-4 py-2 text-xs text-chikki-purpleLight hover:bg-chikki-purple/30 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}