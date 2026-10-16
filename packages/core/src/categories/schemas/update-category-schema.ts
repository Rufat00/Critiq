import { z } from 'zod';
import { createCategorySchema } from './create-category-schema';

export const updateCategorySchema = z.intersection(
  z.object({ categoryId: z.string().trim().min(1).max(128) }),
  createCategorySchema,
);
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
