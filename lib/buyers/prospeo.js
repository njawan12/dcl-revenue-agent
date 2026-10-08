import { registrableDomain } from '../discovery/domain.js';

function titleBooleanSearch(suggestedBuyerRole = '') {
  const value = String(suggestedBuyerRole).toLowerCase();
  if (/retention|lifecycle/.test(value)) return "(retention OR lifecycle OR CRM OR email OR SMS OR ecommerce OR 'e-commerce')";
  if (/engineering|technical|developer/.test(value)) return "(ecommerce OR 'e-commerce' OR Shopify OR digital OR engineering OR technical OR CTO)";
  return "(ecommerce OR 'e-commerce' OR commerce OR digital OR growth OR founder OR CEO)";
}

function currentJob(person = {}) {
  return (person.job_history || []).find((job) => job?.current) || {};
}

export function normalizeProspeoSearchResult(result, expectedDomain) {
  const person = result?.person || {};
  const company = result?.company || {};
  const job = currentJob(person);
  let expected = expectedDomain;
  try { expected = registrableDomain(expectedDomain); } catch {}

  return {
    provider: 'prospeo',
    providerPersonId: person.person_id || null,
    firstName: person.first_name || null,
    lastName: person.last_name || null,
    fullName: person.full_name || [person.first_name, person.last_name].filter(Boolean).join(' ') || null,
    title: person.current_job_title || job.title || null,
    seniority: job.seniority || null,
    departments: Array.isArray(job.departments) ? job.departments : [],
    linkedinUrl: person.linkedin_url || null,
    companyName: company.name || job.company_name || null,
    companyDomain: company.domain || expected,
    companyWebsite: company.website || null,
    sourceConfidence: company.domain || company.website ? 0.95 : 0.75,
    emailAvailabilityStatus: person.email?.status || null,
    metadata: { companyId: company.company_id || job.company_id || null },
  };
}

export async function searchProspeoBuyers({ apiKey, accountDomain, suggestedBuyerRole, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('prospeo_api_key_required');
  const domain = registrableDomain(accountDomain);
  const response = await fetchImpl('https://api.prospeo.io/search-person', {
    method: 'POST',
    headers: { 'X-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: 1,
      filters: {
        company: { websites: { include: [domain], exclude: [] } },
        person_job_title: { boolean_search: titleBooleanSearch(suggestedBuyerRole) },
        person_seniority: { include: ['C-Suite','Vice President','Head','Director','Founder/Owner','Manager'] },
        max_person_per_company: 15,
      },
    }),
  });
  if (!response.ok) throw new Error(`prospeo_search_http_${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`prospeo_search_${payload.error_code || 'error'}`);
  return {
    candidates: (payload?.results || []).map((result) => normalizeProspeoSearchResult(result, domain)),
    usage: { provider: 'prospeo', action: 'search_person', units: payload?.results?.length ? 1 : 0, metadata: { free: Boolean(payload?.free) } },
  };
}

export async function enrichProspeoPerson({ apiKey, personId, accountDomain, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('prospeo_api_key_required');
  if (!personId) return { contact: null, usage: { provider:'prospeo', action:'enrich_person', units:0 } };
  const domain = registrableDomain(accountDomain);
  const response = await fetchImpl('https://api.prospeo.io/enrich-person', {
    method: 'POST',
    headers: { 'X-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ only_verified_email: true, data: { person_id: personId } }),
  });
  if (!response.ok) throw new Error(`prospeo_enrich_http_${response.status}`);
  const payload = await response.json();
  if (payload?.error) return { contact: null, usage: { provider:'prospeo', action:'enrich_person', units:0, metadata:{ errorCode: payload.error_code || null } } };

  const person = payload?.person || {};
  const company = payload?.company || {};
  const email = person.email || {};
  let companyMatch = false;
  try {
    companyMatch = [company.domain, company.website].filter(Boolean).some((value) => registrableDomain(value) === domain);
  } catch {}
  const revealedEmail = email.status === 'VERIFIED' && email.revealed === true && typeof email.email === 'string' && email.email.includes('@') ? email.email : null;

  return {
    contact: revealedEmail && companyMatch ? {
      provider: 'prospeo',
      providerPersonId: person.person_id || personId,
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      fullName: person.full_name || null,
      title: person.current_job_title || null,
      linkedinUrl: person.linkedin_url || null,
      companyName: company.name || null,
      companyDomain: company.domain || domain,
      companyWebsite: company.website || null,
      email: revealedEmail,
      emailVerified: true,
      verificationStatus: 'verified',
      emailConfidence: 1,
      verificationSource: 'prospeo',
      sourceConfidence: 0.98,
      metadata: { verificationMethod: email.verification_method || null, mxProvider: email.email_mx_provider || null },
    } : null,
    usage: { provider:'prospeo', action:'enrich_person', units: revealedEmail ? 1 : 0, metadata:{ free: Boolean(payload?.free_enrichment) } },
  };
}
