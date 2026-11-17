export const ordinalRatingOptions = [
  { value: 1, code: 'DEFINITELY_NO', label: 'Definitely should not win' },
  { value: 2, code: 'PROBABLY_NO', label: 'Probably should not win' },
  { value: 3, code: 'UNSURE', label: 'Unsure / needs comparison' },
  { value: 4, code: 'PROBABLY_YES', label: 'Probably should win' },
  { value: 5, code: 'DEFINITELY_YES', label: 'Definitely should win' },
] as const;
