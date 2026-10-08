/**
 * Opportunity scoring.
 * Scores are deterministic and explainable; workspace configuration changes weights,
 * but AI may not directly invent the final score.
 */

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

export const DEFAULT_SCORING_CONFIG = Object.freeze({
  targetCountries: ['US', 'CA'],
  targetIndustries: ['beauty','wellness','supplements','apparel','food-beverage','fitness','pet','home'],
  employeeMin: 20,
  employeeMax: 1000,
  fitWeights: {
    shopify: 25,
    shopifyPlus: 10,
    targetCountry: 10,
    dtc: 15,
    employeeBand: 15,
    targetIndustry: 15,
    agencyCapacity: 10,
  },
  needWeights: {
    cro: 18,
    performance: 14,
    mobileUx: 14,
    pdp: 14,
    subscription: 12,
    analytics: 12,
    retention: 10,
    qa: 6,
  },
  intentWeights: {
    recentJob: 28,
    undatedActiveHiring: 14,
    newEcommerceLeader: 20,
    replatform: 20,
    fundingOrAcquisition: 12,
    multipleEcommerceHires: 10,
    majorLaunch: 10,
  },
  opportunityWeights: { fit: 0.4, need: 0.3, intent: 0.3 },
  thresholds: { rejectFit: 55, nurtureNeed: 35, nurtureIntent: 35, qualified: 70, priority: 85 },
});

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_SCORING_CONFIG,
    ...config,
    fitWeights: { ...DEFAULT_SCORING_CONFIG.fitWeights, ...(config.fitWeights ?? {}) },
    needWeights: { ...DEFAULT_SCORING_CONFIG.needWeights, ...(config.needWeights ?? {}) },
    intentWeights: { ...DEFAULT_SCORING_CONFIG.intentWeights, ...(config.intentWeights ?? {}) },
    opportunityWeights: { ...DEFAULT_SCORING_CONFIG.opportunityWeights, ...(config.opportunityWeights ?? {}) },
    thresholds: { ...DEFAULT_SCORING_CONFIG.thresholds, ...(config.thresholds ?? {}) },
  };
}

export function scoreFit(input, config = {}) {
  const c = mergeConfig(config);
  const w = c.fitWeights;
  let score = 0;
  if (input.shopify) score += w.shopify;
  if (input.shopifyPlus) score += w.shopifyPlus;
  if (c.targetCountries.includes(input.country)) score += w.targetCountry;
  if (input.dtc) score += w.dtc;
  if ((input.employeeCount ?? 0) >= c.employeeMin && (input.employeeCount ?? 0) <= c.employeeMax) score += w.employeeBand;
  if (c.targetIndustries.includes(input.industry)) score += w.targetIndustry;
  if (input.estimatedAgencyCapacity) score += w.agencyCapacity;
  return clamp(score);
}

export function scoreNeed(input, config = {}) {
  const c = mergeConfig(config);
  let score = 0;
  for (const [key, weight] of Object.entries(c.needWeights)) {
    const severity = input[key] ?? 0;
    score += weight * Math.max(0, Math.min(1, severity));
  }
  return clamp(score);
}

export function scoreIntent(input, config = {}) {
  const c = mergeConfig(config);
  const w = c.intentWeights;
  let score = 0;
  if (input.jobPostedDaysAgo != null) {
    if (input.jobPostedDaysAgo <= 3) score += w.recentJob;
    else if (input.jobPostedDaysAgo <= 7) score += w.recentJob * 0.79;
    else if (input.jobPostedDaysAgo <= 14) score += w.recentJob * 0.57;
    else if (input.jobPostedDaysAgo <= 30) score += w.recentJob * 0.29;
  } else if (input.activeHiringSignal) {
    score += w.undatedActiveHiring;
  }
  if (input.newEcommerceLeaderDaysAgo != null && input.newEcommerceLeaderDaysAgo <= 90) score += w.newEcommerceLeader;
  if (input.replatformSignal) score += w.replatform;
  if (input.fundingOrAcquisitionDaysAgo != null && input.fundingOrAcquisitionDaysAgo <= 180) score += w.fundingOrAcquisition;
  if (input.multipleEcommerceHires) score += w.multipleEcommerceHires;
  if (input.majorLaunchSignal) score += w.majorLaunch;
  return clamp(score);
}

export function scoreOpportunity({ fit, need, intent, evidenceConfidence = 1 }, config = {}) {
  const c = mergeConfig(config);
  const ow = c.opportunityWeights;
  const weighted = fit * ow.fit + need * ow.need + intent * ow.intent;
  const confidenceFactor = 0.85 + 0.15 * Math.max(0, Math.min(1, evidenceConfidence));
  return clamp(weighted * confidenceFactor);
}

export function qualifyOpportunity(scores, config = {}) {
  const t = mergeConfig(config).thresholds;
  if (scores.fit < t.rejectFit) return { tier: 'reject', reason: 'Poor ICP fit' };
  if (scores.need < t.nurtureNeed && scores.intent < t.nurtureIntent) return { tier: 'nurture', reason: 'Good account, weak current reason to contact' };
  if (scores.opportunity >= t.priority) return { tier: 'priority', reason: 'Strong fit with clear need or intent' };
  if (scores.opportunity >= t.qualified) return { tier: 'qualified', reason: 'Worth researched outreach' };
  return { tier: 'review', reason: 'Requires human review before outreach' };
}

export function chooseMotion({ hiringSignal, strongStorefrontNeed, newLeader, longOpenRole }, rules = {}) {
  const merged = {
    hiring_long_open: 'bridge-while-hiring',
    hiring: 'extend-internal-team',
    new_leader_plus_need: 'growth-partner',
    strong_storefront_need: 'specialist-gap',
    default: 'research-first',
    ...rules,
  };
  if (hiringSignal && longOpenRole) return merged.hiring_long_open;
  if (hiringSignal) return merged.hiring;
  if (newLeader && strongStorefrontNeed) return merged.new_leader_plus_need;
  if (strongStorefrontNeed) return merged.strong_storefront_need;
  return merged.default;
}
