import { AppError, AppErrorCode } from '../../shared/errors';

export const DEVPOST_COLUMNS = {
  name: 'Project Title',
  description: 'About The Project',
  submissionUrl: 'Submission Url',
  repositoryUrl: "Enter Your Project's Github",
  demoUrl: 'Video Demo Link',
  track: 'Track',
  challenges: 'Opt-In Prizes',
  status: 'Project Status',
} as const;

function invalid(message: string): never {
  throw new AppError(AppErrorCode.VALIDATION_ERROR, message, {
    csv: [message],
  });
}

// RFC 4180 quoting, escaped quotes, CRLF, embedded newlines, and UTF-8 BOM.
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const pushRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    if (rows.length > 501) invalid('Import up to 500 projects at a time.');
    row = [];
    cell = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      closed = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (closed) {
      if (!/\s/u.test(ch))
        invalid(
          'Unexpected text after a closing quote. Check the CSV formatting.',
        );
    } else if (ch === '"')
      invalid(
        'Quotes inside a CSV value must be escaped as two double quotes.',
      );
    else cell += ch;
  }
  if (quoted)
    invalid('A quoted CSV value is not closed. Check the CSV formatting.');
  if (cell || row.length || closed) pushRow();
  return rows;
}

export function parseDevpostProject(row: Record<string, string>) {
  const submissionUrl = row[DEVPOST_COLUMNS.submissionUrl]?.trim() || '';
  return {
    name: row[DEVPOST_COLUMNS.name]?.trim() || '',
    description: row[DEVPOST_COLUMNS.description]?.trim() || '',
    submissionUrl,
    externalId:
      submissionUrl.match(/\/submissions\/(\d+)(?:-|\/|$)/)?.[1] ?? null,
    repositoryUrl: row[DEVPOST_COLUMNS.repositoryUrl]?.trim() || '',
    demoUrl: row[DEVPOST_COLUMNS.demoUrl]?.trim() || '',
    trackName: row[DEVPOST_COLUMNS.track]?.trim() || null,
    challengeNames: (row[DEVPOST_COLUMNS.challenges] || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    isSubmitted:
      row[DEVPOST_COLUMNS.status]?.trim().startsWith('Submitted') ?? false,
  };
}

export function parseProjectCsv(csv: string, format: 'devpost' | 'csv') {
  const rows = parseCsv(csv);
  if (!rows.length) invalid('This file has no project rows.');
  const headers: string[] = Object.values(DEVPOST_COLUMNS);
  let columns = headers;
  if (format === 'devpost') {
    columns = rows.shift()!.map((value) => value.trim());
    if (new Set(columns).size !== columns.length)
      invalid('The CSV has duplicate column headers.');
    const missing = headers.filter((header) => !columns.includes(header));
    if (missing.length)
      invalid(`Missing Devpost columns: ${missing.join(', ')}.`);
  } else if (
    rows[0]!.length === headers.length &&
    rows[0]!.every((value, index) => value.trim() === headers[index])
  ) {
    invalid(
      'Critiq CSV files must not include a header row. Use the downloadable example.',
    );
  }
  if (!rows.length) invalid('This file has no project rows.');
  if (rows.length > 500) invalid('Import up to 500 projects at a time.');
  return rows.map((row, index) => {
    const rowNumber = index + (format === 'devpost' ? 2 : 1);
    if (row.length !== columns.length)
      invalid(
        `Row ${rowNumber}: expected ${columns.length} columns, found ${row.length}. Quote values containing commas.`,
      );
    return {
      ...parseDevpostProject(
        Object.fromEntries(columns.map((column, i) => [column, row[i]!])),
      ),
      rowNumber,
    };
  });
}
