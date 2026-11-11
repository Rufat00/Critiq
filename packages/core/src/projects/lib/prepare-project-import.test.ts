import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { prepareProjectImport } = await import('./prepare-project-import');
const { DEVPOST_COLUMNS } = await import('./parse-project-csv');

const ctx = {
  hackathonId: 'event',
  db: {
    judgingCategory: {
      findMany: async () => [
        {
          kind: 'OVERALL',
          name: 'Overall',
          track: { id: 'overall-track' },
          challenge: null,
        },
        {
          kind: 'TRACK',
          name: 'Beginner track',
          track: { id: 'beginner' },
          challenge: null,
        },
        {
          kind: 'CHALLENGE',
          name: 'Best API',
          track: null,
          challenge: {
            id: 'api',
            allowedTracks: [{ trackId: 'overall-track' }],
          },
        },
        {
          kind: 'CHALLENGE',
          name: 'Beginner prize',
          track: null,
          challenge: {
            id: 'restricted',
            allowedTracks: [{ trackId: 'beginner' }],
          },
        },
      ],
    },
    project: { findMany: async () => [] },
  },
} as unknown as AppContext;
const devpost = (prizes: string, track = '') =>
  `${Object.values(DEVPOST_COLUMNS).join(',')}\nProject,,,,,${track},"${prizes}",Submitted`;

test('Devpost ignores extra prizes and track names while retaining matched challenges once', async () => {
  const result = await prepareProjectImport(ctx, {
    format: 'devpost',
    csv: devpost('Extra sponsor prize, BEST API, Beginner track, Best API'),
  });
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0]!.trackId, 'overall-track');
  assert.deepEqual(result.projects[0]!.challengeIds, ['api']);
});

test('Devpost imports projects when none of their opt-in prizes exist in Critiq', async () => {
  const result = await prepareProjectImport(ctx, {
    format: 'devpost',
    csv: devpost('Extra prize, Another prize'),
  });
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0]!.trackId, 'overall-track');
  assert.deepEqual(result.projects[0]!.challengeIds, []);
});

test('existing challenge eligibility and unknown tracks remain enforced for Devpost', async () => {
  await assert.rejects(
    prepareProjectImport(ctx, {
      format: 'devpost',
      csv: devpost('Beginner prize'),
    }),
    { code: 'VALIDATION_ERROR' },
  );
  await assert.rejects(
    prepareProjectImport(ctx, {
      format: 'devpost',
      csv: devpost('Extra prize', 'Unknown track'),
    }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('Critiq CSV still reports unknown challenges', async () => {
  await assert.rejects(
    prepareProjectImport(ctx, {
      format: 'csv',
      csv: 'Project,,,,,,Unknown prize,Submitted',
    }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('Devpost skips hidden submissions and drafts before validation or deduplication', async () => {
  const result = await prepareProjectImport(ctx, {
    format: 'devpost',
    csv: [
      Object.values(DEVPOST_COLUMNS).join(','),
      'Project,,,,,Unknown track,,Submitted (Hidden)',
      'Draft project,,,,,Unknown track,,Draft',
      'Project,,,,,,,Submitted',
    ].join('\n'),
  });
  assert.equal(result.totalRows, 3);
  assert.equal(result.notSubmitted, 2);
  assert.equal(result.duplicates, 0);
  assert.deepEqual(
    result.projects.map((project) => project.name),
    ['Project'],
  );
});
