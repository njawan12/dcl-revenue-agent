import { DEFAULT_SCORING_CONFIG, qualifyOpportunity, scoreFit, scoreIntent, scoreNeed, scoreOpportunity } from './scoring.js';

export const SCORING_CONTRACT_VERSION = 'opportunity-v1';

function compactEvidenceRefs(refs = []) {
  return refs
    .filter((ref) => ref?.id && ref?.kind)
    .map((ref) => ({ id: String(ref.id), kind: String(ref.kind), observedAt: ref.observedAt ?? null }));
}

export function buildScoringReceipt({ fitInput, needInput, intentInput, evidenceConfidence = 1, evidenceRefs = [], config = {} }) {
  const fit = scoreFit(fitInput, config);
  const need = scoreNeed(needInput, config);
  const intent = scoreIntent(intentInput, config);
  const opportunity = scoreOpportunity({ fit, need, intent, evidenceConfidence }, config);
  const qualification = qualifyOpportunity({ fit, need, intent, opportunity }, config);

  return {
    scoringContractVersion: SCORING_CONTRACT_VERSION,
    scores: { fit, need, intent, opportunity },
    tier: qualification.tier,
    evidenceConfidence: Math.max(0, Math.min(1, Number(evidenceConfidence) || 0)),
    evidenceRefs: compactEvidenceRefs(evidenceRefs),
    inputs: { fit: fitInput, need: needInput, intent: intentInput },
    explanation: {
      qualificationReason: qualification.reason,
      components: [
        { key: 'fit', score: fit, meaning: 'ICP and commerce-model fit' },
        { key: 'need', score: need, meaning: 'Observed service-need evidence' },
        { key: 'intent', score: intent, meaning: 'Observed timing and buying-intent evidence' },
      ],
    },
    configSnapshot: {
      ...DEFAULT_SCORING_CONFIG,
      ...config,
      fitWeights: { ...DEFAULT_SCORING_CONFIG.fitWeights, ...(config.fitWeights ?? {}) },
      needWeights: { ...DEFAULT_SCORING_CONFIG.needWeights, ...(config.needWeights ?? {}) },
      intentWeights: { ...DEFAULT_SCORING_CONFIG.intentWeights, ...(config.intentWeights ?? {}) },
      opportunityWeights: { ...DEFAULT_SCORING_CONFIG.opportunityWeights, ...(config.opportunityWeights ?? {}) },
      thresholds: { ...DEFAULT_SCORING_CONFIG.thresholds, ...(config.thresholds ?? {}) },
    },
  };
}

export function compareScoringReceipts(previous, current) {
  if (!current) return null;
  if (!previous) return {
    direction: 'initial',
    delta: null,
    changedComponents: [],
    summary: `Initial ${current.scores.opportunity} opportunity score recorded.`,
  };

  const delta = current.scores.opportunity - previous.scores.opportunity;
  const changedComponents = ['fit', 'need', 'intent']
    .map((key) => ({ key, from: previous.scores[key], to: current.scores[key], delta: current.scores[key] - previous.scores[key] }))
    .filter((component) => component.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    delta,
    changedComponents,
    summary: delta === 0
      ? `Opportunity score held at ${current.scores.opportunity}.`
      : `Opportunity score ${delta > 0 ? 'rose' : 'fell'} ${Math.abs(delta)} points to ${current.scores.opportunity}.`,
  };
}
