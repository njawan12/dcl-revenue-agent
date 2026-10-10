import { normalizeOfferProfile } from '../offers/profiles.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

function safeJson(value) {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
}

function extractText(data) {
  return (data?.content ?? []).filter((item) => item?.type === 'text').map((item) => item.text).join('\n').trim();
}

function parseDraft(text) {
  let raw = String(text ?? '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      subject: String(parsed.subject ?? '').trim(),
      body: String(parsed.body ?? '').trim(),
      claims: Array.isArray(parsed.claims) ? parsed.claims.map(String) : [],
      evidenceUsed: Array.isArray(parsed.evidenceUsed) ? parsed.evidenceUsed.map(String) : [],
    };
  } catch {
    throw Object.assign(new Error('anthropic_invalid_draft_json'), { code: 'invalid_ai_output' });
  }
}

export function buildDraftPrompt({ account, contact, qualification, profile: rawProfile, secondaryEvidence = [], approvedProofPoints = [] }) {
  const profile = normalizeOfferProfile(rawProfile);
  const job = qualification?.primaryJob;
  if (!job?.sourceUrl || !job?.title) throw new Error('draft_requires_primary_job_evidence');
  if (!contact?.emailVerified || !contact?.email) throw new Error('draft_requires_verified_business_email');
  const firstName = contact.firstName || String(contact.fullName ?? '').trim().split(/\s+/)[0] || 'there';
  const evidence = secondaryEvidence.slice(0, 5).map((item) => ({
    title: item.title,
    sourceUrl: item.sourceUrl,
    observedAt: item.observedAt,
    evidence: item.evidence,
  }));
  const proof = approvedProofPoints.map((item) => ({ id: item.id, approvedClaim: item.approvedClaim })).filter((item) => item.approvedClaim);
  return `You write concise B2B prospecting drafts for a human operator. The output is a draft only and will never be sent automatically.

Return ONLY valid JSON with exactly these keys:
{"subject":"...","body":"...","claims":[],"evidenceUsed":[]}

Hard rules:
- Never invent facts, people, metrics, clients, results, dates, or company details.
- The observed job posting is the PRIMARY reason to contact.
- Only mention secondary storefront/company evidence explicitly provided below.
- Do not say we know why the company is hiring. Do not imply insider knowledge.
- Do not make legal/compliance claims.
- Do not promise outcomes or guaranteed savings/revenue.
- Use only approved proof claims listed below; otherwise claims must be an empty array.
- Keep the body at or below ${profile.emailConfig.maxWords ?? 130} words.
- Tone: ${profile.emailConfig.tone}.
- Subject style: ${profile.emailConfig.subjectStyle}.
- CTA: low-friction and human.

Offer profile:
${safeJson(profile.offer)}

Template direction (adapt naturally; do not force awkward wording):
${profile.emailConfig.template}

Recipient:
${safeJson({ firstName, fullName: contact.fullName, title: contact.title, email: contact.email })}

Company:
${safeJson({ name: account.name, domain: account.domain, country: account.country, industry: account.industry, employeeCount: account.employeeCount })}

Primary hiring evidence:
${safeJson({ jobTitle: job.title, jobUrl: job.sourceUrl, postedAt: job.evidence?.postedAt ?? job.observedAt, descriptionExcerpt: job.evidence?.descriptionExcerpt ?? null })}

Secondary observed evidence:
${safeJson(evidence)}

Approved proof claims:
${safeJson(proof)}

Make the email sound like a sharp agency founder wrote it, not an AI. No em dashes. No buzzword stacking.`;
}

export async function draftWithAnthropic({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch, ...context }) {
  if (!apiKey) throw Object.assign(new Error('anthropic_api_key_required'), { code: 'provider_not_configured' });
  const prompt = buildDraftPrompt(context);
  const response = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: 'You are a careful B2B sales copywriter. Evidence fidelity is more important than persuasion. Return JSON only.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `anthropic_http_${response.status}`;
    throw Object.assign(new Error(message), { code: 'anthropic_request_failed', status: response.status });
  }
  const draft = parseDraft(extractText(data));
  return {
    ...draft,
    provider: 'anthropic',
    model: data?.model ?? model,
    usage: {
      inputTokens: Number(data?.usage?.input_tokens ?? 0),
      outputTokens: Number(data?.usage?.output_tokens ?? 0),
    },
  };
}

export { DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL };
