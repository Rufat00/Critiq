import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination/pagination';

export const listJudgesSchema = z.object({
  pagination: paginationSchema.default({ page: 1, pageSize: 25 }),
  filters: z.object({ categoryId: z.string().min(1).max(100) }),
  search: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value.replace(/\s+/gu, ' '))
    .default(''),
});
export type ListJudgesInput = z.input<typeof listJudgesSchema>;
