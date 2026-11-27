import { SKILL_GROUPS, skillQuestion } from "../play.js";

// A small map of Akash's skills. Tap one and Chikki tells you where he used it.
export default function SkillMap({ onAsk, disabled }) {
  return (
    <div className="skill-map mt-2 ml-1 max-w-[96%] rounded-lg border border-gray-800 bg-zinc-900/50 p-3 sm:max-w-[88%]" role="group" aria-label="Skill map">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tap a skill to see where he used it</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SKILL_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1 text-[11px] text-chikki-purpleLight">{group.title}</div>
            <div className="flex flex-wrap gap-1.5">
              {group.skills.map((skill) => (
                <button key={skill} type="button" disabled={disabled} onClick={() => onAsk(skillQuestion(skill))} className="skill-chip skill-chip-button disabled:opacity-40">
                  {skill}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
