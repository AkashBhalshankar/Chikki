import { useEffect, useState } from "react";
import { fetchGithubActivity } from "../services/api.js";
import { timeAgo } from "../github.js";

// "Latest on GitHub": shows the work is current. Renders nothing when GitHub is not configured.
export default function GithubStrip() {
  const [repos, setRepos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchGithubActivity().then((list) => {
      if (!cancelled) setRepos(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!repos.length) return null;
  return (
    <div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400" aria-label="Latest GitHub activity">
      <span className="uppercase tracking-wider text-gray-500">💻 Latest on GitHub</span>
      {repos.slice(0, 2).map((repo) => (
        <a key={repo.name} href={repo.url} target="_blank" rel="noreferrer" className="hover:text-chikki-purpleLight">
          {repo.name}
          {repo.language ? ` (${repo.language})` : ""} · {timeAgo(repo.pushed_at)}
        </a>
      ))}
    </div>
  );
}
