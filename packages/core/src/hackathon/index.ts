export { getHackathonHome } from './queries/get-hackathon-home';
export { setSetupCompletion } from './mutations/set-setup-completion';
export { markHackathonReady } from './mutations/mark-hackathon-ready';
export { returnHackathonToDraft } from './mutations/return-hackathon-to-draft';
export type {
  SetupCompletionInput,
  SetupSection,
} from './schemas/setup-completion-schema';
export type { MarkReadyInput } from './schemas/mark-ready-schema';
export type { HackathonSetupSummary } from './lib/build-setup-summary';
export {
  getHackathonSettings,
  type HackathonSettings,
} from './queries/get-hackathon-settings';
export { updateHackathonSettings } from './mutations/update-hackathon-settings';
export type { UpdateHackathonSettingsInput } from './schemas/update-hackathon-settings-schema';
