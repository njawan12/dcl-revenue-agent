export function validateDraft(draft, context) {
  const errors = [];
  const body = `${draft?.subject ?? ''}\n${draft?.body ?? ''}`;
  if (!draft?.body?.trim()) errors.push('empty_body');
  if (!context?.reasonToContact?.trim()) errors.push('missing_reason_to_contact');
  if (!context?.contact?.emailVerified) errors.push('unverified_recipient');
  if (context?.suppressed) errors.push('suppressed_account');

  const allowedClaims = new Set((context?.approvedProofPoints ?? []).map(x => x.approvedClaim));
  for (const claim of draft?.claims ?? []) {
    if (!allowedClaims.has(claim)) errors.push(`unapproved_claim:${claim}`);
  }

  const banned = ['guarantee', 'guaranteed revenue', 'we will definitely', '100% increase'];
  for (const phrase of banned) if (body.toLowerCase().includes(phrase)) errors.push(`banned_phrase:${phrase}`);
  return { valid: errors.length === 0, errors };
}
