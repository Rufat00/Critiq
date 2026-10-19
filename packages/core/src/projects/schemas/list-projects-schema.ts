import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination/pagination';
export const listProjectsSchema = z.object({
  pagination: paginationSchema.default({ page: 1, pageSize: 25 }),
  filters: z.object({ trackId: z.string().trim().min(1).max(100).nullable() }),
  search: z
    .string()
    .max(200)
    .default('')
    .transform((value) => value.trim().replace(/\s+/g, ' ')),
  sort: z.enum(['name']).default('name'),
});
