import type { CreateProjectInput } from '../schemas/create-project-schema';

export function projectData(input: CreateProjectInput) {
  const submissionUrl = input.submissionUrl || null;
  return {
    name: input.name.trim(),
    description: input.description || null,
    submissionUrl,
    repositoryUrl: input.repositoryUrl || null,
    demoUrl: input.demoUrl || null,
    externalId:
      submissionUrl?.match(/\/submissions\/(\d+)(?:-|\/|$)/)?.[1] ?? null,
    trackId: input.trackId ?? null,
  };
}
