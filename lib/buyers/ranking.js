import { registrableDomain } from '../discovery/domain.js';

const SENIORITY_SCORE = Object.freeze({
  'C-Suite': 20,
  'Vice President': 19,
  Head: 18,
  Director: 16,
  'Founder/Owner': 15,
  Partner: 12,
  Manager: 8,
  Senior: 5,
  Entry: 0,
  Intern: -20,
});

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function candidateCompanyDomains(candidate) {
  return [candidate.companyDomain, candidate.companyWebsite]
    .filter(Boolean)
    .map((value) => {
      try { return registrableDomain(value); } catch { return null; }
    })
    .filter(Boolean);
}

export function exactCompanyMatch(candidate, accountDomain) {
  let target;
  try { target = registrableDomain(accountDomain); } catch { return false; }
  return candidateCompanyDomains(candidate).includes(target);
}

function roleProfile(context = {}) {
  const suggested = normalize(context.suggestedBuyerRole);
  const need = context.need ?? {};
  const dominantNeed = Object.entries(need).sort((a,b) => Number(b[1] ?? 0) - Number(a[1] ?? 0))[0]?.[0] ?? '';

  if (/retention|lifecycle/.test(suggested) || dominantNeed === 'retention') {
    return {
      primary: ['retention','lifecycle','crm','email','sms'],
      secondary: ['ecommerce','e-commerce','commerce','marketing','growth'],
      departments: ['marketing'],
      label: 'retention',
    };
  }
  if (/engineering|technical|developer/.test(suggested) || ['performance','qa'].includes(dominantNeed)) {
    return {
      primary: ['ecommerce','e-commerce','shopify','digital','engineering','technical'],
      secondary: ['commerce','technology','product','growth'],
      departments: ['technical','product'],
      label: 'technical-commerce',
    };
  }
  return {
    primary: ['ecommerce','e-commerce','commerce','digital'],
    secondary: ['growth','marketing','online','direct-to-consumer','d2c','founder','chief executive'],
    departments: ['marketing','product','general management'],
    label: 'ecommerce',
  };
}

function titleScore(title, profile) {
  const value = normalize(title);
  if (!value) return 0;
  if (profile.primary.some((term) => value.includes(term))) return 30;
  if (profile.secondary.some((term) => value.includes(term))) return 18;
  if (/founder|ceo|chief executive/.test(value)) return 10;
  return 0;
}

function departmentScore(departments = [], profile) {
  const values = departments.map(normalize);
  return profile.departments.some((term) => values.some((value) => value.includes(term))) ? 10 : 0;
}

export function rankBuyerCandidate(candidate, context) {
  if (!exactCompanyMatch(candidate, context.accountDomain)) {
    return { score: 0, eligible: false, reason: 'Company domain does not match target account' };
  }

  const profile = roleProfile(context);
  const title = titleScore(candidate.title, profile);
  const seniority = SENIORITY_SCORE[candidate.seniority] ?? 4;
  const department = departmentScore(candidate.departments, profile);
  const sourceConfidence = Math.round(Math.max(0, Math.min(1, Number(candidate.sourceConfidence ?? 0.8))) * 10);
  const score = Math.max(0, Math.min(100, 30 + title + seniority + department + sourceConfidence));

  const reasons = [
    'Exact current-company domain match',
    title >= 30 ? `${profile.label} title directly matches the opportunity` : title > 0 ? `${profile.label} title is adjacent to the opportunity` : 'Title is a fallback match',
    `${candidate.seniority || 'Unknown'} seniority`,
  ];
  if (department) reasons.push('Department aligns with the buying problem');

  return { score, eligible: score >= 55, reason: reasons.join('; '), profile: profile.label };
}

export function rankBuyerCandidates(candidates, context, limit = 5) {
  return candidates
    .map((candidate) => ({ ...candidate, ranking: rankBuyerCandidate(candidate, context) }))
    .filter((candidate) => candidate.ranking.eligible)
    .sort((a,b) => b.ranking.score - a.ranking.score || String(a.fullName).localeCompare(String(b.fullName)))
    .slice(0, limit);
}
