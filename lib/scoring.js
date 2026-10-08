/**
 * DCL Opportunity scoring v0.1
 * Scores are deliberately explainable and deterministic.
 * AI may produce evidence, but it cannot directly invent the final score.
 */

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

export function scoreFit(input) {
  let score = 0;
  if (input.shopify) score += 25;
  if (input.shopifyPlus) score += 10;
  if (["US", "CA"].includes(input.country)) score += 10;
  if (input.dtc) score += 15;
  if ((input.employeeCount ?? 0) >= 20 && (input.employeeCount ?? 0) <= 1000) score += 15;
  if (["beauty", "wellness", "supplements", "apparel", "food-beverage", "fitness", "pet", "home"].includes(input.industry)) score += 15;
  if (input.estimatedAgencyCapacity) score += 10;
  return clamp(score);
}

export function scoreNeed(input) {
  const weights = {
    cro: 18,
    performance: 14,
    mobileUx: 14,
    pdp: 14,
    subscription: 12,
    analytics: 12,
    retention: 10,
    qa: 6
  };
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const severity = input[key] ?? 0;
    score += weight * Math.max(0, Math.min(1, severity));
  }
  return clamp(score);
}

export function scoreIntent(input) {
  let score = 0;
  if (input.jobPostedDaysAgo != null) {
    if (input.jobPostedDaysAgo <= 3) score += 28;
    else if (input.jobPostedDaysAgo <= 7) score += 22;
    else if (input.jobPostedDaysAgo <= 14) score += 16;
    else if (input.jobPostedDaysAgo <= 30) score += 8;
  } else if (input.activeHiringSignal) {
    // An active public opening is meaningful intent, but less valuable than a verified fresh posting date.
    score += 14;
  }
  if (input.newEcommerceLeaderDaysAgo != null && input.newEcommerceLeaderDaysAgo <= 90) score += 20;
  if (input.replatformSignal) score += 20;
  if (input.fundingOrAcquisitionDaysAgo != null && input.fundingOrAcquisitionDaysAgo <= 180) score += 12;
  if (input.multipleEcommerceHires) score += 10;
  if (input.majorLaunchSignal) score += 10;
  return clamp(score);
}

export function scoreOpportunity({ fit, need, intent, evidenceConfidence = 1 }) {
  const weighted = fit * 0.4 + need * 0.3 + intent * 0.3;
  const confidenceFactor = 0.85 + 0.15 * Math.max(0, Math.min(1, evidenceConfidence));
  return clamp(weighted * confidenceFactor);
}

export function qualifyOpportunity(scores) {
  if (scores.fit < 55) return { tier: "reject", reason: "Poor ICP fit" };
  if (scores.need < 35 && scores.intent < 35) return { tier: "nurture", reason: "Good account, weak current reason to contact" };
  if (scores.opportunity >= 85) return { tier: "priority", reason: "Strong fit with clear need or intent" };
  if (scores.opportunity >= 70) return { tier: "qualified", reason: "Worth researched outreach" };
  return { tier: "review", reason: "Requires human review before outreach" };
}

export function chooseMotion({ hiringSignal, strongStorefrontNeed, newLeader, longOpenRole }) {
  if (hiringSignal && longOpenRole) return "bridge-while-hiring";
  if (hiringSignal) return "extend-internal-team";
  if (newLeader && strongStorefrontNeed) return "growth-partner";
  if (strongStorefrontNeed) return "specialist-gap";
  return "research-first";
}
