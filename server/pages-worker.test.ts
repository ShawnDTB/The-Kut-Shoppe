import { describe, expect, it } from 'vitest';
import pages from './pages-worker';
describe('Pages account service boundary', () => {
  const env = { ASSETS: { fetch: async () => new Response('site') }, API: { fetch: async (request: Request) => new Response(request.url, { headers: { 'Set-Cookie': '__Host-kut-session=test; Secure; HttpOnly; Path=/' } }) } };
  it('preserves the production request and session response through the binding', async () => {
    const response = await pages.fetch(new Request('https://www.thekutshoppe.com/api/v1/me'), env);
    expect(await response.text()).toBe('https://www.thekutshoppe.com/api/v1/me');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  });
  it.each(['the-kut-shoppe.pages.dev', 'preview.the-kut-shoppe.pages.dev', 'thekutshoppe.com'])('does not expose production accounts at %s', async hostname => {
    const response = await pages.fetch(new Request(`https://${hostname}/api/v1/auth/register`, { method: 'POST' }), env);
    expect(response.status).toBe(503);
  });
  it('redirects the apex to the canonical website', async () => {
    const response = await pages.fetch(new Request('https://thekutshoppe.com/book?barber=any'), env);
    expect(response.headers.get('Location')).toBe('https://www.thekutshoppe.com/book?barber=any');
  });
  it('keeps preview HTML out of search engines', async () => {
    const response = await pages.fetch(new Request('https://the-kut-shoppe.pages.dev/shop'), env);
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
  });
});
