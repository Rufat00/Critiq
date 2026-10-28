import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination/pagination';
export const listRoomsSchema = z.object({
  pagination: paginationSchema.default({ page: 1, pageSize: 25 }),
  search: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s.replace(/\s+/g, ' '))
    .default(''),
});
