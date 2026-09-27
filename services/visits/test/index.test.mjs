import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countFromUpdate, createHandler, incrementRequest } from '../src/index.mjs';

const post = { rawPath: '/api/visits', requestContext: { http: { method: 'POST' } } };

test('site-wide key selects the cumulative counter and one DynamoDB UpdateItem atomically adds one', () => {
  assert.deepEqual(incrementRequest('Visits'), {
    TableName: 'Visits',
    Key: { id: { S: 'site#total' } },
    UpdateExpression: 'ADD #count :one',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':one': { N: '1' } },
    ReturnValues: 'UPDATED_NEW',
  });
  assert.equal(countFromUpdate({ Attributes: { count: { N: '42' } } }), 42);
  assert.throws(() => countFromUpdate({}), /valid cumulative/);
  assert.throws(() => countFromUpdate({ Attributes: { count: { N: '9007199254740992' } } }), /valid cumulative/);
});

test('each POST increments the same site-wide counter and returns no-store JSON without inspecting client data', async () => {
  let count = 0;
  const handle = createHandler(async () => ++count);
  const first = await handle({ ...post, headers: { cookie: 'ignored', 'x-forwarded-for': 'ignored' }, body: 'ignored' });
  const second = await handle(post);
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['Cache-Control'], 'no-store, max-age=0');
  assert.deepEqual(JSON.parse(first.body), { count: 1 });
  assert.deepEqual(JSON.parse(second.body), { count: 2 });
});

test('only POST /api/visits changes the count', async () => {
  let calls = 0;
  const handle = createHandler(async () => ++calls);
  assert.equal((await handle({ rawPath: '/api/else', requestContext: { http: { method: 'POST' } } })).statusCode, 404);
  const get = await handle({ rawPath: '/api/visits', requestContext: { http: { method: 'GET' } } });
  assert.equal(get.statusCode, 405);
  assert.equal(get.headers.Allow, 'POST');
  assert.equal(calls, 0);
});

test('storage failure does not claim a visit and cannot leak request details', async () => {
  const handle = createHandler(async () => { throw new Error('secret'); });
  const result = await handle(post);
  assert.equal(result.statusCode, 503);
  assert.deepEqual(JSON.parse(result.body), { error: 'visit_count_unavailable' });
  assert.doesNotMatch(result.body, /secret/);
});
