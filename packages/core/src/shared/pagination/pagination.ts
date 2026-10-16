import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z
    .union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])
    .default(25),
});

export function paginationMetadata(
  page: number,
  pageSize: number,
  totalItems: number,
) {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: totalItems > 0 && page < totalPages,
    hasPreviousPage: totalItems > 0 && page > 1,
  };
}
