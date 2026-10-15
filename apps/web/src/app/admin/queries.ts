import { cache } from 'react';
import { getHackathonHome } from '@critiq/core/hackathon';
import { createWebAppContext } from '@/lib/core/create-web-app-context';

export const getAdminHome = cache(async () =>
  getHackathonHome(await createWebAppContext('web-page'), {}),
);
