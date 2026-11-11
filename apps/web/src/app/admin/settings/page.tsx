import { getSettingsPage } from './queries';
import { SettingsForm } from './components/settings-form';

export default async function Page() {
  return <SettingsForm settings={await getSettingsPage()} />;
}
