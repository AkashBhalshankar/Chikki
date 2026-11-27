import { useEffect, useState } from "react";
import { PROJECTS } from "../projects.js";

export function ProjectCard({ project, compact = false }) {
  const [peeking, setPeeking] = useState(false);
  return (
    <div className="project-card rounded-xl border border-gray-800 bg-zinc-900/40 p-3.5">
      {project.image && (
        <img
          src={project.image}
          alt={`Screenshot of ${project.name}`}
          loading="lazy"
          className={`mb-2.5 w-full rounded-lg border border-gray-800 object-cover object-top ${compact ? "h-24" : "h-32"}`}
        />
      )}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-sm font-semibold text-gray-100">{project.name}</h3>
        <span className="text-[11px] text-chikki-purpleLight">{project.kind}</span>
        {project.url && <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-[10px] text-emerald-300">Live</span>}
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
      {project.peek && peeking && (
        <iframe
          src={project.url}
          title={`Live preview of ${project.name}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          className="mt-2.5 h-64 w-full rounded-lg border border-gray-800 bg-black"
        />
      )}
      {project.url && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {project.peek && (
            <button type="button" onClick={() => setPeeking((value) => !value)} className="action-button !min-h-0 px-3 py-1 text-[11px]" aria-expanded={peeking}>
              {peeking ? "Hide preview" : "👀 Peek inside"}
            </button>
          )}
          <a href={project.url} target="_blank" rel="noopener noreferrer" className="action-button !min-h-0 inline-flex px-3 py-1 text-[11px]">
            {project.urlLabel || "Open"} ↗
          </a>
        </div>
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
