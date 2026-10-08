const LANGUAGES = [
  { code: "en-IN", label: "EN", name: "English" },
  { code: "te-IN", label: "తెలుగు", name: "Telugu" },
  { code: "hi-IN", label: "हिंदी", name: "Hindi" },
];

export default function LanguageSelector({ language, onChange }) {
  return (
    <div
      role="group"
      aria-label="Conversation language"
      className="flex items-center gap-0.5 rounded-md border border-gray-800 bg-gray-900 p-0.5 text-[10px]"
    >
      {LANGUAGES.map((item) => (
        <button
          key={item.code}
          type="button"
          aria-label={item.name}
          aria-pressed={language === item.code}
          title={`Switch to ${item.name}`}
          onClick={() => onChange(item.code)}
          className={`min-h-8 rounded px-2 transition-colors ${
            language === item.code
              ? "bg-chikki-purple/30 font-bold text-chikki-purpleLight"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}