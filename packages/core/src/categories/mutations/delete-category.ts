import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { deleteCategorySchema } from '../schemas/delete-category-schema';

export const deleteCategory = createMutation({
  name: 'categories.delete',
  schema: deleteCategorySchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const category = await ctx.db.judgingCategory.findFirst({
      where: { id: input.categoryId, hackathonId },
      select: {
        id: true,
        name: true,
        kind: true,
        description: true,
        method: true,
        _count: {
          select: { assignments: true, evaluations: true, rankings: true },
        },
      },
    });
    if (!category)
      throw new AppError(
        AppErrorCode.NOT_FOUND,
        'Category not found. Refresh and try again.',
      );
    if (category.kind === 'OVERALL')
      throw new AppError(
        AppErrorCode.FORBIDDEN,
        'Overall is required and cannot be deleted.',
      );
    if (
      category._count.assignments ||
      category._count.evaluations ||
      category._count.rankings
    )
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'A category with judging activity cannot be deleted.',
      );
    await ctx.db.judgingCategory.delete({
      where: { id: category.id, hackathonId },
    });
    return {
      id: category.id,
      name: category.name,
      kind: category.kind,
      description: category.description,
      method: category.method,
    };
  },
  {
    audit: {
      entityType: 'JudgingCategory',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => result,
      getAfter: () => ({ deleted: true }),
    },
  },
);
