import { handleApi } from './api';
import { publicAssets, type AssetEnv } from './public-assets';
import type { Env } from './types';
export default {
  async fetch(request: Request, env: Env & AssetEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) return handleApi(request, env);
    return publicAssets(request, env);
  },
};
