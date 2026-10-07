import { scoreFit, scoreNeed, scoreIntent, scoreOpportunity, qualifyOpportunity, chooseMotion } from '../scoring.js';

export function buildOpportunity(account, evidence) {
  const fit = scoreFit({
    shopify: account.shopify,
    shopifyPlus: account.shopifyPlus,
    country: account.country,
    dtc: account.dtc,
    employeeCount: account.employeeCount,
    industry: account.industry,
    estimatedAgencyCapacity: account.estimatedAgencyCapacity,
  });

  const need = scoreNeed(evidence.need ?? {});
  const intent = scoreIntent(evidence.intent ?? {});
  const evidenceConfidence = evidence.confidence ?? 0.8;
  const opportunity = scoreOpportunity({ fit, need, intent, evidenceConfidence });
  const qualification = qualifyOpportunity({ fit, need, intent, opportunity });
  const motion = chooseMotion({
    hiringSignal: Boolean(evidence.intent?.jobPostedDaysAgo != null),
    longOpenRole: Boolean((evidence.intent?.jobPostedDaysAgo ?? 0) >= 21),
    strongStorefrontNeed: need >= 65,
    newLeader: Boolean(evidence.intent?.newEcommerceLeaderDaysAgo != null),
  });

  return { fit, need, intent, opportunity, ...qualification, motion };
}

export function canGenerateOutreach({ account, contact, thesis, proofPoint }) {
  const blockers = [];
  if ((account.fitScore ?? 0) < 55) blockers.push('fit_below_threshold');
  if (!thesis?.trim()) blockers.push('missing_commercial_thesis');
  if (!contact?.isPrimaryBuyer) blockers.push('missing_relevant_buyer');
  if (!contact?.emailVerified) blockers.push('email_not_verified');
  if (!proofPoint?.approved) blockers.push('proof_not_approved');
  if (account.suppressed) blockers.push('account_suppressed');
  return { allowed: blockers.length === 0, blockers };
}
