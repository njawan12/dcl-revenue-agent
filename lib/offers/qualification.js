import { isExcludedIndustry, normalizeOfferProfile, titleMatchesProfile, profileSnapshot } from './profiles.js';

export const OFFER_PROFILE_SCORING_VERSION = 'offer-profile-v1';

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const DAY = 86_400_000;

function daysSince(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / DAY));
}

function countryMatches(country, profile) {
  const value = String(country ?? '').trim().toLowerCase();
  if (!value) return false;
  for (const target of profile.targetCountries ?? []) {
    if (value === String(target).toLowerCase()) return true;
    if ((profile.countryAliases?.[target] ?? []).some((alias) => value === String(alias).toLowerCase())) return true;
  }
  return false;
}

function jobSignalsFor(accountDomain, signals, profile) {
  return signals
    .filter((signal) => signal.accountDomain === accountDomain && signal.type === 'job')
    .map((signal) => ({ ...signal, ageDays: daysSince(signal.evidence?.postedAt ?? signal.observedAt) }))
    .filter((signal) => signal.ageDays != null && signal.ageDays <= profile.lookbackDays && titleMatchesProfile(signal.title, profile))
    .sort((a, b) => (a.ageDays ?? 999) - (b.ageDays ?? 999));
}

function buildFit(account, jobs, profile) {
  const reasons = [];
  let score = 0;
  const countryOk = countryMatches(account.country, profile);
  const employeeCount = Number(account.employeeCount ?? 0);
  const sizeOk = employeeCount > 0 && employeeCount >= profile.employeeMin && employeeCount <= profile.employeeMax;
  const industryExcluded = isExcludedIndustry(account.industry, profile);
  const titleOk = jobs.length > 0;
  const domainOk = Boolean(account.domain);

  if (countryOk) { score += 30; reasons.push('Target geography'); }
  else reasons.push('Outside configured geography');
  if (sizeOk) { score += 25; reasons.push('Company size in target range'); }
  else if (!employeeCount) { score += 10; reasons.push('Company size unavailable'); }
  else reasons.push('Company size outside target range');
  if (!industryExcluded) { score += 20; reasons.push('Industry not excluded'); }
  else reasons.push('Excluded industry');
  if (titleOk) { score += 15; reasons.push('Target hiring trigger observed'); }
  if (domainOk) score += 10;

  if (industryExcluded) score = Math.min(score, 40);
  return { score: clamp(score), reasons, countryOk, sizeOk, industryExcluded, titleOk };
}

function buildNeed(accountDomain, signals) {
  const vector = { storefront: 0, performance: 0, conversion: 0, retention: 0, analytics: 0, other: 0 };
  for (const signal of signals.filter((item) => item.accountDomain === accountDomain && item.type === 'storefront')) {
    const severity = Math.max(0, Math.min(1, Number(signal.evidence?.severity ?? 0.35)));
    const category = String(signal.evidence?.needCategory ?? '').toLowerCase();
    if (/performance|speed/.test(category) || /script|lazy/.test(String(signal.evidence?.id ?? ''))) vector.performance = Math.max(vector.performance, severity);
    else if (/retention|crm|email|sms/.test(category)) vector.retention = Math.max(vector.retention, severity);
    else if (/analytic|tracking/.test(category)) vector.analytics = Math.max(vector.analytics, severity);
    else if (/cro|pdp|mobile|conversion/.test(category) || /sticky|review|shipping|return/.test(String(signal.evidence?.id ?? ''))) vector.conversion = Math.max(vector.conversion, severity);
    else vector.storefront = Math.max(vector.storefront, severity);
  }
  const score = clamp(
    vector.performance * 25 +
    vector.conversion * 35 +
    vector.retention * 15 +
    vector.analytics * 15 +
    vector.storefront * 10
  );
  return { score, vector };
}

function buildIntent(jobs, accountDomain, signals, profile) {
  if (!jobs.length) return { score: 0, inputs: { hiringTrigger: false } };
  const newestAge = jobs[0].ageDays ?? profile.lookbackDays;
  let freshness = 45;
  if (newestAge <= 3) freshness = 70;
  else if (newestAge <= 7) freshness = 62;
  else if (newestAge <= 14) freshness = 52;
  else freshness = 35;
  const multiple = jobs.length >= 2 ? 15 : 0;
  const secondaryText = signals
    .filter((signal) => signal.accountDomain === accountDomain && signal.type !== 'job')
    .map((signal) => `${signal.title} ${JSON.stringify(signal.evidence ?? {})}`)
    .join(' ')
    .toLowerCase();
  const expansion = /replatform|migration|launch|expansion|funding|raised|acquired|acquisition/.test(secondaryText) ? 15 : 0;
  return {
    score: clamp(freshness + multiple + expansion),
    inputs: { hiringTrigger: true, newestJobAgeDays: newestAge, matchingJobs: jobs.length, multipleMatchingJobs: jobs.length >= 2, expansionSignal: expansion > 0 },
  };
}

function tierFor({ fit, intent, opportunity, hasHiringTrigger }, profile) {
  if (profile.scoringConfig.requireHiringTrigger && !hasHiringTrigger) return { tier: 'reject', reason: 'No matching recent hiring trigger' };
  if (fit < 60) return { tier: 'reject', reason: 'Hiring trigger found, but company does not meet the offer profile fit guardrails' };
  if (opportunity >= 85) return { tier: 'priority', reason: 'Fresh hiring trigger with strong offer-profile fit' };
  if (opportunity >= 70) return { tier: 'qualified', reason: 'Recent target hire and sufficient account fit for researched outreach' };
  if (intent >= 50) return { tier: 'review', reason: 'Relevant hiring activity, but fit or supporting evidence needs human review' };
  return { tier: 'nurture', reason: 'Account fits, but the trigger is not strong enough for immediate outreach' };
}

export function qualifyAccountForOfferProfile(account, allSignals = [], rawProfile = {}) {
  const profile = normalizeOfferProfile(rawProfile);
  const jobs = jobSignalsFor(account.domain, allSignals, profile);
  const fitResult = buildFit(account, jobs, profile);
  const needResult = buildNeed(account.domain, allSignals);
  const intentResult = buildIntent(jobs, account.domain, allSignals, profile);
  const evidenceSignals = allSignals.filter((signal) => signal.accountDomain === account.domain);
  const confidences = evidenceSignals.map((signal) => Number(signal.confidence)).filter(Number.isFinite);
  const evidenceConfidence = Math.max(0, Math.min(1, confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.5));

  // Hiring is deliberately dominant. Storefront evidence improves prioritization and personalization,
  // but cannot create an opportunity when the profile requires a hiring trigger.
  const opportunity = clamp((fitResult.score * 0.45 + intentResult.score * 0.45 + needResult.score * 0.10) * (0.9 + evidenceConfidence * 0.1));
  const scores = { fit: fitResult.score, need: needResult.score, intent: intentResult.score, opportunity, evidenceConfidence };
  const tier = tierFor({ fit: scores.fit, intent: scores.intent, opportunity, hasHiringTrigger: jobs.length > 0 }, profile);
  const primaryJob = jobs[0] ?? null;
  const suggestedBuyerRole = profile.buyerRoles[0] ?? 'Decision maker';
  const evidenceRefs = evidenceSignals.map((signal) => ({ id: signal.fingerprint, kind: signal.type, observedAt: signal.observedAt ?? null, sourceUrl: signal.sourceUrl ?? null }));
  const scoringReceipt = {
    scoringContractVersion: OFFER_PROFILE_SCORING_VERSION,
    offerProfileId: profile.id,
    offerProfileKey: profile.profileKey,
    scores,
    tier: tier.tier,
    evidenceConfidence,
    inputs: {
      fit: { country: account.country ?? null, employeeCount: account.employeeCount ?? null, industry: account.industry ?? null, ...fitResult },
      need: needResult.vector,
      intent: intentResult.inputs,
      primaryJob: primaryJob ? { title: primaryJob.title, sourceUrl: primaryJob.sourceUrl, postedAt: primaryJob.evidence?.postedAt ?? primaryJob.observedAt, ageDays: primaryJob.ageDays } : null,
    },
    explanation: {
      qualificationReason: tier.reason,
      fitReasons: fitResult.reasons,
      hiringPrimary: true,
      storefrontSecondary: true,
    },
    evidenceRefs,
    configSnapshot: profileSnapshot(profile),
    calculatedAt: new Date().toISOString(),
  };

  return {
    workspaceId: profile.workspaceId,
    offerProfileId: profile.id,
    offerProfileKey: profile.profileKey,
    accountDomain: account.domain,
    scores,
    tier: tier.tier,
    reason: tier.reason,
    motion: jobs.length ? 'extend-internal-team' : 'research-first',
    suggestedBuyerRole,
    primaryJob,
    inputs: scoringReceipt.inputs,
    scoringReceipt,
  };
}
