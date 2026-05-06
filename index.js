import 'dotenv/config';
import { writeFileSync } from 'fs';
import { searchHackathons } from './src/exa.js';
import { scrapeUrls } from './src/firecrawl.js';
import { parseHackathons } from './src/parser.js';
import { pushToSheet } from './src/sheets.js';

const CSV_PATH = './hackathons.csv';
const FIELDS = [
  'name', 'dates', 'location', 'prizes', 'theme', 'deadline',
  'registration_url', 'url', 'organizer', 'contact_email', 'outreach_message',
];

function toCsv(hackathons) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = FIELDS.join(',');
  const rows = hackathons.map(h => FIELDS.map(f => escape(h[f])).join(','));
  return [header, ...rows].join('\n');
}

async function main() {
  console.log('🔍 Searching for hackathons...');
  const urls = await searchHackathons();
  console.log(`Found ${urls.length} URLs`);

  console.log('🕷️  Scraping pages...');
  const scraped = await scrapeUrls(urls);
  console.log(`Scraped ${scraped.length} pages`);

  console.log('📋 Parsing hackathon details...');
  const hackathons = parseHackathons(scraped);

  const csv = toCsv(hackathons);
  writeFileSync(CSV_PATH, csv, 'utf8');
  console.log(`✅ Saved ${hackathons.length} hackathons to ${CSV_PATH}`);

  console.log('📊 Pushing to Google Sheets...');
  const { rowsWritten } = await pushToSheet(hackathons);
  console.log(`✅ Wrote ${rowsWritten} rows to Google Sheet`);
}

main().catch(console.error);
