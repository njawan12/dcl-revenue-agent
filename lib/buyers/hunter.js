import { registrableDomain } from '../discovery/domain.js';

function hunterHeaders(apiKey) {
  return { 'X-API-KEY': apiKey, Accept: 'application/json' };
}

export function normalizeHunterDomainResult(item, domain) {
  return {
    provider: 'hunter',
    providerPersonId: item?.value || null,
    firstName: item?.first_name || null,
    lastName: item?.last_name || null,
    fullName: [item?.first_name, item?.last_name].filter(Boolean).join(' ') || null,
    title: item?.position || item?.position_raw || null,
    seniority: item?.seniority ? String(item.seniority).replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    departments: item?.department ? [item.department] : [],
    linkedinUrl: item?.linkedin || item?.linkedin_url || null,
    companyName: null,
    companyDomain: domain,
    companyWebsite: `https://${domain}`,
    sourceConfidence: Math.max(0, Math.min(1, Number(item?.confidence ?? 80) / 100)),
    email: item?.value || null,
    emailVerified: item?.verification?.status === 'valid',
    verificationStatus: item?.verification?.status || null,
    emailConfidence: Math.max(0, Math.min(1, Number(item?.confidence ?? 0) / 100)),
    verificationSource: 'hunter-domain-search',
    metadata: { sources: item?.sources || [], type: item?.type || null },
  };
}

export async function searchHunterDomain({ apiKey, accountDomain, limit = 20, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('hunter_api_key_required');
  const domain = registrableDomain(accountDomain);
  const url = new URL('https://api.hunter.io/v2/domain-search');
  url.searchParams.set('domain', domain);
  url.searchParams.set('limit', String(Math.max(1, Math.min(100, limit))));
  url.searchParams.set('type', 'personal');
  url.searchParams.set('required_field', 'full_name,position');
  const response = await fetchImpl(url, { headers: hunterHeaders(apiKey) });
  if (!response.ok) throw new Error(`hunter_domain_http_${response.status}`);
  const payload = await response.json();
  const emails = payload?.data?.emails || [];
  return {
    candidates: emails.map((item) => normalizeHunterDomainResult(item, domain)),
    usage: { provider:'hunter', action:'domain_search', units: emails.length ? Math.ceil(emails.length / 10) : 0, metadata:{ resultCount: emails.length } },
  };
}

export async function findHunterEmail({ apiKey, accountDomain, firstName, lastName, fullName, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('hunter_api_key_required');
  const domain = registrableDomain(accountDomain);
  const url = new URL('https://api.hunter.io/v2/email-finder');
  url.searchParams.set('domain', domain);
  if (firstName && lastName) {
    url.searchParams.set('first_name', firstName);
    url.searchParams.set('last_name', lastName);
  } else if (fullName) {
    url.searchParams.set('full_name', fullName);
  } else {
    return { contact:null, usage:{ provider:'hunter', action:'email_finder', units:0 } };
  }
  const response = await fetchImpl(url, { headers: hunterHeaders(apiKey) });
  if (!response.ok) {
    if (response.status === 404) return { contact:null, usage:{ provider:'hunter', action:'email_finder', units:0 } };
    throw new Error(`hunter_finder_http_${response.status}`);
  }
  const payload = await response.json();
  const data = payload?.data || {};
  if (!data.email) return { contact:null, usage:{ provider:'hunter', action:'email_finder', units:0 } };
  const status = data.verification?.status || null;
  const verified = status === 'valid';
  return {
    contact: {
      provider:'hunter',
      providerPersonId: data.email,
      firstName:data.first_name || firstName || null,
      lastName:data.last_name || lastName || null,
      fullName:[data.first_name || firstName, data.last_name || lastName].filter(Boolean).join(' ') || fullName || null,
      title:data.position || null,
      linkedinUrl:data.linkedin_url || null,
      companyName:data.company || null,
      companyDomain:domain,
      companyWebsite:`https://${domain}`,
      email:data.email,
      emailVerified:verified,
      verificationStatus:status,
      emailConfidence:Math.max(0, Math.min(1, Number(data.score ?? 0) / 100)),
      verificationSource:'hunter-email-finder',
      sourceConfidence:Math.max(0, Math.min(1, Number(data.score ?? 80) / 100)),
      metadata:{ sources:data.sources || [], acceptAll:Boolean(data.accept_all) },
    },
    usage:{ provider:'hunter', action:'email_finder', units:1, metadata:{ verificationStatus:status } },
  };
}

export async function verifyHunterEmail({ apiKey, email, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('hunter_api_key_required');
  if (!email) return { verified:false, status:null, confidence:0, usage:{ provider:'hunter', action:'email_verifier', units:0 } };
  const url = new URL('https://api.hunter.io/v2/email-verifier');
  url.searchParams.set('email', email);
  const response = await fetchImpl(url, { headers: hunterHeaders(apiKey) });
  if (response.status === 202) return { verified:false, status:'pending', confidence:0, usage:{ provider:'hunter', action:'email_verifier', units:0.5 } };
  if (!response.ok) throw new Error(`hunter_verify_http_${response.status}`);
  const data = (await response.json())?.data || {};
  return {
    verified:data.status === 'valid',
    status:data.status || null,
    confidence:Math.max(0, Math.min(1, Number(data.score ?? 0) / 100)),
    metadata:{ disposable:Boolean(data.disposable), webmail:Boolean(data.webmail), acceptAll:Boolean(data.accept_all) },
    usage:{ provider:'hunter', action:'email_verifier', units:0.5, metadata:{ status:data.status || null } },
  };
}
