const MULTI_LEVEL_SUFFIXES = new Set([
  'co.uk','com.au','co.nz','com.br','com.mx','co.jp','co.in','com.sg','com.hk','ca.us'
]);

export function canonicalizeDomain(input) {
  if (!input || typeof input !== 'string') throw new Error('invalid_domain');
  let value = input.trim().toLowerCase();
  if (!/^https?:\/\//.test(value)) value = `https://${value}`;
  let url;
  try { url = new URL(value); } catch { throw new Error('invalid_domain'); }
  return url.hostname.replace(/^www\./, '').replace(/\.$/, '');
}

export function registrableDomain(input) {
  const host = canonicalizeDomain(input);
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost') return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tail2 = parts.slice(-2).join('.');
  if (MULTI_LEVEL_SUFFIXES.has(tail2) && parts.length >= 3) return parts.slice(-3).join('.');
  return tail2;
}

export function sameAccountDomain(a, b) {
  return registrableDomain(a) === registrableDomain(b);
}
