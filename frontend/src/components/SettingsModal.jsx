import { useEffect, useState } from "react";
import { ACCENTS, OUTFITS, PAUSES, SKINS, SPEEDS, TEXT_SIZES, VOICES, applyLook, readSettings, saveSettings } from "../settings.js";

function Choice({ label, options, value, onChange }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id ?? option.value}
            type="button"
            role="radio"
            aria-checked={(option.id ?? option.value) === value}
            onClick={() => onChange(option.id ?? option.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              (option.id ?? option.value) === value
                ? "border-chikki-purple bg-chikki-purple/15 text-white"
                : "border-gray-800 text-gray-300 hover:border-gray-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose, onChange }) {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    if (!isOpen) return undefined;
    setSettings(readSettings());
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = (patch) => {
    const saved = saveSettings({ ...settings, ...patch });
    applyLook(saved);
    setSettings(saved);
    onChange?.(saved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="max-w-md w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl chikki-scroll space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="settings-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">SETTINGS</h2>
            <p className="mt-1 text-[11px] text-gray-400">Saved on this device only.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700">✕</button>
        </div>
        <Choice label="Accent colour" options={ACCENTS} value={settings.accent} onChange={(accent) => update({ accent })} />
        <Choice label="Background theme (dark mode)" options={SKINS} value={settings.skin} onChange={(skin) => update({ skin })} />
        <Choice label="Chikki's outfit" options={OUTFITS} value={settings.outfit} onChange={(outfit) => update({ outfit })} />
        <Choice label="Text size" options={TEXT_SIZES} value={settings.textSize} onChange={(textSize) => update({ textSize })} />
        <Choice
          label="High contrast"
          options={[{ id: "off", label: "Standard" }, { id: "on", label: "High contrast" }]}
          value={settings.contrast ? "on" : "off"}
          onChange={(value) => update({ contrast: value === "on" })}
        />
        <Choice
          label="Easy-to-read font"
          options={[{ id: "off", label: "Standard" }, { id: "on", label: "Easy to read" }]}
          value={settings.readable ? "on" : "off"}
          onChange={(value) => update({ readable: value === "on" })}
        />
        <Choice label="Voice (English)" options={VOICES} value={settings.voice} onChange={(voice) => update({ voice })} />
        <Choice label="Speaking speed" options={SPEEDS} value={settings.speed} onChange={(speed) => update({ speed })} />
        <Choice label="Wait after I stop talking" options={Object.values(PAUSES)} value={settings.pause} onChange={(pause) => update({ pause })} />
        <Choice
          label="Soft chimes"
          options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]}
          value={settings.sounds ? "on" : "off"}
          onChange={(value) => update({ sounds: value === "on" })}
        />
        <Choice
          label="Show transcript in voice mode"
          options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]}
          value={settings.transcript ? "on" : "off"}
          onChange={(value) => update({ transcript: value === "on" })}
        />
        <Choice
          label="Mouse glow (desktop)"
          options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]}
          value={settings.cursor ? "on" : "off"}
          onChange={(value) => update({ cursor: value === "on" })}
        />
        <Choice
          label="Vibration on phones"
          options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]}
          value={settings.haptics ? "on" : "off"}
          onChange={(value) => update({ haptics: value === "on" })}
        />
        <p className="text-[10px] text-gray-500">Hindi and Telugu always use their own voice. Changes apply to the next answer.</p>
      </div>
    </div>
  );
}
