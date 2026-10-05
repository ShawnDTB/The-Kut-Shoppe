import { publicAssets, type AssetEnv } from './public-assets';
interface PagesEnv extends AssetEnv { API?: { fetch(request: Request): Promise<Response> } }
export default {
  async fetch(request: Request, env: PagesEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      // Only the production hostname can use the production account service.
      // Preview deployments never inherit production identity or database access.
      if (url.hostname !== 'www.thekutshoppe.com' || !env.API) {
        return Response.json({ enabled: false, bookingEnabled: false, turnstileSiteKey: '', message: 'Account access is not open on this address.' }, { status: url.pathname === '/api/v1/config' && request.method === 'GET' ? 200 : 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
      }
      return env.API.fetch(request);
    }
    return publicAssets(request, env);
  },
};
