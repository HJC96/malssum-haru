import { describe, expect, it } from 'vitest';
import { localVisitCounter } from './localVisitCounter';

describe('localVisitCounter', () => {
  it('increments cumulatively for each page-load POST during one dev-server run', () => {
    let handler: any;
    const plugin = localVisitCounter();
    (plugin.configureServer as unknown as (server: any) => void)({
      middlewares: { use: (_path: string, registered: unknown) => { handler = registered; } },
    });
    expect(handler).toBeDefined();

    const post = () => {
      const state = {
        statusCode: 0,
        body: '',
        headers: new Map<string, string>(),
        setHeader(name: string, value: string) { this.headers.set(name, value); },
        end(value: string) { this.body = value; },
      };
      handler({ method: 'POST' }, state, () => { throw new Error('POST should be handled'); });
      return state;
    };

    expect(JSON.parse(post().body)).toEqual({ count: 1 });
    expect(JSON.parse(post().body)).toEqual({ count: 2 });
  });

  it('passes non-POST methods through without incrementing', () => {
    let handler: any;
    const plugin = localVisitCounter();
    (plugin.configureServer as unknown as (server: any) => void)({
      middlewares: { use: (_path: string, registered: unknown) => { handler = registered; } },
    });
    let nextCalls = 0;
    handler({ method: 'GET' }, undefined, () => { nextCalls += 1; });
    expect(nextCalls).toBe(1);
  });
});
