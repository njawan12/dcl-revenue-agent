import crypto from 'node:crypto';
import { createStorefrontSource } from '../discovery/adapters/storefront.js';
import {
  getCrustdataCapabilities,
  getCrustdataCredits,
  searchCrustdataJobs,
  searchCrustdataBuyers,
  enrichCrustdataBusinessEmails,
} from '../discovery/adapters/crustdata.js';
import { runDiscoverySources } from '../discovery/sources.js';
import { qualifyAccountForOfferProfile } from '../offers/qualification.js';
import { buyerRolePriority } from '../offers/profiles.js';
import { draftWithAnthropic } from '../ai/anthropic.js';
import { validateDraft } from '../outreach/guardrails.js';
import { evaluateOutreachPolicy } from '../outreach/policy.js';
import { persistDiscoveryRun } from '../db/discovery.js';
import { persistBuyerResearch } from '../db/contacts.js';
import { loadOfferProfile, providerUsageTotals, recordProviderUsage } from '../db/workspaces.js';

export const DISCOVERY_WORKER_CONTRACT_VERSION = 'hiring-discovery-worker-v2';

function isoStartOfDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function isoStartOfWeek() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function normalizeTitle(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreCandidateForProfile(candidate, profile) {
  const title = normalizeTitle(candidate.title);
  let roleScore = buyerRolePriority(candidate.title, profile);
  if (!roleScore) {
    for (let i = 0; i < profile.buyerRoles.length; i += 1) {
      const role = normalizeTitle(profile.buyerRoles[i]);
      const roleTerms = role.split(' ').filter((term) => term.length > 2 && !['head','director','vice','president'].includes(term));
      if (roleTerms.some((term) => title.includes(term))) {
        roleScore = Math.max(roleScore, 90 - i * 8);
        break;
      }
    }
  }
  const seniorityText = normalizeTitle(candidate.seniority);
  const seniority = /c suite|chief/.test(seniorityText) ? 10 : /vice|vp|head/.test(`${seniorityText} ${title}`) ? 9 : /director/.test(`${seniorityText} ${title}`) ? 8 : /manager/.test(`${seniorityText} ${title}`) ? 4 : 2;
  return Math.max(0, Math.min(100, roleScore + seniority));
}

function chooseBuyer(candidates, profile) {
  return (candidates ?? [])
    .map((candidate) => ({ ...candidate, buyerScore: scoreCandidateForProfile(candidate, profile) }))
    .filter((candidate) => candidate.buyerScore >= 50)
    .sort((a, b) => b.buyerScore - a.buyerScore || String(a.fullName).localeCompare(String(b.fullName)))[0] ?? null;
}

function contentHash({ subject, body, contactId, evidence }) {
  return crypto.createHash('sha256').update(JSON.stringify({ subject, body, contactId, evidence })).digest('hex');
}

async function checkProfileCaps(client, workspaceId, profile) {
  const [daily, weekly] = await Promise.all([
    providerUsageTotals(client, workspaceId, profile.id, isoStartOfDay()),
    providerUsageTotals(client, workspaceId, profile.id, isoStartOfWeek()),
  ]);
  if (daily.units >= profile.caps.creditsPerDay) throw Object.assign(new Error('daily_credit_cap_reached'), { code: 'credit_cap' });
  if (weekly.units >= profile.caps.creditsPerWeek) throw Object.assign(new Error('weekly_credit_cap_reached'), { code: 'credit_cap' });
  return { daily, weekly };
}

async function createHeldDraft(client, {
  workspaceId,
  profile,
  account,
  accountId,
  contact,
  contactId,
  qualification,
  draft,
  secondaryEvidence,
  approvedProofPoints,
}) {
  const reason = `Recent ${qualification.primaryJob.title} opening observed: ${qualification.primaryJob.sourceUrl}`;
  const evidenceSnapshot = [
    {
      kind: 'job',
      title: qualification.primaryJob.title,
      sourceUrl: qualification.primaryJob.sourceUrl,
      observedAt: qualification.primaryJob.observedAt,
      evidence: qualification.primaryJob.evidence ?? {},
    },
    ...secondaryEvidence.slice(0, 5).map((signal) => ({
      kind: signal.type,
      title: signal.title,
      sourceUrl: signal.sourceUrl,
      observedAt: signal.observedAt,
      evidence: signal.evidence ?? {},
    })),
  ];
  const proofSnapshot = approvedProofPoints.map((item) => ({ proofPointId: item.id, approvedClaim: item.approved_claim }));
  const recipientSnapshot = {
    contactId,
    email: contact.email,
    emailVerified: true,
    fullName: contact.fullName,
    title: contact.title,
    provider: 'crustdata',
  };
  const complianceSnapshot = {
    suppressed: false,
    humanApprovalRequired: true,
    autonomousSendEnabled: false,
    professionalEmailOnly: true,
    sendingImplemented: false,
  };
  const policyReceipt = evaluateOutreachPolicy({
    region: account.country,
    suppressed: false,
    professionalEmailVerified: true,
    policyBasisStatus: profile.emailConfig?.policyBasisStatus ?? 'pending_review',
    purpose: profile.offer?.summary ?? 'Business development for a configured offer profile',
    sourceProvenanceReady: true,
  });

  const validation = validateDraft(draft, {
    reasonToContact: reason,
    contact: { emailVerified: true },
    suppressed: false,
    approvedProofPoints: approvedProofPoints.map((item) => ({ approvedClaim: item.approved_claim })),
  });
  if (!validation.valid) throw Object.assign(new Error(`draft_guardrail:${validation.errors.join(',')}`), { code: 'draft_guardrail' });

  const hash = contentHash({ subject: draft.subject, body: draft.body, contactId, evidence: evidenceSnapshot });
  const { data, error } = await client.rpc('create_system_held_outreach_revision', {
    p_workspace_id: workspaceId,
    p_offer_profile_id: profile.id,
    p_account_id: accountId,
    p_contact_id: contactId,
    p_subject: draft.subject,
    p_body: draft.body,
    p_motion: qualification.motion,
    p_reason_to_contact: reason,
    p_evidence_snapshot: evidenceSnapshot,
    p_proof_snapshot: proofSnapshot,
    p_recipient_snapshot: recipientSnapshot,
    p_compliance_snapshot: complianceSnapshot,
    p_policy_receipt: policyReceipt,
    p_content_hash: hash,
  });
  if (error) throw new Error(`create_held_draft:${error.message}`);
  return { ...(data?.[0] ?? {}), policyReceipt };
}

export async function executeDiscoveryJob(client, job, env = process.env) {
  if (!job?.id || !job?.workspace_id || job.job_type !== 'discovery') throw new Error('invalid_discovery_job');
  if (!job.lease_token) throw new Error('discovery_job_requires_lease');
  if (!env.CRUSTDATA_API_KEY) throw Object.assign(new Error('CRUSTDATA_API_KEY is required for hiring-led discovery'), { code: 'provider_not_configured' });

  const scope = job.payload?.scope ?? job.payload ?? {};
  const profile = await loadOfferProfile(client, job.workspace_id, scope.offerProfileId || scope.offerProfileKey || null);
  if (!profile.id) throw new Error('persisted_offer_profile_required');
  await checkProfileCaps(client, job.workspace_id, profile);

  const beforeCredits = await getCrustdataCredits({ apiKey: env.CRUSTDATA_API_KEY }).catch(() => ({ account: null, creditsUsed: 0 }));
  const capabilities = await getCrustdataCapabilities({ apiKey: env.CRUSTDATA_API_KEY });
  if (!capabilities.endpoints.find((entry) => entry.path === '/job/search' && entry.status === 'enabled')) {
    throw Object.assign(new Error('crustdata_job_search_not_enabled'), { code: 'provider_permission' });
  }

  let runCredits = 0;
  const providerErrors = [];
  const jobs = await searchCrustdataJobs({
    apiKey: env.CRUSTDATA_API_KEY,
    profile,
    limit: Math.min(25, profile.caps.jobsPerRun),
  });
  runCredits += Number(jobs.creditsUsed ?? jobs.estimatedCredits ?? 0);
  await recordProviderUsage(client, {
    workspaceId: job.workspace_id,
    offerProfileId: profile.id,
    provider: 'crustdata',
    action: 'job_search',
    units: Number(jobs.creditsUsed ?? jobs.estimatedCredits ?? 0),
    metadata: { durableJobId: job.id, resultCount: jobs.rawCount, cap: profile.caps.jobsPerRun, xCreditsUsed: jobs.creditsUsed },
  });

  // Storefront inspection is intentionally secondary. It can add personalization
  // and need evidence, but it never creates an opportunity without a matching job.
  const storefrontSource = createStorefrontSource({ candidates: jobs.accounts });
  const storefront = await runDiscoverySources([storefrontSource]);
  const accountByDomain = new Map(jobs.accounts.map((account) => [account.domain, account]));
  for (const enriched of storefront.accounts) {
    const original = accountByDomain.get(enriched.domain);
    if (original) accountByDomain.set(enriched.domain, { ...original, ...enriched, evidence: { ...(original.evidence ?? {}), ...(enriched.evidence ?? {}) } });
  }
  const accounts = [...accountByDomain.values()];
  const signals = [...jobs.signals, ...storefront.signals];
  const qualifications = accounts.map((account) => qualifyAccountForOfferProfile(account, signals, profile));

  const persistence = await persistDiscoveryRun(client, {
    workspaceId: job.workspace_id,
    offerProfileId: profile.id,
    sourceNames: ['crustdata-job-search', 'storefront-crawl'],
    accounts,
    signals,
    qualifications,
    errors: storefront.errors,
    metadata: {
      durableJobId: job.id,
      workerContractVersion: DISCOVERY_WORKER_CONTRACT_VERSION,
      offerProfileKey: profile.profileKey,
      jobCap: profile.caps.jobsPerRun,
      contactCap: profile.caps.contactsPerRun,
      rawJobCount: jobs.rawCount,
      excludedJobCount: jobs.excludedCount,
      contactEnrichEnabled: capabilities.contactEnrichEnabled,
    },
  });

  const accountIdByDomain = persistence.accountIdByDomain ?? {};
  const ranked = qualifications
    .filter((item) => ['qualified', 'priority', 'review'].includes(item.tier) && item.primaryJob)
    .sort((a, b) => (b.scores?.opportunity ?? 0) - (a.scores?.opportunity ?? 0))
    .slice(0, Math.min(25, profile.caps.contactsPerRun));

  const chosen = [];
  let contactLookups = 0;
  for (const qualification of ranked) {
    if (contactLookups >= profile.caps.contactsPerRun) break;
    // Conservative reserve before each account: person search + one contact enrichment.
    if (runCredits + 2.5 > profile.caps.creditsPerRun) break;
    const account = accounts.find((item) => item.domain === qualification.accountDomain);
    if (!account) continue;
    try {
      const search = await searchCrustdataBuyers({
        apiKey: env.CRUSTDATA_API_KEY,
        accountDomain: account.domain,
        profile,
        limit: 3,
      });
      contactLookups += 1;
      runCredits += Number(search.creditsUsed ?? 0);
      await recordProviderUsage(client, {
        workspaceId: job.workspace_id,
        offerProfileId: profile.id,
        provider: 'crustdata',
        action: 'person_search',
        units: Number(search.creditsUsed ?? 0),
        metadata: { durableJobId: job.id, accountDomain: account.domain, resultCount: search.resultCount },
      });
      const buyer = chooseBuyer(search.candidates, profile);
      if (buyer) chosen.push({ account, qualification, buyer });
    } catch (error) {
      providerErrors.push({ accountDomain: account.domain, stage: 'person_search', message: error.message });
    }
  }

  let enrichedContacts = [];
  if (chosen.length && capabilities.contactEnrichEnabled && runCredits < profile.caps.creditsPerRun) {
    const enrichLimit = Math.min(chosen.length, profile.caps.contactsPerRun, 25);
    const enrichResult = await enrichCrustdataBusinessEmails({
      apiKey: env.CRUSTDATA_API_KEY,
      candidates: chosen.slice(0, enrichLimit).map((item) => item.buyer),
    });
    runCredits += Number(enrichResult.creditsUsed ?? 0);
    enrichedContacts = enrichResult.contacts;
    await recordProviderUsage(client, {
      workspaceId: job.workspace_id,
      offerProfileId: profile.id,
      provider: 'crustdata',
      action: 'contact_enrich',
      units: Number(enrichResult.creditsUsed ?? 0),
      metadata: { durableJobId: job.id, requestedCount: enrichLimit, matchedCount: enrichResult.matchedCount },
    });
  }

  const { data: proofPoints } = await client
    .from('proof_points')
    .select('id,approved_claim,service_tags')
    .eq('workspace_id', job.workspace_id)
    .eq('approved', true)
    .limit(20);

  let verifiedBuyerCount = 0;
  let draftCount = 0;
  for (const item of chosen) {
    const enriched = enrichedContacts.find((contact) => contact.providerPersonId === item.buyer.providerPersonId) ?? item.buyer;
    const primaryContact = enriched.emailVerified && enriched.email ? { ...enriched, buyerReason: `Priority role for ${profile.name}` } : null;
    const research = {
      candidates: [{ ...enriched, ranking: { score: enriched.buyerScore ?? item.buyer.buyerScore, reason: `Buyer-role priority from ${profile.name}` } }],
      primaryContact,
      outreachReady: Boolean(primaryContact),
      usage: [],
      errors: [],
    };
    const accountId = accountIdByDomain[item.account.domain];
    if (!accountId) continue;
    const storedResearch = await persistBuyerResearch(client, {
      workspaceId: job.workspace_id,
      offerProfileId: profile.id,
      accountId,
      result: research,
    });
    if (!primaryContact || !storedResearch.primaryStored) continue;
    verifiedBuyerCount += 1;

    if (!env.ANTHROPIC_API_KEY) continue;
    const secondaryEvidence = signals.filter((signal) => signal.accountDomain === item.account.domain && signal.type !== 'job');
    try {
      const draft = await draftWithAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL || undefined,
        account: item.account,
        contact: primaryContact,
        qualification: item.qualification,
        profile,
        secondaryEvidence,
        approvedProofPoints: (proofPoints ?? []).map((proof) => ({ id: proof.id, approvedClaim: proof.approved_claim })),
      });
      await recordProviderUsage(client, {
        workspaceId: job.workspace_id,
        offerProfileId: profile.id,
        provider: 'anthropic',
        action: 'draft_email',
        units: Number(draft.usage?.inputTokens ?? 0) + Number(draft.usage?.outputTokens ?? 0),
        metadata: { durableJobId: job.id, accountDomain: item.account.domain, model: draft.model, tokenUsage: draft.usage },
      });
      await createHeldDraft(client, {
        workspaceId: job.workspace_id,
        profile,
        account: item.account,
        accountId,
        contact: primaryContact,
        contactId: storedResearch.primaryStored.id,
        qualification: item.qualification,
        draft,
        secondaryEvidence,
        approvedProofPoints: proofPoints ?? [],
      });
      draftCount += 1;
    } catch (error) {
      providerErrors.push({ accountDomain: item.account.domain, stage: 'draft', message: error.message });
    }
  }

  const afterCredits = await getCrustdataCredits({ apiKey: env.CRUSTDATA_API_KEY }).catch(() => ({ account: null, creditsUsed: 0 }));
  return {
    contractVersion: DISCOVERY_WORKER_CONTRACT_VERSION,
    discoveryRunId: persistence.runId,
    offerProfileId: profile.id,
    offerProfileKey: profile.profileKey,
    provider: 'crustdata',
    jobCount: jobs.rawCount,
    accountCount: accounts.length,
    qualifiedCount: qualifications.filter((item) => ['qualified','priority'].includes(item.tier)).length,
    contactLookups,
    verifiedBuyerCount,
    draftCount,
    contactEnrichEnabled: capabilities.contactEnrichEnabled,
    crustdataCreditsUsed: runCredits,
    crustdataCreditsBefore: beforeCredits.account?.credits ?? null,
    crustdataCreditsAfter: afterCredits.account?.credits ?? null,
    errorCount: storefront.errors.length + providerErrors.length,
    providerErrors,
    sendingEnabled: false,
  };
}

export async function processClaimedJob(client, job, env = process.env) {
  try {
    if (job.job_type !== 'discovery') throw Object.assign(new Error('unsupported_worker_job_type'), { code: 'unsupported_job_type' });
    const result = await executeDiscoveryJob(client, job, env);
    const completion = await client.rpc('complete_durable_job', {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_result: result,
    });
    if (completion.error) throw new Error(`complete_job:${completion.error.message}`);
    return { status: 'succeeded', result };
  } catch (error) {
    const failure = await client.rpc('fail_durable_job', {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_error_code: String(error?.code || 'worker_failure').slice(0, 120),
      p_error_message: String(error?.message || 'Unknown worker failure').slice(0, 2000),
      p_retry_delay_seconds: 60,
    });
    if (failure.error) throw new Error(`fail_job:${failure.error.message}`);
    return { status: 'failed_or_retrying', errorCode: String(error?.code || 'worker_failure') };
  }
}
