import { handleApi } from '../../server/api';
import type { Env } from '../../server/types';

export const onRequest = (context: { request: Request; env: Env }) => handleApi(context.request, context.env);
