import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCoverageStatus } from './get-coverage-status';
test('coverage uses completed evidence and gives minimum, target and cap distinct boundaries', () => {
  assert.equal(getCoverageStatus(0, 3, 6, 9), 'BELOW_MINIMUM');
  assert.equal(getCoverageStatus(2, 3, 6, 9), 'BELOW_MINIMUM');
  assert.equal(getCoverageStatus(3, 3, 6, 9), 'BELOW_TARGET');
  assert.equal(getCoverageStatus(5, 3, 6, 9), 'BELOW_TARGET');
  assert.equal(getCoverageStatus(6, 3, 6, 9), 'TARGET_REACHED');
  assert.equal(getCoverageStatus(7, 3, 6, 9), 'TARGET_REACHED');
  assert.equal(getCoverageStatus(8, 3, 6, 9), 'NEAR_MAXIMUM');
  assert.equal(getCoverageStatus(9, 3, 6, 9), 'NEAR_MAXIMUM');
});
test('a target adjacent to the maximum remains blue until coverage advances', () => {
  assert.equal(getCoverageStatus(8, 3, 8, 9), 'TARGET_REACHED');
  assert.equal(getCoverageStatus(9, 3, 9, 9), 'NEAR_MAXIMUM');
  assert.equal(getCoverageStatus(3, 3, 3, 9), 'TARGET_REACHED');
});
