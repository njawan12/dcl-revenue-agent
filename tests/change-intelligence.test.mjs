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
  assert.match(result.reason, /outreach-ready/);
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
