import { canonicalizeDomain } from './domain.js';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

export function assertPublicHttpUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported_protocol');
  const host = url.hostname.toLowerCase();
  if (!host || PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))) throw new Error('private_host_blocked');
  canonicalizeDomain(host);
  return url;
}

export async function safeFetchText(input, options = {}) {
  const url = assertPublicHttpUrl(input);
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxBytes = options.maxBytes ?? 1_500_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'user-agent': options.userAgent ?? 'DCL-Revenue-Agent/0.1 (+https://digitalcommercelab.com)',
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    },
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error('unsupported_content_type');

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('response_too_large');
    return { url: response.url || url.toString(), text, status: response.status, headers: response.headers };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('response_too_large');
    }
    chunks.push(value);
  }
  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { url: response.url || url.toString(), text: merged.toString('utf8'), status: response.status, headers: response.headers };
}
