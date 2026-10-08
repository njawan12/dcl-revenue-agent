import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePipelineInput } from '../lib/pipeline/stages.js';
const valid = {stage:'qualified',nextAction:'Review commerce evidence',due:'2026-10-08',revision:0};
test('accepts a native operator action',()=>assert.equal(validatePipelineInput(valid),null));
test('rejects invalid stages and stale revision inputs',()=>{assert.ok(validatePipelineInput({...valid,stage:'sent'}));assert.ok(validatePipelineInput({...valid,revision:-1}));});
test('requires a next action for due dates and rejects invalid calendar dates',()=>{assert.ok(validatePipelineInput({...valid,nextAction:' '}));for(const due of ['2026-02-30','2026-99-99','tomorrow']) assert.ok(validatePipelineInput({...valid,due}));});
test('bounds operator text',()=>assert.ok(validatePipelineInput({...valid,nextAction:'a'.repeat(1001)})));
