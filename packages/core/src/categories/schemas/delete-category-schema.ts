import { z } from 'zod';

export const deleteCategorySchema = z.object({
  categoryId: z.string().trim().min(1).max(128),
});
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
