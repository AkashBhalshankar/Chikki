import { useEffect } from "react";
import { PROJECTS } from "../projects.js";

export function ProjectCard({ project, compact = false }) {
  return (
    <div className="project-card rounded-xl border border-gray-800 bg-zinc-900/40 p-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-sm font-semibold text-gray-100">{project.name}</h3>
        <span className="text-[11px] text-chikki-purpleLight">{project.kind}</span>
      </div>
      {!compact && <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{project.summary}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {project.stack.map((item) => (
          <span key={item} className="rounded border border-gray-700 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-gray-300">{item}</span>
        ))}
      </div>
      {!compact && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-gray-400">
          {project.highlights.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProjectsModal({ isOpen, onClose, githubUrl = "" }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="projects-title">
      <div className="max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl chikki-scroll">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="projects-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">AKASH&apos;S PROJECTS</h2>
            <p className="mt-1 text-[11px] text-gray-400">Taken from his resume. Ask Chikki about any of them for more detail.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700">✕</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROJECTS.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
        {githubUrl && (
          <a href={githubUrl} target="_blank" rel="noreferrer" className="action-button mt-4 inline-flex text-xs">
            💻 See the code on GitHub
          </a>
        )}
      </div>
    </div>
  );
}
