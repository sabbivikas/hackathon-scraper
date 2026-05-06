import Exa from 'exa-js';

const QUERIES = [
  'hackathon Claude Code 2026',
  'hackathon Cursor AI 2026',
  'hackathon Codex developer 2026',
  'devpost AI hackathon 2026',
];

export async function searchHackathons() {
  const exa = new Exa(process.env.EXASEARCH_API_KEY);
  const urls = new Set();

  for (const query of QUERIES) {
    const result = await exa.search(query, {
      numResults: 10,
      type: 'neural',
    });
    for (const item of result.results) {
      urls.add(item.url);
    }
  }

  return [...urls];
}
