import {
  getAdminJudgingDashboard,
  getJudgingSetup,
} from '@critiq/core/judging';
import { createWebAppContext } from '@/lib/core/create-web-app-context';
export async function getDashboard() {
  return getAdminJudgingDashboard(await createWebAppContext('web-page'), {});
}
export async function getSetup() {
  return getJudgingSetup(await createWebAppContext('web-page'), {});
}
