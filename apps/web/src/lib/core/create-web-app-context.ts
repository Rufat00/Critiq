import {
  createUserContext,
  type AppContext,
  type AppSource,
} from '@critiq/core/context';
import { headers } from 'next/headers';
import { requireAuthContext } from '@/lib/auth/auth-context';

export async function createWebAppContext(
  source: Extract<AppSource, 'web-action' | 'web-page'> = 'web-action',
): Promise<AppContext> {
  const [authContext, requestHeaders] = await Promise.all([
    requireAuthContext(),
    headers(),
  ]);
  const forwardedFor = requestHeaders.get('x-forwarded-for');

  return createUserContext({
    userId: authContext.user.id,
    source,
    request: {
      requestId: requestHeaders.get('x-request-id') ?? undefined,
      ipAddress:
        forwardedFor?.split(',')[0]?.trim() ||
        requestHeaders.get('x-real-ip') ||
        null,
      userAgent: requestHeaders.get('user-agent'),
    },
  });
}
