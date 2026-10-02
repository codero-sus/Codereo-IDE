const WIKIPEDIA_ORIGIN = 'https://en.wikipedia.org';
const SEARCH_URL = `${WIKIPEDIA_ORIGIN}/w/api.php`;
const SUMMARY_URL = `${WIKIPEDIA_ORIGIN}/api/rest_v1/page/summary/`;
const MAX_RESPONSE_BYTES = 1_000_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function getJson(input) {
  const initialUrl = new URL(input);
  if (initialUrl.origin !== WIKIPEDIA_ORIGIN) throw new Error('Research requests are limited to Wikipedia.');
  const signal = AbortSignal.timeout(8_000);
  const options = {
    headers: { Accept: 'application/json', 'User-Agent': 'Codereo-IDE/0.1 (local research)' },
    signal,
    redirect: 'manual',
  };
  let currentUrl = initialUrl;
  let response = await fetch(currentUrl, options);
  if (REDIRECT_STATUSES.has(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Wikipedia returned a redirect without a destination.');
    const redirectedUrl = new URL(location, currentUrl);
    if (redirectedUrl.protocol !== 'https:' || redirectedUrl.origin !== WIKIPEDIA_ORIGIN) {
      throw new Error('Research redirect left the Wikipedia domain.');
    }
    currentUrl = redirectedUrl;
    response = await fetch(currentUrl, { ...options, redirect: 'error' });
  }
  const finalUrl = response.url ? new URL(response.url) : currentUrl;
  if (finalUrl.origin !== WIKIPEDIA_ORIGIN) throw new Error('Research redirect left the Wikipedia domain.');
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}.`);

  const announcedLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(announcedLength) && announcedLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Wikipedia response exceeded the size limit.');
  }
  if (!response.body) throw new Error('Wikipedia returned an empty response.');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Wikipedia response exceeded the size limit.');
    }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
}

function safePageUrl(candidate, title) {
  try {
    const url = new URL(candidate);
    if (url.origin === WIKIPEDIA_ORIGIN && url.pathname.startsWith('/wiki/')) return url.href;
  } catch {
    // Fall back to the canonical page URL constructed from the returned title.
  }
  return `${WIKIPEDIA_ORIGIN}/wiki/${encodeURIComponent(String(title).replaceAll(' ', '_'))}`;
}

export async function researchWikipedia(query) {
  const topic = typeof query === 'string' ? query.trim().slice(0, 180) : '';
  if (topic.length < 2) throw new Error('Enter a topic with at least two characters.');
  const search = new URL(SEARCH_URL);
  search.search = new URLSearchParams({ action: 'opensearch', search: topic, limit: '4', namespace: '0', format: 'json' }).toString();
  const results = await getJson(search);
  const titles = Array.isArray(results?.[1]) ? results[1].slice(0, 4) : [];
  const descriptions = Array.isArray(results?.[2]) ? results[2] : [];
  const pages = await Promise.all(titles.map(async (title, index) => {
    const url = new URL(encodeURIComponent(String(title).replaceAll(' ', '_')), SUMMARY_URL);
    try {
      const data = await getJson(url);
      const extract = typeof data.extract === 'string' ? data.extract.trim().slice(0, 3_500) : '';
      if (!extract) return null;
      return {
        title: String(data.title || title).slice(0, 160),
        description: String(data.description || descriptions[index] || '').slice(0, 300),
        extract,
        url: safePageUrl(data.content_urls?.desktop?.page, data.title || title),
      };
    } catch {
      return null;
    }
  }));
  return { query: topic, sources: pages.filter(Boolean) };
}
