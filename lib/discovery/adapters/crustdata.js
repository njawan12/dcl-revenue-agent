import { defineDiscoverySource } from '../sources.js';
import { countrySearchValues, isExcludedIndustry, normalizeOfferProfile } from '../../offers/profiles.js';
import { registrableDomain } from '../domain.js';
import { createGreenhouseSource, greenhouseBoardTokenFromUrl } from './greenhouse.js';
import { createLeverSource, leverSiteFromUrl } from './lever.js';

const API_BASE = 'https://api.crustdata.com';
const API_VERSION = '2025-11-01';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractCredits(response) {
  return toNumber(response?.headers?.get?.('x-credits-used'), 0);
}

async function request({ apiKey, path, method = 'GET', body, fetchImpl = fetch }) {
  if (!apiKey) throw Object.assign(new Error('crustdata_api_key_required'), { code: 'provider_not_configured' });
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'x-api-version': API_VERSION,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const creditsUsed = extractCredits(response);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.error || `crustdata_http_${response.status}`;
    const error = Object.assign(new Error(String(message)), { status: response.status, creditsUsed, provider: 'crustdata' });
    throw error;
  }
  return { data, creditsUsed, status: response.status };
}

export async function getCrustdataEndpoint({ apiKey, endpointPath, fetchImpl = fetch }) {
  const query = new URLSearchParams({ path: endpointPath });
  const result = await request({ apiKey, path: `/account/endpoints?${query}`, fetchImpl });
  return { endpoint: result.data?.endpoints?.[0] ?? null, creditsUsed: result.creditsUsed };
}

export async function getCrustdataCapabilities({ apiKey, fetchImpl = fetch }) {
  const paths = ['/job/search','/person/search','/person/contact/enrich'];
  const entries = [];
  for (const endpointPath of paths) {
    const { endpoint } = await getCrustdataEndpoint({ apiKey, endpointPath, fetchImpl });
    entries.push(endpoint ?? { path: endpointPath, status: 'missing' });
  }
  return {
    apiVersion: API_VERSION,
    endpoints: entries,
    contactEnrichEnabled: entries.find((entry) => entry.path === '/person/contact/enrich')?.status === 'enabled',
  };
}

export async function getCrustdataCredits({ apiKey, fetchImpl = fetch }) {
  const result = await request({ apiKey, path: '/account/credits', fetchImpl });
  return { account: result.data?.account ?? null, creditsUsed: result.creditsUsed };
}

function isoDateDaysAgo(days) {
  const date = new Date(Date.now() - Math.max(1, days) * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function jobFilters(profile) {
  const conditions = [
    { field: 'metadata.date_added', type: '=>', value: isoDateDaysAgo(profile.lookbackDays) },
    { field: 'location.country', type: 'in', value: countrySearchValues(profile) },
    { op: 'or', conditions: profile.targetJobTitles.map((title) => ({ field: 'job_details.title', type: '[.]', value: title })) },
  ];
  if (profile.employeeMin) conditions.push({ field: 'company.headcount.total', type: '=>', value: profile.employeeMin });
  if (profile.employeeMax) conditions.push({ field: 'company.headcount.total', type: '=<', value: profile.employeeMax });
  return { op: 'and', conditions };
}

function companyIndustry(job) {
  const industries = Array.isArray(job?.company?.basic_info?.industries) ? job.company.basic_info.industries : [];
  return industries.find(Boolean) ?? null;
}

function normalizeJob(job, profile) {
  const basic = job?.company?.basic_info ?? {};
  const domain = basic.primary_domain ? registrableDomain(basic.primary_domain) : null;
  if (!domain) return null;
  const industry = companyIndustry(job);
  if (isExcludedIndustry(industry, profile)) return null;
  const title = String(job?.job_details?.title ?? '').trim();
  const jobUrl = job?.job_details?.url;
  const postedAt = job?.metadata?.date_added ?? new Date().toISOString();
  if (!title || !jobUrl) return null;
  const evidence = {
    hiringPrimary: true,
    crustdataJobId: job.crustdata_job_id ?? job?.job_details?.job_id ?? null,
    crustdataCompanyId: basic.crustdata_company_id ?? null,
    jobTitle: title,
    jobUrl,
    postedAt,
    jobSource: job?.job_details?.source ?? null,
    employmentType: job?.job_details?.employment_type ?? null,
    workplaceType: job?.job_details?.workplace_type ?? null,
    location: job?.location ?? null,
    industries: basic.industries ?? [],
    employeeCount: job?.company?.headcount?.total ?? null,
    descriptionExcerpt: String(job?.content?.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200),
  };
  const account = {
    domain,
    name: basic.name || domain,
    url: basic.website || `https://${domain}`,
    country: job?.company?.locations?.country ?? job?.location?.country ?? null,
    industry,
    employeeCount: job?.company?.headcount?.total ?? null,
    sourceName: 'crustdata-job-search',
    sourceUrl: jobUrl,
    discoveredAt: postedAt,
    evidence: {
      crustdataCompanyId: basic.crustdata_company_id ?? null,
      industries: basic.industries ?? [],
      hiringTrigger: evidence,
      estimatedAgencyCapacity: Number(job?.company?.headcount?.total ?? 0) >= (profile.employeeMin ?? 1),
    },
  };
  const signal = {
    accountDomain: domain,
    type: 'job',
    title,
    sourceUrl: jobUrl,
    sourceName: 'crustdata-job-search',
    observedAt: postedAt,
    confidence: 1,
    evidence,
    fingerprint: `crustdata-job:${job.crustdata_job_id ?? `${domain}:${jobUrl}`}`,
  };
  return { account, signal };
}

async function verifyPublicJobBoards(items, profile, fetchImpl) {
  const signals = [];
  const errors = [];
  const seen = new Set();
  for (const item of items.slice(0, 25)) {
    const url = item.signal.sourceUrl;
    const greenhouseToken = greenhouseBoardTokenFromUrl(url);
    const leverSite = leverSiteFromUrl(url);
    const providerKey = greenhouseToken ? `greenhouse:${greenhouseToken}` : leverSite ? `lever:${leverSite}` : null;
    if (!providerKey || seen.has(`${providerKey}:${item.account.domain}`)) continue;
    seen.add(`${providerKey}:${item.account.domain}`);
    try {
      const source = greenhouseToken
        ? createGreenhouseSource({ boardToken: greenhouseToken, accountDomain: item.account.domain, accountName: item.account.name, profile, fetchImpl })
        : createLeverSource({ site: leverSite, accountDomain: item.account.domain, accountName: item.account.name, profile, fetchImpl });
      const result = await source.discover();
      for (const signal of result?.signals ?? []) {
        if (String(signal.title).trim().toLowerCase() !== String(item.signal.title).trim().toLowerCase()) continue;
        signals.push({
          ...signal,
          type: 'job_verification',
          title: `${signal.title} · public board verified`,
          evidence: {
            ...(signal.evidence ?? {}),
            corroboratesCrustdata: true,
            primaryFingerprint: item.signal.fingerprint,
            primarySourceUrl: item.signal.sourceUrl,
          },
          fingerprint: `job-verification:${signal.fingerprint}`,
        });
      }
    } catch (error) {
      errors.push({ source: providerKey, accountDomain: item.account.domain, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { signals, errors };
}

export async function searchCrustdataJobs({ apiKey, profile: rawProfile, limit = 25, fetchImpl = fetch }) {
  const profile = normalizeOfferProfile(rawProfile);
  const hardLimit = Math.min(25, Math.max(1, Number(limit) || profile.caps.jobsPerRun), profile.caps.jobsPerRun);
  const body = {
    filters: jobFilters(profile),
    fields: [
      'crustdata_job_id','job_details.title','job_details.url','job_details.source','job_details.employment_type','job_details.workplace_type',
      'company.basic_info.crustdata_company_id','company.basic_info.name','company.basic_info.primary_domain','company.basic_info.website','company.basic_info.industries',
      'company.headcount.total','company.locations.country','location.raw','location.country','location.state','location.city','content.description','metadata.date_added',
    ],
    sorts: [{ field: 'metadata.date_added', order: 'desc' }],
    limit: hardLimit,
  };
  const result = await request({ apiKey, path: '/job/search', method: 'POST', body, fetchImpl });
  const rows = Array.isArray(result.data?.job_listings) ? result.data.job_listings : [];
  const normalized = rows.map((job) => normalizeJob(job, profile)).filter(Boolean);
  const excludedCount = rows.length - normalized.length;
  const verification = await verifyPublicJobBoards(normalized, profile, fetchImpl);
  return {
    accounts: normalized.map((item) => item.account),
    signals: [...normalized.map((item) => item.signal), ...verification.signals],
    rawCount: rows.length,
    excludedCount,
    creditsUsed: result.creditsUsed,
    estimatedCredits: rows.length * 0.03,
    nextCursor: result.data?.next_cursor ?? null,
    totalCount: result.data?.total_count ?? null,
    publicBoardVerificationCount: verification.signals.length,
    publicBoardVerificationErrors: verification.errors,
  };
}

export function createCrustdataHiringSource({ apiKey, profile, limit = 25, fetchImpl = fetch }) {
  return defineDiscoverySource({
    name: 'crustdata-job-search',
    async discover() {
      const result = await searchCrustdataJobs({ apiKey, profile, limit, fetchImpl });
      return { accounts: result.accounts, signals: result.signals, usage: result };
    },
  });
}

function roleVariants(role) {
  const value = String(role ?? '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return [];
  const parts = value.split(/\s*\/\s*|\s+or\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [value];
  const suffix = parts.at(-1)?.split(/\s+/).slice(1).join(' ') ?? '';
  const expanded = parts.map((part, index) => {
    if (index === parts.length - 1 || !suffix) return part;
    return /ecommerce|digital|engineering|retention|lifecycle/i.test(part) ? part : `${part} ${suffix}`;
  });
  return [...new Set(expanded)];
}

function buyerTitleConditions(profile) {
  const values = [...new Set((profile.buyerRoles ?? []).flatMap(roleVariants))];
  return values.map((title) => ({ field: 'experience.employment_details.current.title', type: '(.)', value: title }));
}

function currentRole(profile) {
  const current = profile?.experience?.employment_details?.current;
  return Array.isArray(current) ? current[0] ?? {} : (current ?? {});
}

function normalizePerson(person, accountDomain) {
  const current = currentRole(person);
  const profileUrl = person?.social_handles?.professional_network_identifier?.profile_url ?? null;
  return {
    provider: 'crustdata',
    providerPersonId: person?.crustdata_person_id != null ? String(person.crustdata_person_id) : profileUrl,
    fullName: person?.basic_profile?.name ?? null,
    firstName: String(person?.basic_profile?.name ?? '').trim().split(/\s+/)[0] || null,
    lastName: String(person?.basic_profile?.name ?? '').trim().split(/\s+/).slice(1).join(' ') || null,
    title: current?.title ?? person?.basic_profile?.current_title ?? null,
    seniority: current?.seniority_level ?? person?.basic_profile?.normalized_title?.seniority_level ?? null,
    departments: [person?.basic_profile?.normalized_title?.department, person?.basic_profile?.normalized_title?.sub_department].filter(Boolean),
    linkedinUrl: profileUrl,
    companyDomain: accountDomain,
    companyWebsite: current?.company_website ?? `https://${accountDomain}`,
    sourceConfidence: 0.98,
    email: null,
    emailVerified: false,
    verificationStatus: 'not_requested',
    verificationSource: null,
    metadata: { crustdataPersonId: person?.crustdata_person_id ?? null },
  };
}

export async function searchCrustdataBuyers({ apiKey, accountDomain, profile: rawProfile, fetchImpl = fetch, limit = 3 }) {
  const profile = normalizeOfferProfile(rawProfile);
  const body = {
    filters: {
      op: 'and',
      conditions: [
        { field: 'experience.employment_details.current.company_website_domain', type: '=', value: registrableDomain(accountDomain) },
        { op: 'or', conditions: buyerTitleConditions(profile) },
      ],
    },
    fields: ['crustdata_person_id','basic_profile','social_handles','experience'],
    limit: Math.max(1, Math.min(3, Number(limit) || 3)),
  };
  const result = await request({ apiKey, path: '/person/search', method: 'POST', body, fetchImpl });
  const people = Array.isArray(result.data?.profiles) ? result.data.profiles : [];
  return {
    candidates: people.map((person) => normalizePerson(person, registrableDomain(accountDomain))),
    creditsUsed: result.creditsUsed,
    resultCount: people.length,
  };
}

function matchedOnValue(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.professional_network_profile_url || value.profile_url || value.url || null;
  return null;
}

export async function enrichCrustdataBusinessEmails({ apiKey, candidates, fetchImpl = fetch }) {
  const rows = (candidates ?? []).filter((candidate) => candidate?.linkedinUrl).slice(0, 25);
  if (!rows.length) return { contacts: [], creditsUsed: 0, matchedCount: 0 };
  const result = await request({
    apiKey,
    path: '/person/contact/enrich',
    method: 'POST',
    body: {
      professional_network_profile_urls: rows.map((candidate) => candidate.linkedinUrl),
      fields: ['contact.business_emails'],
    },
    fetchImpl,
  });
  const enriched = Array.isArray(result.data) ? result.data : [];
  const contacts = [];
  for (const item of enriched) {
    const matchedOn = matchedOnValue(item?.matched_on);
    const source = rows.find((candidate) => candidate.linkedinUrl === matchedOn);
    const matches = Array.isArray(item?.matches) ? item.matches : [];
    const emails = matches.flatMap((match) => (match?.person_data?.contact?.business_emails ?? []).map((email) => ({ ...email, confidenceScore: match?.confidence_score ?? null })));
    const best = emails.find((email) => String(email.status ?? '').toLowerCase() === 'deliverable') ?? emails[0];
    if (!source || !best?.email) continue;
    const deliverable = String(best.status ?? '').toLowerCase() === 'deliverable';
    contacts.push({
      ...source,
      email: best.email,
      emailVerified: deliverable,
      verificationStatus: best.status ?? 'unknown',
      verificationSource: 'crustdata-contact-enrich',
      emailProvider: 'crustdata',
      lastVerifiedAt: new Date().toISOString(),
      sourceConfidence: Math.max(source.sourceConfidence ?? 0, Number(best.confidenceScore ?? 0)),
    });
  }
  return { contacts, creditsUsed: result.creditsUsed, matchedCount: contacts.length };
}
