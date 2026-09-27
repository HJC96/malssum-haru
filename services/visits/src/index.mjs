const PATH = '/api/visits';
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
};

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

export function dateInKst(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** One UpdateItem atomically increments the counter for a single KST calendar day. */
export function incrementRequest(tableName, day = dateInKst()) {
  if (!tableName) throw new Error('VISIT_TABLE_NAME is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('A KST calendar date is required');
  return {
    TableName: tableName,
    Key: { id: { S: `daily#${day}` } },
    UpdateExpression: 'ADD #count :one',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':one': { N: '1' } },
    ReturnValues: 'UPDATED_NEW',
  };
}

export function countFromUpdate(result) {
  const raw = result?.Attributes?.count?.N;
  const count = Number(raw);
  if (typeof raw !== 'string' || !Number.isSafeInteger(count) || count < 1) {
    throw new Error('DynamoDB did not return a valid daily visit count');
  }
  return count;
}

/** Dependency injection keeps unit tests offline without storing visit identifiers. */
export function createHandler(increment, clock = () => new Date()) {
  return async (event) => {
    const method = event?.requestContext?.http?.method;
    const path = event?.rawPath;
    if (path !== PATH) return response(404, { error: 'not_found' });
    if (method !== 'POST') return response(405, { error: 'method_not_allowed' }, { Allow: 'POST' });

    try {
      const count = await increment(dateInKst(clock()));
      if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid visit count');
      return response(200, { count });
    } catch {
      // Do not log request headers, IPs, user agents, or any client-supplied data.
      return response(503, { error: 'visit_count_unavailable' });
    }
  };
}

let dynamoClient;

export const handler = createHandler(async (day) => {
  // Lambda's managed Node.js runtime includes AWS SDK v3; load it only on valid POSTs.
  const { DynamoDBClient, UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');
  dynamoClient ??= new DynamoDBClient({});
  const result = await dynamoClient.send(new UpdateItemCommand(incrementRequest(process.env.VISIT_TABLE_NAME, day)));
  return countFromUpdate(result);
});
