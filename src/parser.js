export function parseHackathons(scrapedPages) {
  return scrapedPages.map(({ url, markdown }) => {
    const text = markdown || '';

    const name = extractName(text, url);
    const dates = extractDates(text);
    const location = extractLocation(text);
    const prizes = extractPrizes(text);
    const theme = extractTheme(text);
    const deadline = extractDeadline(text);
    const registration_url = extractRegistrationUrl(text, url);

    return { url, name, dates, location, prizes, theme, deadline, registration_url };
  });
}

function extractName(text, url) {
  const h1 = text.match(/^#\s+(.+)/m);
  if (h1) return h1[1].trim();

  const titleTag = text.match(/title[:\s]+([^\n]+)/i);
  if (titleTag) return titleTag[1].trim();

  try {
    const host = new URL(url).hostname.replace('www.', '');
    return host;
  } catch {
    return null;
  }
}

function extractDates(text) {
  const patterns = [
    /(\w+ \d{1,2}(?:–|-)\d{1,2},?\s*\d{4})/i,
    /(\w+ \d{1,2},?\s*\d{4}\s*(?:–|-|to)\s*\w* \d{1,2},?\s*\d{4})/i,
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\s*(?:–|-|to)\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /date[s]?[:\s]+([^\n]+)/i,
    /when[:\s]+([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractLocation(text) {
  if (/\bonline\b|\bvirtual\b|\bremote\b/i.test(text)) return 'Online';

  const patterns = [
    /location[:\s]+([^\n]+)/i,
    /venue[:\s]+([^\n]+)/i,
    /held (?:at|in)[:\s]+([^\n]+)/i,
    /taking place (?:at|in)[:\s]+([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractPrizes(text) {
  const patterns = [
    /prize[s]?[:\s]+([^\n]+)/i,
    /reward[s]?[:\s]+([^\n]+)/i,
    /award[s]?[:\s]+([^\n]+)/i,
    /\$[\d,]+(?:\s*(?:USD|total|in prizes))?/i,
    /total prize[:\s]+([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return (m[1] || m[0]).trim();
  }
  return null;
}

function extractTheme(text) {
  const patterns = [
    /theme[:\s]+([^\n]+)/i,
    /focus[:\s]+([^\n]+)/i,
    /track[s]?[:\s]+([^\n]+)/i,
    /challenge[:\s]+([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractDeadline(text) {
  const patterns = [
    /(?:submission|registration|apply by|deadline)[:\s]+([^\n]+)/i,
    /(?:applications? (?:close|due|end))[:\s]*([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractRegistrationUrl(text, pageUrl) {
  const patterns = [
    /(?:register|apply|sign up|join)[^\n]*\((https?:\/\/[^\)]+)\)/i,
    /(?:register|apply|sign up|join)[^\n]*(https?:\/\/\S+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return pageUrl;
}
