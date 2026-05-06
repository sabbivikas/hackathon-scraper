import FirecrawlApp from '@mendable/firecrawl-js';

export async function scrapeUrls(urls) {
  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const results = [];

  for (const url of urls) {
    try {
      const response = await firecrawl.scrapeUrl(url, {
        formats: ['markdown'],
      });
      if (response.success) {
        results.push({ url, markdown: response.markdown });
      }
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err.message);
    }
  }

  return results;
}
