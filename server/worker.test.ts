import { describe, expect, it } from 'vitest';
import worker from './worker';
import type { Env } from './types';

describe('public worker routing', () => {
  const env = { ACCOUNTS_ENABLED: 'false', ASSETS: { fetch: async (request: Request) => new Response(new URL(request.url).pathname, { headers: { 'Content-Type': 'text/html' } }) } } as Env & { ASSETS: { fetch(request: Request): Promise<Response> } };
  it.each([['/shop/product/old', '/shop'], ['/book/walk-in?barber=any', '/book'], ['/staff/requests', '/account']])('keeps %s on its public shell', async (path, target) => {
    const result = await worker.fetch(new Request(`https://the-kut-shoppe.shawndtb.workers.dev${path}`), env);
    expect(await result.text()).toBe(target);
    expect(result.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
  it('keeps account writes disabled', async () => {
    const result = await worker.fetch(new Request('https://example.com/api/v1/auth/register', { method: 'POST' }), env);
    expect(result.status).toBe(503);
  });
  it('preserves queries when redirecting the apex', async () => {
    const result = await worker.fetch(new Request('https://thekutshoppe.com/book?barber=any'), env);
    expect(result.status).toBe(308);
    expect(result.headers.get('Location')).toBe('https://www.thekutshoppe.com/book?barber=any');
  });
});
