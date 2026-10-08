const SIGNAL_WEIGHTS = Object.freeze({
  leadership_change: 34,
  ecommerce_hiring: 32,
  job_posting: 28,
  platform_migration: 34,
  redesign: 30,
  product_launch: 27,
  subscription_change: 30,
  retention_stack_change: 29,
  technology_change: 25,
  performance_issue: 24,
  storefront_change: 22,
});

const STAGE_WEIGHTS = Object.freeze({
  won: 40,
  proposal: 34,
  opportunity: 31,
  meeting: 28,
  engaged: 24,
  contacted: 18,
  ready: 16,
  qualified: 14,
  lost: 12,
  new: 8,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function freshnessPoints(occurredAt, now = Date.now()) {
  const timestamp = new Date(occurredAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now - timestamp) / 86400000);
  if (ageDays <= 1) return 18;
  if (ageDays <= 3) return 13;
  if (ageDays <= 7) return 8;
  return 0;
}

export function rankObservedChange({ signalType, confidence = 0, occurredAt, opportunityScore = 0, ready = false, now = Date.now() }) {
  const normalizedType = String(signalType || '').toLowerCase();
  const base = SIGNAL_WEIGHTS[normalizedType] ?? 18;
  const confidencePoints = Math.round(clamp(Number(confidence) || 0, 0, 1) * 20);
  const scorePoints = Math.round(clamp(Number(opportunityScore) || 0, 0, 100) / 10);
  const readinessPoints = ready ? 8 : 0;
  const materiality = clamp(base + confidencePoints + freshnessPoints(occurredAt, now) + scorePoints + readinessPoints, 0, 100);

  return {
    materiality,
    band: materiality >= 75 ? 'act_now' : materiality >= 55 ? 'review' : 'monitor',
    reason: ready
      ? 'Recent observed evidence landed on an outreach-ready opportunity.'
      : opportunityScore >= 70
        ? 'Recent observed evidence landed on a high-scoring opportunity; resolve readiness before outreach.'
        : 'Recent observed evidence may change the commercial thesis; inspect before changing course.',
  };
}

export function rankPipelineChange({ previousStage, stage, occurredAt, opportunityScore = 0, nextActionDue = null, now = Date.now() }) {
  const stageChanged = previousStage !== stage;
  const base = stageChanged ? (STAGE_WEIGHTS[String(stage || '').toLowerCase()] ?? 14) : 8;
  const scorePoints = Math.round(clamp(Number(opportunityScore) || 0, 0, 100) / 12.5);
  const dueTimestamp = nextActionDue ? new Date(`${nextActionDue}T23:59:59Z`).getTime() : NaN;
  const duePoints = Number.isFinite(dueTimestamp) && dueTimestamp <= now + 86400000 ? 16 : 0;
  const materiality = clamp(base + freshnessPoints(occurredAt, now) + scorePoints + duePoints, 0, 100);

  return {
    materiality,
    band: materiality >= 65 ? 'act_now' : materiality >= 45 ? 'review' : 'monitor',
    reason: duePoints
      ? 'Pipeline context changed and the recorded next action is due now.'
      : stageChanged
        ? 'Pipeline stage changed; confirm the next action still matches the opportunity.'
        : 'The operator changed the next action; review only if it affects today’s priorities.',
  };
}
