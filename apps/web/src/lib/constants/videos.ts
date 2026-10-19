// Replace each guide independently as the final videos become available.
const placeholder = {
  youtubeId: '2XnidRewtPA',
  url: 'https://youtu.be/2XnidRewtPA',
};

export const videos = {
  setup: {
    ...placeholder,
    title: 'Watch the setup guide',
    description:
      'A walkthrough of the essentials: categories, projects, judges, and your final readiness check.',
  },
  categories: {
    ...placeholder,
    title: 'Tracks & challenges guide',
    description:
      'Learn how to organize tracks, set up challenges, and manage challenges across tracks.',
  },
  trackJudgingMethod: {
    ...placeholder,
    title: 'How to choose a track judging method',
    description:
      'Learn when to use Relational judging or a weighted rubric for your track.',
  },
  challengeJudgingMethod: {
    ...placeholder,
    title: 'How to choose a challenge judging method',
    description:
      'Learn when to use Rating Scale judging or a weighted rubric for your challenge.',
  },
  projects: {
    ...placeholder,
    title: 'Prepare your projects',
    description:
      'Get project entries and presentation locations ready for your judges.',
  },
  devpostImport: {
    ...placeholder,
    title: 'How to import from Devpost',
    description:
      'Export your Devpost projects report and import submitted projects into Critiq.',
  },
  csvImport: {
    ...placeholder,
    title: 'How to import a project CSV',
    description:
      'Prepare the eight project fields and review your import before saving.',
  },
  judges: {
    ...placeholder,
    title: 'Prepare your judges',
    description:
      'Set up judge accounts and check their category access before judging starts.',
  },
} as const;
export type GuideVideo = (typeof videos)[keyof typeof videos];
