import { CategoryKind } from '../generated/prisma/enums';
import { db } from '../src/client';

try {
  await db.$transaction(async (tx) => {
    // Serialize concurrent setup runs; do not overwrite configured/claimed state.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724181, 1)`;
    await tx.installation.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });

    const hackathon =
      (await tx.hackathon.findFirst()) ??
      (await tx.hackathon.create({ data: {} }));

    const overall = await tx.judgingCategory.findFirst({
      where: { hackathonId: hackathon.id, kind: CategoryKind.OVERALL },
    });

    if (!overall) {
      await tx.judgingCategory.create({
        data: {
          hackathonId: hackathon.id,
          kind: CategoryKind.OVERALL,
          name: 'Overall',
          description: 'Judging for projects without a specialized track.',
          method: 'RELATIVE',
        },
      });
    }
  });

  console.info(
    'Database setup complete. Existing configuration was preserved.',
  );
} finally {
  await db.$disconnect();
}
