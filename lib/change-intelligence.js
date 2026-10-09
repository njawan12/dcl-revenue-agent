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
  if (!Number.isFinite(timestamp) || timestamp > now) return 0;
  const ageDays = (now - timestamp) / 86400000;
  if (ageDays <= 1) return 18;
  if (ageDays <= 3) return 13;
  if (ageDays <= 7) return 8;
  return 0;
}

function validEventTime(occurredAt, now) {
  if (!occurredAt) return false;
  const timestamp = new Date(occurredAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now;
}

function actionIsDue(date, now) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const timestamp = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === date
    && date <= new Date(now).toISOString().slice(0, 10);
}

export function rankObservedChange({ signalType, confidence = 0, occurredAt, opportunityScore = 0, ready = false, now = Date.now() }) {
  if (!validEventTime(occurredAt, now)) return { materiality: 0, band: 'monitor', reason: 'Observation date is missing, invalid or in the future; verify the source receipt before prioritizing.' };
  const recency = freshnessPoints(occurredAt, now) > 0 ? 'Recent' : 'Older';
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
      ? `${recency} observed evidence has a verified primary buyer available; inspect all eligibility gates before preparing outreach.`
      : opportunityScore >= 70
        ? `${recency} observed evidence landed on a high-scoring opportunity; resolve readiness before outreach.`
        : `${recency} observed evidence may change the commercial thesis; inspect before changing course.`,
  };
}

export function rankPipelineChange({ previousStage, stage, occurredAt, opportunityScore = 0, nextActionDue = null, now = Date.now() }) {
  if (!validEventTime(occurredAt, now)) return { materiality: 0, band: 'monitor', reason: 'Activity date is missing, invalid or in the future; verify the recorded history before prioritizing.' };
  const closed = ['won', 'lost'].includes(String(stage || '').toLowerCase());
  const stageChanged = previousStage !== stage;
  const base = stageChanged ? (STAGE_WEIGHTS[String(stage || '').toLowerCase()] ?? 14) : 8;
  const scorePoints = Math.round(clamp(Number(opportunityScore) || 0, 0, 100) / 12.5);
  const duePoints = !closed && actionIsDue(nextActionDue, now) ? 16 : 0;
  const materiality = clamp(base + freshnessPoints(occurredAt, now) + scorePoints + duePoints, 0, 100);

  return {
    materiality,
    band: materiality >= 65 ? 'act_now' : materiality >= 45 ? 'review' : 'monitor',
    reason: closed
      ? 'Pipeline outcome recorded; review the history without treating this closed account as pending due work.'
      : duePoints
      ? 'Pipeline context changed and the recorded next action is due now.'
      : stageChanged
        ? 'Pipeline stage changed; confirm the next action still matches the opportunity.'
        : 'The operator changed the next action; review only if it affects today’s priorities.',
  };
}
