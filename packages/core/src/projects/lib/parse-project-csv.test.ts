import assert from 'node:assert/strict';
import { test } from 'node:test';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { DEVPOST_COLUMNS, parseCsv, parseDevpostProject, parseProjectCsv } =
  await import('./parse-project-csv');
const { createProjectSchema } =
  await import('../schemas/create-project-schema');
const { importProjectsSchema } =
  await import('../schemas/import-projects-schema');

const headers = Object.values(DEVPOST_COLUMNS).join(',');
test('Devpost exact headers map submission fields, external ID, track, opt-in prizes and submitted status', () => {
  const row = parseProjectCsv(
    `\uFEFF${headers}\r\n"My, Project","About\nline two",https://devpost.com/submissions/12345-demo,https://github.com/team/repo,https://example.com/demo,AI,"Prize A, Prize B",Submitted (complete)\r\n`,
    'devpost',
  )[0]!;
  assert.equal(row.name, 'My, Project');
  assert.equal(row.description, 'About\nline two');
  assert.equal(row.externalId, '12345');
  assert.equal(row.repositoryUrl, 'https://github.com/team/repo');
  assert.equal(row.demoUrl, 'https://example.com/demo');
  assert.equal(row.trackName, 'AI');
  assert.deepEqual(row.challengeNames, ['Prize A', 'Prize B']);
  assert.equal(row.isSubmitted, true);
  assert.equal(row.rowNumber, 2);
});
test('Devpost columns may be reordered or include extra fields; Critiq CSV is headerless and positional', () => {
  const reversed = Object.values(DEVPOST_COLUMNS).reverse();
  const values = [
    'Submitted',
    '',
    'Overall',
    '',
    '',
    '',
    'Description',
    'Name',
  ];
  assert.equal(
    parseProjectCsv(
      `${reversed.join(',')},Extra\n${values.join(',')},unused`,
      'devpost',
    )[0]!.name,
    'Name',
  );
  const row = parseProjectCsv('Track,Description,,,,,,Submitted', 'csv')[0]!;
  assert.equal(row.name, 'Track');
  assert.equal(row.trackName, null);
  assert.equal(row.isSubmitted, true);
  assert.throws(
    () => parseProjectCsv(`${headers}\n${values.join(',')}`, 'csv'),
    { code: 'VALIDATION_ERROR' },
  );
});
test('CSV handles escaped quotes, blank rows, BOM, trailing empty fields and CRLF', () => {
  assert.deepEqual(
    parseCsv('\uFEFF\r\n"Say ""hello""",,"one\r\ntwo",\r\n\r\n'),
    [['Say "hello"', '', 'one\r\ntwo', '']],
  );
  assert.equal(
    parseDevpostProject({ 'Project Status': 'In progress' }).isSubmitted,
    false,
  );
  assert.equal(
    parseDevpostProject({ 'Project Status': 'Submitted' }).isSubmitted,
    true,
  );
});
test('bad quotes, incorrect widths, missing/duplicate headers, empty files and too many rows fail safely', () => {
  for (const [csv, format] of [
    ['"unclosed', 'csv'],
    ['"closed"extra,,,,,,,Submitted', 'csv'],
    ['a"b,,,,,,,Submitted', 'csv'],
    ['Name,Submitted', 'csv'],
    ['Project Title,Project Status\nName,Submitted', 'devpost'],
    [`${headers},Track\n,,,,,,,,`, 'devpost'],
    ['', 'csv'],
    [headers, 'devpost'],
    [
      Array.from({ length: 501 }, () => 'Name,,,,,,,Submitted').join('\n'),
      'csv',
    ],
  ] as const)
    assert.throws(() => parseProjectCsv(csv, format), {
      code: 'VALIDATION_ERROR',
    });
});
test('project validation rejects unsafe URLs, empty titles, oversized descriptions and UTF-8 uploads over 1 MB', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,bad',
    'ftp://example.com',
    'not a URL',
  ])
    assert.equal(
      createProjectSchema.safeParse({
        name: 'Project',
        trackId: 'overall-track',
        demoUrl: url,
      }).success,
      false,
    );
  assert.equal(
    createProjectSchema.safeParse({ name: '  ', trackId: 'overall-track' })
      .success,
    false,
  );
  assert.equal(
    createProjectSchema.safeParse({ name: 'Project' }).success,
    false,
  );
  assert.equal(
    createProjectSchema.safeParse({ name: 'Project', trackId: null }).success,
    false,
  );
  assert.equal(
    createProjectSchema.safeParse({
      trackId: 'overall-track',
      name: 'Project',
      description: 'x'.repeat(20001),
    }).success,
    false,
  );
  assert.equal(
    importProjectsSchema.safeParse({ format: 'csv', csv: 'é'.repeat(500001) })
      .success,
    false,
  );
  assert.equal(
    createProjectSchema.parse({
      trackId: 'overall-track',
      name: ' Project ',
      submissionUrl: ' https://example.com ',
    }).submissionUrl,
    'https://example.com',
  );
});

test('hidden submissions and drafts are excluded while visible submissions remain eligible', () => {
  for (const status of [
    'Submitted (Hidden)',
    'Draft',
    ' Submitted (Hidden) ',
    'submitted (hidden)',
    ' Draft ',
    '',
  ]) {
    assert.equal(
      parseDevpostProject({ 'Project Status': status }).isSubmitted,
      false,
      status,
    );
  }
  for (const status of ['Submitted', 'Submitted (complete)', ' Submitted ']) {
    assert.equal(
      parseDevpostProject({ 'Project Status': status }).isSubmitted,
      true,
      status,
    );
  }
});
