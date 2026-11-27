# Chikki knowledge base

Every `.md` or `.txt` file in this folder (except this README) is indexed for
retrieval. Relevant sections are added to Chikki's prompt when a visitor asks
about them, and they appear as sources in text chat.

## Adding knowledge

- Write one file per project or topic, starting with a `# Title`.
- Use `##` headings for sections. Each section is chunked separately and shown
  as a source label, so name them clearly ("Architecture", "Results").
- Include **only verified, implemented work**. Chikki presents this content as fact.
- Keep employment projects under the correct employer and role.

Remote sources (for example raw GitHub README URLs) can be added with the
`KNOWLEDGE_URLS` environment variable, comma separated.

The index rebuilds automatically when any file changes. No restart is needed.
