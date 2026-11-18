import { getJudgeCurrentAssignment } from '@critiq/core/judging';
import { createWebAppContext } from '@/lib/core/create-web-app-context';
export async function getJudgeWorkspace() {
  return getJudgeCurrentAssignment(await createWebAppContext('web-page'), {});
}
