import { getHackathonSettings } from '@critiq/core/hackathon';
import { createWebAppContext } from '@/lib/core/create-web-app-context';

export async function getSettingsPage() {
  return getHackathonSettings(await createWebAppContext('web-page'), {});
}
