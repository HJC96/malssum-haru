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

/** One UpdateItem atomically increments the site's lifetime page-load counter. */
export function incrementRequest(tableName) {
  if (!tableName) throw new Error('VISIT_TABLE_NAME is required');
  return {
    TableName: tableName,
    Key: { id: { S: 'site#total' } },
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
    throw new Error('DynamoDB did not return a valid cumulative visit count');
  }
  return count;
}

/** Dependency injection keeps unit tests offline without storing visit identifiers. */
export function createHandler(increment) {
  return async (event) => {
    const method = event?.requestContext?.http?.method;
    const path = event?.rawPath;
    if (path !== PATH) return response(404, { error: 'not_found' });
    if (method !== 'POST') return response(405, { error: 'method_not_allowed' }, { Allow: 'POST' });

    try {
      const count = await increment();
      if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid visit count');
      return response(200, { count });
    } catch {
      // Do not log request headers, IPs, user agents, or any client-supplied data.
      return response(503, { error: 'visit_count_unavailable' });
    }
  };
}

let dynamoClient;

export const handler = createHandler(async () => {
  // Lambda's managed Node.js runtime includes AWS SDK v3; load it only on valid POSTs.
  const { DynamoDBClient, UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');
  dynamoClient ??= new DynamoDBClient({});
  const result = await dynamoClient.send(new UpdateItemCommand(incrementRequest(process.env.VISIT_TABLE_NAME)));
  return countFromUpdate(result);
});
