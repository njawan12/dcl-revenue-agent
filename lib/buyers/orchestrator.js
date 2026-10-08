import { rankBuyerCandidates } from './ranking.js';
import { searchProspeoBuyers, enrichProspeoPerson } from './prospeo.js';
import { searchHunterDomain, findHunterEmail } from './hunter.js';

function pushUsage(target, usage) {
  if (usage && Number(usage.units ?? 0) > 0) target.push(usage);
}

function identityKey(candidate) {
  return `${candidate.provider || 'unknown'}:${candidate.providerPersonId || candidate.fullName || candidate.email || 'unknown'}`;
}

function mergeContact(candidate, contact) {
  if (!contact) return candidate;
  const {
    provider: emailProvider,
    providerPersonId: _emailProviderPersonId,
    ...contactFields
  } = contact;
  return {
    ...candidate,
    ...contactFields,
    provider: candidate.provider,
    providerPersonId: candidate.providerPersonId,
    emailProvider: emailProvider || contact.verificationSource || null,
    title: contact.title || candidate.title,
    linkedinUrl: contact.linkedinUrl || candidate.linkedinUrl,
    ranking: candidate.ranking,
  };
}

export async function researchBuyerContacts({
  account,
  qualification,
  prospeoApiKey,
  hunterApiKey,
  fetchImpl = fetch,
  maxPaidEnrichments = 3,
}) {
  if (!account?.domain) throw new Error('buyer_account_domain_required');
  const context = {
    accountDomain: account.domain,
    suggestedBuyerRole: qualification?.suggestedBuyerRole,
    need: qualification?.inputs?.need ?? {},
  };
  const usage = [];
  const errors = [];
  let candidates = [];

  if (prospeoApiKey) {
    try {
      const result = await searchProspeoBuyers({
        apiKey: prospeoApiKey,
        accountDomain: account.domain,
        suggestedBuyerRole: qualification?.suggestedBuyerRole,
        fetchImpl,
      });
      candidates.push(...result.candidates);
      pushUsage(usage, result.usage);
    } catch (error) {
      errors.push({ provider:'prospeo', stage:'search', message:error.message });
    }
  }

  // Hunter domain search doubles as a fallback person source and can contribute
  // already-verified candidates. Avoid paying for it unless Prospeo found nothing.
  if (!candidates.length && hunterApiKey) {
    try {
      const result = await searchHunterDomain({ apiKey:hunterApiKey, accountDomain:account.domain, fetchImpl });
      candidates.push(...result.candidates);
      pushUsage(usage, result.usage);
    } catch (error) {
      errors.push({ provider:'hunter', stage:'domain_search', message:error.message });
    }
  }

  let ranked = rankBuyerCandidates(candidates, context, 10);
  const resolved = [];
  let paidAttempts = 0;

  for (const candidate of ranked) {
    if (candidate.emailVerified && candidate.email) {
      resolved.push(candidate);
      break;
    }
    if (paidAttempts >= maxPaidEnrichments) break;

    let contact = null;
    if (candidate.provider === 'prospeo' && prospeoApiKey && candidate.providerPersonId) {
      paidAttempts += 1;
      try {
        const result = await enrichProspeoPerson({
          apiKey:prospeoApiKey,
          personId:candidate.providerPersonId,
          accountDomain:account.domain,
          fetchImpl,
        });
        contact = result.contact;
        pushUsage(usage, result.usage);
      } catch (error) {
        errors.push({ provider:'prospeo', stage:'enrich', message:error.message, personId:candidate.providerPersonId });
      }
    }

    if (!contact && hunterApiKey && (candidate.firstName || candidate.fullName) && paidAttempts < maxPaidEnrichments) {
      // Hunter is a fallback for the same named person; it is not allowed to
      // silently substitute a different person.
      paidAttempts += 1;
      try {
        const result = await findHunterEmail({
          apiKey:hunterApiKey,
          accountDomain:account.domain,
          firstName:candidate.firstName,
          lastName:candidate.lastName,
          fullName:candidate.fullName,
          fetchImpl,
        });
        contact = result.contact;
        pushUsage(usage, result.usage);
      } catch (error) {
        errors.push({ provider:'hunter', stage:'email_finder', message:error.message, fullName:candidate.fullName });
      }
    }

    const merged = mergeContact(candidate, contact);
    resolved.push(merged);
    if (merged.emailVerified && merged.email) break;
  }

  const resolvedByIdentity = new Map(resolved.map((candidate) => [identityKey(candidate), candidate]));
  ranked = ranked.map((candidate) => resolvedByIdentity.get(identityKey(candidate)) || candidate);
  const primaryContact = ranked.find((candidate) => candidate.emailVerified && candidate.email) || null;

  return {
    candidates: ranked,
    primaryContact,
    outreachReady: Boolean(primaryContact),
    usage,
    errors,
    paidEnrichmentAttempts: paidAttempts,
  };
}
