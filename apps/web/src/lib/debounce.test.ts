import assert from 'node:assert/strict';
import { test } from 'node:test';
import { debounce } from './debounce';

test('typing waits for the quiet period and uses only the latest arguments', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const searches: string[] = [];
  const search = debounce((value: string) => searches.push(value), 300);
  search('j');
  context.mock.timers.tick(200);
  search('judge');
  context.mock.timers.tick(299);
  assert.deepEqual(searches, []);
  assert.equal(search.isPending(), true);
  context.mock.timers.tick(1);
  assert.deepEqual(searches, ['judge']);
  assert.equal(search.isPending(), false);
});

test('cancellation prevents a delayed callback and allows subsequent searches', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const searches: string[] = [];
  const search = debounce((value: string) => searches.push(value), 300);
  search('cancelled');
  search.cancel();
  assert.equal(search.isPending(), false);
  context.mock.timers.tick(300);
  assert.deepEqual(searches, []);
  search('');
  context.mock.timers.tick(300);
  assert.deepEqual(searches, ['']);
});
