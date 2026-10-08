import { chooseMotion } from '../scoring.js';
import { buildScoringReceipt } from '../scoring-history.js';
import { normalizeWorkspaceConfig } from '../workspaces/config.js';

const DAY = 86_400_000;
function daysSince(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / DAY));
}

function buildNeed(signals) {
  const vector = { cro: 0, performance: 0, mobileUx: 0, pdp: 0, subscription: 0, analytics: 0, retention: 0, qa: 0 };
  for (const signal of signals.filter((s) => s.type === 'storefront')) {
    const id = signal.evidence?.id;
    const severity = Math.max(0, Math.min(1, Number(signal.evidence?.severity ?? 0.35)));
    const needCategory = signal.evidence?.needCategory;
    if (needCategory && Object.hasOwn(vector, needCategory)) vector[needCategory] = Math.max(vector[needCategory], severity);
    if (id === 'no_sticky_atc_marker') { vector.cro = Math.max(vector.cro, severity); vector.mobileUx = Math.max(vector.mobileUx, severity); }
    if (id === 'high_script_count' || id === 'low_lazy_image_ratio') vector.performance = Math.max(vector.performance, severity);
    if (['reviews_not_detected','shipping_copy_not_detected','returns_copy_not_detected'].includes(id)) vector.pdp = Math.max(vector.pdp, severity);
  }
  for (const signal of signals.filter((s) => s.type === 'technology')) {
    const tech = String(signal.evidence?.technology ?? signal.title).toLowerCase();
    if (/klaviyo|attentive|postscript/.test(tech)) vector.retention = Math.max(vector.retention, 0.2);
    if (/recharge|skio|stay/.test(tech)) vector.subscription = Math.max(vector.subscription, 0.2);
  }
  return vector;
}

function buildIntent(signals) {
  const jobs = signals.filter((s) => s.type === 'job');
  const jobDays = jobs.map((s) => daysSince(s.evidence?.postedAt)).filter((v) => v != null);
  const leaders = signals.filter((s) => s.type === 'leadership');
  const leaderDays = leaders.map((s) => Number(s.evidence?.daysAgo)).filter(Number.isFinite);
  const text = signals.map((s) => `${s.title} ${JSON.stringify(s.evidence ?? {})}`).join(' ').toLowerCase();
  return {
    activeHiringSignal: jobs.length > 0,
    jobPostedDaysAgo: jobDays.length ? Math.min(...jobDays) : null,
    newEcommerceLeaderDaysAgo: leaderDays.length ? Math.min(...leaderDays) : null,
    replatformSignal: /replatform|migration|migrat(e|ing|ion).*shopify|shopify plus launch/.test(text),
    fundingOrAcquisitionDaysAgo: /funding|raised|acquisition|acquired/.test(text) ? 90 : null,
    multipleEcommerceHires: jobs.length >= 2,
    majorLaunchSignal: /new market|international expansion|major launch|new category|launching/.test(text),
  };
}

export function suggestBuyerRole({ signals, need, rules = {} }) {
  const jobText = signals.filter((s) => s.type === 'job').map((s) => s.title).join(' ').toLowerCase();
  const techText = signals.filter((s) => s.type === 'technology').map((s) => s.title).join(' ').toLowerCase();
  if (/retention|lifecycle|klaviyo|email|sms/.test(jobText) || need.retention >= 0.4) return rules.retention ?? 'Head of Retention / Lifecycle';
  if (/developer|engineer|frontend|front-end|technical/.test(jobText)) return rules.technicalEcommerce ?? 'VP/Head of Ecommerce or Digital';
  if (/cto|engineering/.test(jobText)) return rules.engineering ?? 'CTO / VP Engineering';
  if (/klaviyo|attentive|postscript/.test(techText) && need.retention >= 0.4) return rules.retention ?? 'Head of Retention / Lifecycle';
  return rules.default ?? 'VP/Head of Ecommerce or Director of Digital';
}

export function qualifyDiscoveredAccount(account, allSignals = [], workspaceRawConfig = {}) {
  const workspace = normalizeWorkspaceConfig(workspaceRawConfig);
  const signals = allSignals.filter((signal) => signal.accountDomain === account.domain);
  const fitInput = {
    shopify: Number(account.evidence?.shopifyConfidence ?? 0) >= 0.35,
    shopifyPlus: Boolean(account.evidence?.shopifyPlus),
    country: account.country,
    dtc: account.dtc ?? true,
    employeeCount: account.employeeCount,
    industry: account.industry,
    estimatedAgencyCapacity: account.estimatedAgencyCapacity ?? Boolean(account.employeeCount && account.employeeCount >= 20),
  };
  const needInput = buildNeed(signals);
  const intentInput = buildIntent(signals);
  const confidences = signals.map((s) => s.confidence).filter(Number.isFinite);
  const evidenceConfidence = confidences.length ? confidences.reduce((a,b) => a + b, 0) / confidences.length : 0.5;
  const evidenceRefs = signals.filter((s) => s.fingerprint).map((s) => ({ id: s.fingerprint, kind: s.type, observedAt: s.observedAt ?? null }));
  const receipt = buildScoringReceipt({ fitInput, needInput, intentInput, evidenceConfidence, evidenceRefs, config: workspace.scoring });
  const { fit, need, intent, opportunity } = receipt.scores;
  const motion = chooseMotion({
    hiringSignal: intentInput.activeHiringSignal,
    strongStorefrontNeed: need >= workspace.scoring.thresholds.nurtureNeed,
    newLeader: intentInput.newEcommerceLeaderDaysAgo != null && intentInput.newEcommerceLeaderDaysAgo <= 90,
    longOpenRole: intentInput.jobPostedDaysAgo != null && intentInput.jobPostedDaysAgo >= 30,
  }, workspace.salesMotionRules);
  return {
    workspaceId: workspace.workspaceId,
    accountDomain: account.domain,
    scores: { fit, need, intent, opportunity, evidenceConfidence: receipt.evidenceConfidence },
    tier: receipt.tier,
    reason: receipt.explanation.qualificationReason,
    motion,
    suggestedBuyerRole: suggestBuyerRole({ signals, need: needInput, rules: workspace.buyerRoleRules }),
    inputs: receipt.inputs,
    scoringReceipt: receipt,
  };
}
