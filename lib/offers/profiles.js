const clampInt = (value, fallback, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const asStrings = (value) => Array.isArray(value)
  ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
  : [];

export const DCL_PROFILE_KEY = 'dcl-shopify-ecommerce-hiring';

export const DEFAULT_DCL_OFFER_PROFILE = Object.freeze({
  id: null,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  profileKey: DCL_PROFILE_KEY,
  name: 'DCL · Shopify & Ecommerce Hiring',
  active: true,
  priority: 10,
  lookbackDays: 14,
  targetJobTitles: [
    'Shopify Developer','Shopify Engineer','Shopify Plus Developer','Liquid Developer',
    'Ecommerce Developer','E-commerce Developer','Shopify Web Developer',
    'Frontend Shopify Developer','Front End Shopify Developer','Ecommerce Engineer',
  ],
  targetCountries: ['United States','Canada'],
  countryAliases: {
    'United States': ['USA','United States','United States of America','US','U.S.'],
    Canada: ['Canada','CA'],
  },
  employeeMin: 20,
  employeeMax: 5000,
  excludedIndustries: ['staffing','recruiting','recruiter','agency','agencies'],
  buyerRoles: [
    'VP/Head of Ecommerce','Director of Ecommerce','Director of Digital','VP/Head of Digital',
    'CTO / VP Engineering','Head of Retention / Lifecycle',
  ],
  offer: {
    name: 'Digital Commerce Lab ecommerce execution alternative',
    summary: 'Offer DCL as a flexible ecommerce development and growth partner when a brand is hiring for Shopify or ecommerce engineering capacity.',
    services: ['Shopify development','CRO and experimentation','UI/UX','CRM and retention','Analytics and QA'],
    positioning: 'Instead of waiting to fill a full-time ecommerce development role, DCL can operate as an experienced extension of the ecommerce team.',
    cta: 'Offer to share the specific storefront and hiring observations behind the outreach.',
  },
  emailConfig: {
    tone: 'human, concise, specific, commercially credible, no hype',
    maxWords: 130,
    subjectStyle: 'plain and relevant; no clickbait',
    template: 'Hi {{first_name}},\n\nI noticed {{company}} is hiring for {{job_title}}. {{evidence_sentence}}\n\nDCL works as an extension of ecommerce teams across Shopify development and CRO, so there may be a faster option than waiting for another full-time hire.\n\nHappy to send over the specific things we noticed if useful.\n\nNouman',
    rules: ['Never invent a company fact','Never invent a result or case-study claim','Reference the observed job as the primary reason to contact','Use storefront evidence only when actually observed','Do not claim legal compliance'],
  },
  caps: {
    jobsPerRun: 25,
    contactsPerRun: 25,
    leadsPerDay: 25,
    leadsPerWeek: 100,
    creditsPerRun: 60,
    creditsPerDay: 60,
    creditsPerWeek: 250,
  },
  scoringConfig: {
    requireHiringTrigger: true,
    maxJobAgeDays: 14,
    hiringPrimary: true,
    storefrontSecondary: true,
  },
});

export function normalizeOfferProfile(raw = {}) {
  const fallback = DEFAULT_DCL_OFFER_PROFILE;
  const caps = raw.caps ?? {};
  const scoringConfig = raw.scoringConfig ?? raw.scoring_config ?? {};
  return {
    id: raw.id ?? null,
    workspaceId: raw.workspaceId ?? raw.workspace_id ?? fallback.workspaceId,
    profileKey: raw.profileKey ?? raw.profile_key ?? fallback.profileKey,
    name: raw.name ?? fallback.name,
    active: raw.active ?? true,
    priority: clampInt(raw.priority, fallback.priority, 0, 10000),
    lookbackDays: clampInt(raw.lookbackDays ?? raw.lookback_days, fallback.lookbackDays, 1, 90),
    targetJobTitles: asStrings(raw.targetJobTitles ?? raw.target_job_titles).length ? asStrings(raw.targetJobTitles ?? raw.target_job_titles) : [...fallback.targetJobTitles],
    targetCountries: asStrings(raw.targetCountries ?? raw.target_countries).length ? asStrings(raw.targetCountries ?? raw.target_countries) : [...fallback.targetCountries],
    countryAliases: raw.countryAliases ?? raw.country_aliases ?? fallback.countryAliases,
    employeeMin: clampInt(raw.employeeMin ?? raw.employee_min, fallback.employeeMin, 1, 1_000_000),
    employeeMax: clampInt(raw.employeeMax ?? raw.employee_max, fallback.employeeMax, 1, 1_000_000),
    excludedIndustries: asStrings(raw.excludedIndustries ?? raw.excluded_industries),
    buyerRoles: asStrings(raw.buyerRoles ?? raw.buyer_roles).length ? asStrings(raw.buyerRoles ?? raw.buyer_roles) : [...fallback.buyerRoles],
    offer: { ...fallback.offer, ...(raw.offer ?? {}) },
    emailConfig: { ...fallback.emailConfig, ...(raw.emailConfig ?? raw.email_config ?? {}) },
    caps: {
      jobsPerRun: clampInt(caps.jobsPerRun, fallback.caps.jobsPerRun, 1, 25),
      contactsPerRun: clampInt(caps.contactsPerRun, fallback.caps.contactsPerRun, 1, 25),
      leadsPerDay: clampInt(caps.leadsPerDay, fallback.caps.leadsPerDay, 1, 500),
      leadsPerWeek: clampInt(caps.leadsPerWeek, fallback.caps.leadsPerWeek, 1, 3000),
      creditsPerRun: clampInt(caps.creditsPerRun, fallback.caps.creditsPerRun, 1, 10000),
      creditsPerDay: clampInt(caps.creditsPerDay, fallback.caps.creditsPerDay, 1, 100000),
      creditsPerWeek: clampInt(caps.creditsPerWeek, fallback.caps.creditsPerWeek, 1, 500000),
    },
    scoringConfig: { ...fallback.scoringConfig, ...scoringConfig },
  };
}

export function countrySearchValues(profile) {
  const values = new Set();
  for (const country of profile.targetCountries ?? []) {
    values.add(country);
    for (const alias of profile.countryAliases?.[country] ?? []) values.add(alias);
  }
  return [...values].filter(Boolean);
}

export function isExcludedIndustry(industry, profile) {
  const value = String(industry ?? '').trim().toLowerCase();
  if (!value) return false;
  return (profile.excludedIndustries ?? []).some((term) => value.includes(String(term).toLowerCase()));
}

export function titleMatchesProfile(title, profile) {
  const value = String(title ?? '').trim().toLowerCase();
  if (!value) return false;
  return (profile.targetJobTitles ?? []).some((target) => {
    const normalized = String(target).trim().toLowerCase();
    if (!normalized) return false;
    return value === normalized || value.includes(normalized) || normalized.includes(value);
  });
}

export function buyerRolePriority(title, profile) {
  const value = String(title ?? '').toLowerCase();
  const roles = profile.buyerRoles ?? [];
  for (let i = 0; i < roles.length; i += 1) {
    const terms = String(roles[i]).toLowerCase().split(/\s*\/\s*|\s+or\s+/).filter(Boolean);
    if (terms.some((term) => value.includes(term.replace(/^vp\s*/,'vp ').trim()))) return Math.max(1, 100 - i * 10);
  }
  return 0;
}

export function profileSnapshot(profile) {
  const normalized = normalizeOfferProfile(profile);
  return {
    id: normalized.id,
    profileKey: normalized.profileKey,
    name: normalized.name,
    lookbackDays: normalized.lookbackDays,
    targetJobTitles: normalized.targetJobTitles,
    targetCountries: normalized.targetCountries,
    employeeMin: normalized.employeeMin,
    employeeMax: normalized.employeeMax,
    excludedIndustries: normalized.excludedIndustries,
    buyerRoles: normalized.buyerRoles,
    offer: normalized.offer,
    emailConfig: normalized.emailConfig,
    caps: normalized.caps,
    scoringConfig: normalized.scoringConfig,
  };
}
