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
    title: 'Organize your judging categories',
    description:
      'Learn how overall judging, tracks, and challenges fit together.',
  },
  projects: {
    ...placeholder,
    title: 'Prepare your projects',
    description:
      'Get project entries and presentation locations ready for your judges.',
  },
  judges: {
    ...placeholder,
    title: 'Prepare your judges',
    description:
      'Set up judge accounts and check their category access before judging starts.',
  },
} as const;
export type GuideVideo = (typeof videos)[keyof typeof videos];
