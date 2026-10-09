import test from 'node:test';
import assert from 'node:assert/strict';
import { rankObservedChange, rankPipelineChange } from '../lib/change-intelligence.js';

const now = new Date('2026-10-08T16:00:00Z').getTime();

test('recent high-confidence signal on a ready account becomes act now', () => {
  const result = rankObservedChange({
    signalType: 'ecommerce_hiring',
    confidence: 0.92,
    occurredAt: '2026-10-08T12:00:00Z',
    opportunityScore: 84,
    ready: true,
    now,
  });
  assert.equal(result.band, 'act_now');
  assert.ok(result.materiality >= 75);
  assert.match(result.reason, /verified primary buyer/);
});

test('weak unknown signal does not manufacture urgency', () => {
  const result = rankObservedChange({
    signalType: 'unknown',
    confidence: 0.2,
    occurredAt: '2026-10-02T12:00:00Z',
    opportunityScore: 35,
    ready: false,
    now,
  });
  assert.equal(result.band, 'monitor');
  assert.ok(result.materiality < 55);
});

test('due pipeline work can become act now without pretending it is evidence', () => {
  const result = rankPipelineChange({
    previousStage: 'engaged',
    stage: 'meeting',
    occurredAt: '2026-10-08T10:00:00Z',
    opportunityScore: 78,
    nextActionDue: '2026-10-08',
    now,
  });
  assert.equal(result.band, 'act_now');
  assert.match(result.reason, /due now/);
});


test('invalid and future observations cannot manufacture urgency', () => {
  for (const occurredAt of [null, '', 'invalid', '2026-10-09T00:00:00Z']) {
    for (const rank of [rankObservedChange, rankPipelineChange]) {
      const result = rank({ signalType: 'leadership_change', confidence: 1, ready: true, opportunityScore: 100, stage: 'proposal', previousStage: 'meeting', nextActionDue: '2026-10-08', occurredAt, now });
      assert.equal(result.band, 'monitor');
      assert.equal(result.materiality, 0);
    }
  }
});

test('due credit uses valid calendar days and excludes tomorrow', () => {
  const input = { previousStage: 'engaged', stage: 'meeting', occurredAt: '2026-10-08T10:00:00Z', opportunityScore: 78, now };
  const baseline = rankPipelineChange(input).materiality;
  for (const nextActionDue of ['2026-10-07', '2026-10-08']) {
    assert.equal(rankPipelineChange({ ...input, nextActionDue }).materiality, baseline + 16);
  }
  for (const nextActionDue of ['2026-10-09', '2026-02-30', 'tomorrow', '2026-10-08T12:00:00Z']) {
    const result = rankPipelineChange({ ...input, nextActionDue });
    assert.equal(result.materiality, baseline);
    assert.doesNotMatch(result.reason, /due now/);
  }
});

test('closed outcomes do not receive due-work urgency', () => {
  for (const stage of ['won', 'lost']) {
    const input = { previousStage: 'proposal', stage, occurredAt: '2026-10-08T10:00:00Z', opportunityScore: 90, now };
    assert.equal(rankPipelineChange({ ...input, nextActionDue: '2026-10-07' }).materiality, rankPipelineChange(input).materiality);
    assert.match(rankPipelineChange(input).reason, /closed account/);
  }
});

test('older evidence is not described as recent or outreach-eligible', () => {
  const result = rankObservedChange({ signalType: 'leadership_change', confidence: 1, ready: true, opportunityScore: 100, occurredAt: '2026-09-01T00:00:00Z', now });
  assert.match(result.reason, /^Older/);
  assert.doesNotMatch(result.reason, /outreach-ready/);
});
