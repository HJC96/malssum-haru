import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimate } from './current-model.mjs';

test('current-product model counts one uncached visit write per page load and daily content transfer', () => {
  const small = estimate({ dailyViews: 100, mbPerView: 1 });
  const large = estimate({ dailyViews: 1000, mbPerView: 3 });
  assert.equal(small.views, 3000);
  assert.equal(large.views, 30000);
  assert.equal(large.transferredGb, 30000 * 3 / 1024);
  assert.ok(large.items.dynamodbWrites > small.items.dynamodbWrites);
  assert.ok(large.items.cloudfrontData > small.items.cloudfrontData);
  assert.equal(large.items.scheduler, 0);
});

test('always-free estimate never exceeds list price for the same scenario', () => {
  const scenario = { dailyViews: 10000, mbPerView: 6 };
  assert.ok(estimate(scenario, { useAlwaysFree: true }).usd <= estimate(scenario).usd);
  assert.throws(() => estimate({ dailyViews: -1, mbPerView: 3 }), /nonnegative/);
});
