import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScoringReceipt, compareScoringReceipts, SCORING_CONTRACT_VERSION } from '../lib/scoring-history.js';

const fitInput = { shopify:true, shopifyPlus:true, country:'US', dtc:true, employeeCount:120, industry:'beauty', estimatedAgencyCapacity:true };

test('scoring receipt is deterministic and preserves evidence provenance', () => {
  const args = {
    fitInput,
    needInput:{ cro:0.8, performance:0.5 },
    intentInput:{ jobPostedDaysAgo:3, multipleEcommerceHires:true },
    evidenceConfidence:0.9,
    evidenceRefs:[{ id:'signal-1', kind:'signal', observedAt:'2026-10-08T12:00:00Z' }],
  };
  const first = buildScoringReceipt(args);
  const second = buildScoringReceipt(args);
  assert.deepEqual(first, second);
  assert.equal(first.scoringContractVersion, SCORING_CONTRACT_VERSION);
  assert.deepEqual(first.evidenceRefs, [{ id:'signal-1', kind:'signal', observedAt:'2026-10-08T12:00:00Z' }]);
});

test('score comparison explains which deterministic components changed', () => {
  const previous = buildScoringReceipt({ fitInput, needInput:{ cro:0.2 }, intentInput:{}, evidenceConfidence:0.8 });
  const current = buildScoringReceipt({ fitInput, needInput:{ cro:0.9 }, intentInput:{ jobPostedDaysAgo:2 }, evidenceConfidence:0.9 });
  const change = compareScoringReceipts(previous, current);
  assert.ok(change.delta > 0);
  assert.equal(change.direction, 'up');
  assert.ok(change.changedComponents.some((component) => component.key === 'need'));
  assert.ok(change.changedComponents.some((component) => component.key === 'intent'));
  assert.match(change.summary, /rose/);
});

test('receipt filters malformed evidence references instead of inventing provenance', () => {
  const receipt = buildScoringReceipt({ fitInput, needInput:{}, intentInput:{}, evidenceRefs:[{ kind:'signal' }, { id:'x' }] });
  assert.deepEqual(receipt.evidenceRefs, []);
});
