import { db } from '../src/client';

try {
  await db.$queryRaw`SELECT 1`;
  const [installations, hackathons, categories] = await Promise.all([
    db.installation.count(),
    db.hackathon.count(),
    db.judgingCategory.count(),
  ]);
  console.info('Database connection and schema are operational.', {
    installations,
    hackathons,
    categories,
  });
} finally {
  await db.$disconnect();
}
