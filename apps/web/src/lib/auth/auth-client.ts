'use client';

import { createAuthClient } from 'better-auth/react';
import {
  emailOTPClient,
  inferAdditionalFields,
  usernameClient,
} from 'better-auth/client/plugins';
import type { auth } from '@critiq/auth';

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    usernameClient({ displayUsername: false }),
    inferAdditionalFields<typeof auth>(),
  ],
});
