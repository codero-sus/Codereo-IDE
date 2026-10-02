import test from 'node:test';
import assert from 'node:assert/strict';
import { researchWikipedia } from '../../server/research.mjs';

function jsonResponse(url, value) {
  const response = new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

test('research searches Wikipedia and returns bounded, linked summaries', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    requested.push({ url, options });
    if (url.pathname.endsWith('/w/api.php')) return jsonResponse(url.href, ['topic', ['Example'], ['A short description'], ['https://en.wikipedia.org/wiki/Example']]);
    return jsonResponse(url.href, { title: 'Example', description: 'A short description', extract: 'A sourced paragraph.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Example' } } });
  };
  try {
    const result = await researchWikipedia('safe topic & no custom URL');
    assert.equal(result.sources[0].title, 'Example');
    assert.equal(result.sources[0].url, 'https://en.wikipedia.org/wiki/Example');
    assert.equal(requested.length, 2);
    assert.ok(requested.every(({ url, options }) => url.hostname === 'en.wikipedia.org' && options.redirect === 'manual'));
  } finally { globalThis.fetch = originalFetch; }
});

test('research rejects short queries without making a network request', async () => {
  await assert.rejects(researchWikipedia(' '), /at least two characters/);
});

test('research rejects redirects to non-Wikipedia hosts before following them', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input, options) => {
    requested.push({ url: new URL(input), options });
    return new Response('', { status: 302, headers: { location: 'http://127.0.0.1:11434/v1/private' } });
  };
  try {
    await assert.rejects(researchWikipedia('local model'), /redirect left the Wikipedia domain/);
    assert.equal(requested.length, 1);
    assert.equal(requested[0].options.redirect, 'manual');
  } finally { globalThis.fetch = originalFetch; }
});
