const MAX_LEN = 200;

function stripMarkdown(s) {
  if (!s) return '';
  return String(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_`>#]+/g, '')
    .replace(/\\([_*`])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanValue(s, max = MAX_LEN) {
  if (!s) return null;
  let v = stripMarkdown(s);
  v = v.replace(/^[\-:•|*\s]+|[\-:•|*\s]+$/g, '');
  if (!v) return null;
  if (v.length > max) {
    const cut = v.slice(0, max);
    const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSentence > max * 0.5) {
      v = cut.slice(0, lastSentence + 1).trim();
    } else if (lastSpace > max * 0.6) {
      v = cut.slice(0, lastSpace).trim() + '…';
    } else {
      v = cut.trim() + '…';
    }
  }
  return v || null;
}

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1] || m[0];
  }
  return null;
}

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_TOKEN = `${MONTHS}\\s+\\d{1,2}(?:[–-]\\d{1,2})?(?:,?\\s*\\d{4})?`;

const IGNORED_EMAIL_DOMAINS = [
  'sentry.io', 'sentry-next.wixpress.com', 'wixpress.com',
  'example.com', 'example.org', 'gravatar.com', 'placeholder.com',
];

function parseDate(str) {
  if (!str) return null;
  const cleaned = str.replace(/[–—]/g, '-');
  const t = Date.parse(cleaned);
  if (!isNaN(t)) return new Date(t);
  const m = cleaned.match(new RegExp(`(${DATE_TOKEN})`, 'i'));
  if (m) {
    const t2 = Date.parse(m[1]);
    if (!isNaN(t2)) return new Date(t2);
  }
  return null;
}

function extractName(text, url) {
  const h1 = text.match(/^#\s+(.+)$/m);
  if (h1) {
    const v = cleanValue(h1[1], 120);
    if (v) return v;
  }
  return null;
}

function extractDates(text) {
  const ranges = [
    new RegExp(`(${DATE_TOKEN}\\s*(?:-|to|through|→)\\s*${DATE_TOKEN})`, 'i'),
    new RegExp(`(${MONTHS}\\s+\\d{1,2}\\s*-\\s*\\d{1,2},?\\s*\\d{4})`, 'i'),
  ];
  const single = [
    new RegExp(`(?:date[s]?|when|event date)[:\\s]+(${DATE_TOKEN})`, 'i'),
    new RegExp(`(${DATE_TOKEN})`, 'i'),
  ];
  const v = firstMatch(text, [...ranges, ...single]);
  return cleanValue(v, 80);
}

function extractLocation(text) {
  if (/\b(online|virtual|remote)\b/i.test(text)) return 'Online';
  const v = firstMatch(text, [
    /(?:location|venue|held in|taking place in)[:\s]+([A-Z][^\n.,]{2,80})/i,
    /\b([A-Z][a-zA-Z]+,\s*[A-Z]{2,3})\b/,
  ]);
  return cleanValue(v, 80);
}

function extractPrizes(text) {
  const v = firstMatch(text, [
    /(\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:USD|in (?:cash|prizes|total)|total|in prize money))?)/i,
    /(?:total prize[s]? pool|prize pool)[:\s]+([^\n]{2,80})/i,
    /(?:prize[s]?|reward[s]?)[:\s]+([^\n]{2,80})/i,
  ]);
  return cleanValue(v, 100);
}

function extractTheme(text) {
  const v = firstMatch(text, [
    /(?:theme|focus area|track[s]?|challenge)[:\s]+([^\n.]{3,120})/i,
  ]);
  return cleanValue(v, 120);
}

function extractDeadline(text) {
  const v = firstMatch(text, [
    new RegExp(`(?:submission deadline|registration deadline|apply by|deadline|closes on|registration closes)[:\\s]+(${DATE_TOKEN})`, 'i'),
    /(?:submission deadline|registration deadline|apply by|deadline)[:\s]+([^\n.]{3,80})/i,
  ]);
  return cleanValue(v, 80);
}

function extractRegistrationUrl(text, pageUrl) {
  const v = firstMatch(text, [
    /\[(?:register|apply|sign up|join|register now|apply now)\]\((https?:\/\/[^)\s]+)\)/i,
    /(https?:\/\/[^\s)]+\/register[^\s)]*)/i,
    /(https?:\/\/[^\s)]+\/apply[^\s)]*)/i,
  ]);
  return v || pageUrl;
}

function extractContactEmail(text) {
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const matches = (text.match(re) || []);
  for (const email of matches) {
    const lower = email.toLowerCase();
    if (IGNORED_EMAIL_DOMAINS.some(d => lower.endsWith(`@${d}`) || lower.includes(`.${d}`))) continue;
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(lower)) continue;
    return email;
  }
  return null;
}

function extractOrganizer(text, hostname) {
  const patterns = [
    /(?:organized|hosted|presented|brought to you) by[:\s]+([A-Z][A-Za-z0-9 &.,'-]{2,80})/i,
    /(?:organizer|host)[:\s]+([A-Z][A-Za-z0-9 &.,'-]{2,80})/i,
  ];
  const v = firstMatch(text, patterns);
  const cleaned = cleanValue(v, 80);
  if (cleaned) return cleaned.replace(/[.,]+$/, '');
  if (hostname) {
    const base = hostname.replace(/^www\./, '').split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return null;
}

function buildOutreachMessage(name, organizer) {
  const greeting = organizer ? `Hi ${organizer} team,` : `Hi there,`;
  const eventLine = name ? `I came across ${name} and wanted to reach out.` : `I wanted to reach out about your upcoming hackathon.`;

  return [
    greeting,
    '',
    eventLine,
    '',
    'I work on WozCode — a plugin that runs on top of any IDE using Claude Code. It helps developers cut token costs, avoid rate limits, and ship code faster, which can be a real edge during a time-boxed hackathon.',
    '',
    'Would love to explore offering it to your participants. Happy to share more details if useful.',
    '',
    'Best,',
    'Vikas',
    'WozCode',
  ].join('\n');
}

function isUpcoming(parsed) {
  const candidates = [parsed.dates, parsed.deadline].filter(Boolean);
  if (candidates.length === 0) return true;
  const now = new Date();
  for (const c of candidates) {
    const d = parseDate(c);
    if (d && d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return true;
    }
  }
  for (const c of candidates) {
    const d = parseDate(c);
    if (d && d < new Date(now.getFullYear(), now.getMonth() - 1, 1)) {
      return false;
    }
  }
  return true;
}

function isJunk(parsed) {
  if (!parsed.name) return true;
  // Drop bare domain names like "maven.com", "dev.to", "devpost.com"
  if (/^[a-z0-9-]+\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(parsed.name.trim())) return true;
  if (parsed.name.trim().length < 5) return true;
  return false;
}

export function parseHackathons(scrapedPages) {
  const all = scrapedPages.map(({ url, markdown }) => {
    const text = markdown || '';
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch {}

    const name = extractName(text, url);
    const organizer = extractOrganizer(text, hostname);

    return {
      url,
      name,
      dates: extractDates(text),
      location: extractLocation(text),
      prizes: extractPrizes(text),
      theme: extractTheme(text),
      deadline: extractDeadline(text),
      registration_url: extractRegistrationUrl(text, url),
      organizer,
      contact_email: extractContactEmail(text),
      outreach_message: buildOutreachMessage(name, organizer),
    };
  });

  return all.filter(p => isUpcoming(p) && !isJunk(p));
}
