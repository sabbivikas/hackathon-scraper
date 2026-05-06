import Exa from 'exa-js';

const QUERIES = [
  'upcoming hackathon Claude Code 2026',
  'upcoming hackathon Cursor AI 2026',
  'upcoming hackathon Codex developer 2026',
  'upcoming devpost AI hackathon 2026',
];

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function searchHackathons() {
  const exa = new Exa(process.env.EXASEARCH_API_KEY);
  const urls = new Set();

  for (const query of QUERIES) {
    const result = await exa.search(query, {
      numResults: 10,
      type: 'neural',
      startPublishedDate: daysAgo(90),
    });
    for (const item of result.results) {
      urls.add(item.url);
    }
  }

  return [...urls];
}
