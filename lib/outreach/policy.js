export const OUTREACH_POLICY_VERSION = 'outreach-policy-v1';

const DEFAULT_POLICY = Object.freeze({
  US: { status: 'reviewable', requiredBasis: 'workspace_policy_verified' },
  CA: { status: 'reviewable', requiredBasis: 'workspace_policy_verified' },
  GB: { status: 'reviewable', requiredBasis: 'workspace_policy_verified' },
  EU: { status: 'reviewable', requiredBasis: 'workspace_policy_verified' },
});

function normalizeRegion(value) {
  const region = String(value ?? '').trim().toUpperCase();
  if (['UK', 'UNITED KINGDOM'].includes(region)) return 'GB';
  if (['USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(region)) return 'US';
  if (['CANADA'].includes(region)) return 'CA';
  return region;
}

export function evaluateOutreachPolicy(input, policyConfig = DEFAULT_POLICY) {
  const reasons = [];
  const region = normalizeRegion(input?.region);
  const rule = region ? policyConfig?.[region] : null;

  if (input?.suppressed) reasons.push('suppressed');
  if (!input?.professionalEmailVerified) reasons.push('professional_email_unverified');
  if (!region) reasons.push('jurisdiction_unknown');
  else if (!rule) reasons.push('jurisdiction_policy_unconfigured');
  else if (rule.status !== 'reviewable') reasons.push('jurisdiction_policy_blocked');

  // A configured region is not itself legal permission. A workspace must have
  // explicitly verified its policy/legal basis outside this evaluator.
  if (rule?.requiredBasis && input?.policyBasisStatus !== 'verified') {
    reasons.push('policy_basis_unverified');
  }

  if (!input?.purpose?.trim()) reasons.push('purpose_missing');
  if (!input?.sourceProvenanceReady) reasons.push('source_provenance_unverified');

  return Object.freeze({
    contractVersion: OUTREACH_POLICY_VERSION,
    decision: reasons.length === 0 ? 'eligible_for_human_review' : 'blocked',
    region: region || null,
    reasons: Object.freeze([...new Set(reasons)].sort()),
    evaluatedInputs: Object.freeze({
      suppressed: Boolean(input?.suppressed),
      professionalEmailVerified: Boolean(input?.professionalEmailVerified),
      policyBasisStatus: input?.policyBasisStatus ?? 'unknown',
      purposePresent: Boolean(input?.purpose?.trim()),
      sourceProvenanceReady: Boolean(input?.sourceProvenanceReady),
    }),
  });
}

export function policyAllowsHeldOutbox(receipt) {
  return receipt?.contractVersion === OUTREACH_POLICY_VERSION &&
    receipt?.decision === 'eligible_for_human_review';
}
