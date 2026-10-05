export interface AssetEnv { ASSETS: { fetch(request: Request): Promise<Response> } }
export async function publicAssets(request: Request, env: AssetEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'thekutshoppe.com') {
      url.hostname = 'www.thekutshoppe.com'; url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    const aliases: Record<string, string> = { '/about': '/team', '/products': '/shop', '/login': '/account', '/booking': '/book', '/staff/login': '/account' };
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (aliases[path]) { url.pathname = aliases[path]; return Response.redirect(url.href, 308); }
    // Serve the same holding page for old product, booking and staff deep links.
    if (path.startsWith('/shop/')) url.pathname = '/shop';
    else if (path.startsWith('/book/')) url.pathname = '/book';
    else if (path.startsWith('/account/') || path.startsWith('/staff/') || path.startsWith('/admin/')) url.pathname = '/account';
    const result = await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(result.body, result);
    if (response.headers.get('Content-Type')?.includes('text/html')) response.headers.set('Cache-Control', 'no-cache');
    if (url.hostname.endsWith('.workers.dev') || url.hostname.endsWith('.pages.dev')) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
}
