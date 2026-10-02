// Fails CI closed when the Portal test suite could skip its database-backed
// suites instead of failing.
//
// The integration suites call t.skip() rather than throw when their
// preconditions are missing, which is right for a developer without Postgres
// and wrong for CI: a green run that skipped 237 tests proves nothing. This
// script asserts every precondition those suites branch on, so a renamed or
// dropped environment variable becomes a red build instead of silent
// false-green coverage.
//
// It deliberately checks the preconditions rather than parsing test output,
// so it stays correct as suites are added.
//
// Usage: node --import tsx scripts/verify-test-database.ts
import { PrismaClient } from "@prisma/client";

const PINNED_DIMENSIONS = 768;

async function main() {
  const problems: string[] = [];

  // Both are required: server actions resolve their session user through
  // DATABASE_URL, so a split configuration fails later on a foreign key
  // against the demo user rather than on a clear error.
  const databaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.KAIROS_TEST_DATABASE_URL;
  if (!databaseUrl) problems.push("DATABASE_URL is not set");
  if (!testDatabaseUrl) problems.push("KAIROS_TEST_DATABASE_URL is not set");
  if (databaseUrl && testDatabaseUrl && databaseUrl !== testDatabaseUrl) {
    problems.push("DATABASE_URL and KAIROS_TEST_DATABASE_URL must point at the same database");
  }
  if (process.env.KAIROS_DEMO_MODE !== "true") {
    problems.push('KAIROS_DEMO_MODE must be "true" so the session-backed suites run');
  }
  if (problems.length > 0) {
    throw new Error(`integration test preconditions unmet:\n  - ${problems.join("\n  - ")}`);
  }

  const client = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } });
  try {
    await client.$queryRaw`SELECT 1`;

    const [extension] = await client.$queryRaw<{ installed: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed
    `;
    if (!extension.installed) {
      throw new Error("the vector extension is not installed in the test database");
    }

    // pgvector refuses to index a typmod-less vector column, so the pinned
    // width is the contract the release journey's ingestion assertions read
    // back with vector_dims().
    const [column] = await client.$queryRaw<{ typmod: number }[]>`
      SELECT atttypmod AS typmod
      FROM pg_attribute
      WHERE attrelid = '"DocumentEmbedding"'::regclass
        AND attname = 'embedding'
        AND NOT attisdropped
    `;
    if (!column) throw new Error('"DocumentEmbedding"."embedding" does not exist; apply migrations');
    if (column.typmod !== PINNED_DIMENSIONS) {
      throw new Error(
        `"DocumentEmbedding"."embedding" is not vector(${PINNED_DIMENSIONS}) (typmod ${column.typmod})`,
      );
    }

    console.log(
      `Integration test database ready: pgvector ${PINNED_DIMENSIONS}-dim column present, demo session enabled.`,
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});