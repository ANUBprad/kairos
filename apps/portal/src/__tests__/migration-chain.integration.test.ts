import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SOURCE_STATUS_VALUES } from "../lib/source-contract";

// The expected schema inventory is DERIVED from schema.prisma (the single
// source of truth) rather than curated by hand. Curated lists let drifted,
// never-migrated models fall out of the deploy chain unnoticed; a derived
// inventory fails the moment the fresh deploy no longer materializes exactly
// what the schema declares. Legacy residue that the schema deliberately
// dropped (dead enum values, columns, indexes inherited from _init) is legal
// on an existing DB and is NOT asserted against — the checks below are
// presence-driven in the schema -> DB direction.

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

interface DerivedSchema {
  tables: string[];
  columns: Map<string, string[]>;
  indexes: Map<string, string[]>;
  enums: Map<string, string[]>;
  fks: Map<string, string | null>;
}

function parseSchema(): DerivedSchema {
  const src = readFileSync(SCHEMA_PATH, "utf8");
  const tables = new Map<string, string[]>();
  const modelRe = /^model (\w+) \{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(src)) !== null) {
    tables.set(m[1], m[2].split("\n"));
  }

  const enums = new Map<string, string[]>();
  const enumRe = /^enum (\w+) \{([\s\S]*?)^\}/gm;
  while ((m = enumRe.exec(src)) !== null) {
    const values = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//") && !l.endsWith("}"));
    enums.set(m[1], values);
  }

  const modelNames = new Set(tables.keys());

  // table -> scalar column names (relations excluded)
  const columns = new Map<string, string[]>();
  // table -> derived index/unique constraint names
  const indexes = new Map<string, string[]>();
  // constraint name -> expected delete_rule (or null when schema omits onDelete)
  const fks = new Map<string, string | null>();

  for (const [table, lines] of tables) {
    const cols: string[] = [];
    const idxs: string[] = [];
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");

      if (line.startsWith("  @@")) {
        const unique = line.startsWith("  @@unique");
        const list = /@@(?:index|unique)\(\[([^\]]*)\]\)/.exec(line);
        if (list) {
          const parts = list[1]
            .split(",")
            .map((c) => c.trim().replace(/\(sort: \w+\)$/, ""))
            .filter(Boolean);
          if (parts.length > 0) {
            idxs.push(`${table}_${parts.join("_")}_${unique ? "key" : "idx"}`);
          }
        }
        continue;
      }

      const field = /^ {2}([A-Za-z]\w*)\s+/.exec(line);
      if (!field) continue;
      const name = field[1];

      const typeStart = line.slice(line.indexOf(name) + name.length).trim();
      const typeName = /^([A-Za-z]\w*)/.exec(typeStart)?.[1] ?? "";
      const isRelation = modelNames.has(typeName);

      if (line.includes("@unique")) {
        idxs.push(`${table}_${name}_key`);
      }
      if (isRelation) continue;

      cols.push(name);
      const rel = line.includes("@relation(")
        ? /@relation\(([\s\S]*?)\)$/.exec(line)
        : null;
      // Foreign key constraint names come from the owning (fields: [...]) side.
      if (rel) {
        const body = rel[1];
        const fieldsList = /fields:\s*\[([^\]]*)\]/.exec(body);
        if (fieldsList) {
          const fkCols = fieldsList[1].split(",").map((c) => c.trim()).filter(Boolean);
          const onDelete = /onDelete:\s*(\w+)/.exec(body)?.[1] ?? null;
          let rule: string | null = null;
          if (onDelete) {
            rule =
              onDelete === "Cascade"
                ? "CASCADE"
                : onDelete === "SetNull"
                  ? "SET NULL"
                  : onDelete === "Restrict"
                    ? "RESTRICT"
                    : null;
          }
          fks.set(`${table}_${fkCols.join("_")}_fkey`, rule);
        }
      }
    }
    columns.set(table, cols);
    indexes.set(table, idxs);
  }

  return { tables: [...tables.keys()], columns, indexes, enums, fks };
}

function makeClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function testDbUrlWithDatabase(url: string, dbName: string): string {
  const slashIdx = url.lastIndexOf("/");
  assert.ok(slashIdx > 0, `cannot locate database segment in URL: ${url}`);
  const queryIdx = url.indexOf("?", slashIdx);
  const base = url.slice(0, slashIdx + 1) + dbName;
  return queryIdx >= 0 ? base + url.slice(queryIdx) : base;
}

function maintenanceUrl(url: string): string {
  const m = url.match(
    /^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/[^?]+(\?.*)?$/,
  );
  assert.ok(m, `cannot parse database URL for maintenance connection: ${url}`);
  const [, , user, pass, host, port, params] = m;
  return `postgresql://${user}:${pass}@${host}:${port}/postgres${params ?? ""}`;
}

function runMigrateDeploy(dbUrl: string): void {
  const prismaCli = path.join(
    process.cwd(),
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
}

describe("prisma migration chain", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const dbName = `kairos_migtest_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  after(async () => {
    if (!testDbUrl) return;
    const admin = makeClient(maintenanceUrl(testDbUrl));
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
    } catch {
      // teardown best effort — the throwaway database may not exist
    } finally {
      await admin.$disconnect();
    }
  });

  it("deploys the full chain onto an empty database and materializes exactly the schema the application declares", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }

    const admin = makeClient(maintenanceUrl(testDbUrl));
    await admin.$connect();
    try {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    } finally {
      await admin.$disconnect();
    }

    // 0. Derive the full expected inventory from schema.prisma BEFORE deploy.
    const expected = parseSchema();
    const expectedTables = expected.tables;
    const expectedEnums = [...expected.enums.keys()];
    const expectedIndexes = [...expected.indexes.values()].flat();
    const expectedFkNames = [...expected.fks.keys()];

    const dbUrl = testDbUrlWithDatabase(testDbUrl, dbName);

    // 1. The exact command used for production deploys must succeed from empty.
    runMigrateDeploy(dbUrl);

    const client = makeClient(dbUrl);
    try {
      await client.$connect();

      // 2. Every table declared by the schema exists after deploy.
      const tables = await client.$queryRaw<
        { table_name: string }[]
      >`SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY(${expectedTables})`;
      const presentTables = new Set(tables.map((r) => r.table_name));
      for (const table of expectedTables) {
        assert.ok(presentTables.has(table), `table missing after deploy: ${table}`);
      }

      // 3. Every scalar column every model declares exists on its table.
      const columnRows = await client.$queryRaw<
        { table_name: string; column_name: string }[]
      >`SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ANY(${expectedTables})`;
      const presentCols = new Map<string, Set<string>>();
      for (const row of columnRows) {
        if (!presentCols.has(row.table_name)) presentCols.set(row.table_name, new Set());
        presentCols.get(row.table_name)!.add(row.column_name);
      }
      for (const [table, cols] of expected.columns) {
        const got = presentCols.get(table) ?? new Set();
        for (const col of cols) {
          assert.ok(got.has(col), `column missing after deploy: ${table}.${col}`);
        }
      }

      // 4. Every index/unique constraint the schema declares exists after deploy.
      const indexRows = await client.$queryRaw<
        { indexname: string }[]
      >`SELECT indexname FROM pg_indexes WHERE indexname = ANY(${expectedIndexes})`;
      const presentIndexes = new Set(indexRows.map((r) => r.indexname));
      for (const idx of expectedIndexes) {
        assert.ok(presentIndexes.has(idx), `index/unique missing after deploy: ${idx}`);
      }

      // 5. Every enum type exists; every enum value the schema declares exists
      //    (a fresh deploy may carry extra legacy values, but never less).
      const enumRows = await client.$queryRaw<
        { typname: string; enumlabel: string }[]
      >`SELECT t.typname, e.enumlabel
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typtype = 'e' AND t.typname = ANY(${expectedEnums})`;
      const enumValues = new Map<string, Set<string>>();
      for (const row of enumRows) {
        if (!enumValues.has(row.typname)) enumValues.set(row.typname, new Set());
        enumValues.get(row.typname)!.add(row.enumlabel);
      }
      for (const [enumName, values] of expected.enums) {
        const got = enumValues.get(enumName);
        assert.ok(got, `enum type missing after deploy: ${enumName}`);
        for (const value of values) {
          assert.ok(got.has(value), `enum value missing after deploy: ${enumName}.${value}`);
        }
      }

      // 5b. The DocumentStatus enum carries exactly the application's status
      //     contract after a fresh deploy (a migrate-deploy database must accept
      //     any status the application writes — previously the chain only
      //     created the legacy PROCESSING/READY/ERROR/DELETED subset).
      const docStatusValues = await client.$queryRaw<
        { enumlabel: string }[]
      >`SELECT enumlabel FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'DocumentStatus'
        ORDER BY e.enumsortorder`;
      const deployed = docStatusValues.map((v) => v.enumlabel);
      for (const status of SOURCE_STATUS_VALUES) {
        assert.ok(
          deployed.includes(status),
          `fresh deploy must create DocumentStatus value "${status}"`,
        );
      }

      // 6. Every foreign key the schema declares exists, and its referential
      //    delete action matches the schema when the schema spells one out
      //    (this is what caught Organization.ownerId: RESTRICT vs CASCADE).
      const fkRows = await client.$queryRaw<
        { constraint_name: string; delete_rule: string }[]
      >`SELECT rc.constraint_name, rc.delete_rule
         FROM information_schema.referential_constraints rc
         WHERE rc.constraint_name = ANY(${expectedFkNames})`;
      const presentFks = new Map(fkRows.map((r) => [r.constraint_name, r.delete_rule]));
      for (const [fkName, expectedRule] of expected.fks) {
        const actualRule = presentFks.get(fkName);
        assert.ok(actualRule !== undefined, `foreign key missing after deploy: ${fkName}`);
        if (expectedRule !== null) {
          assert.equal(
            actualRule,
            expectedRule,
            `FK ${fkName} delete action must match schema (want ${expectedRule}, got ${actualRule})`,
          );
        }
      }

      // 7. pgvector extension and the vector column exist.
      const ext = await client.$queryRaw<
        { extname: string }[]
      >`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
      assert.equal(ext.length, 1);
      const emb = await client.$queryRaw<
        { udt_name: string }[]
      >`SELECT udt_name FROM information_schema.columns
         WHERE table_name = 'DocumentEmbedding' AND column_name = 'embedding'`;
      assert.equal(emb.length, 1);
      assert.equal(emb[0].udt_name, "vector");

      // 8. The application default for document status survives a fresh
      //    deploy: a migrate-deploy database accepts the Prisma client-side
      //    @default(QUEUED) insert and ApiKey's new columns keep their schema
      //    defaults.
      const owner = await client.user.create({
        data: { email: `chain-${randomUUID()}@test.local` },
      });
      const org = await client.organization.create({
        data: {
          name: `chain-${randomUUID()}`,
          slug: `chain-${randomUUID().slice(0, 8)}`,
          ownerId: owner.id,
        },
      });
      const project = await client.project.create({
        data: {
          name: `chain-${randomUUID()}`,
          slug: `chain-${randomUUID().slice(0, 8)}`,
          organizationId: org.id,
        },
      });
      const kb = await client.knowledgeBase.create({
        data: { name: "chain-kb", projectId: project.id },
      });
      const doc = await client.document.create({
        data: { name: "a.pdf", fileType: "pdf", knowledgeBaseId: kb.id },
      });
      assert.equal(doc.status, "QUEUED", "application default status must be QUEUED");

      // 9. Migrations that realign a foreign key are legal only when they
      //    re-create the same constraint (Prisma's own output for an onDelete
      //    change). Everything else data-destroying is banned.
      const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
      for (const dir of readdirSync(migrationsDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const sql = readFileSync(
          path.join(migrationsDir, dir.name, "migration.sql"),
          "utf8",
        );
        const hardBans =
          /(^|\n)\s*(DROP\s+(TABLE|COLUMN|INDEX|EXTENSION|SCHEMA)|TRUNCATE|DELETE\s+FROM)/i;
        assert.ok(
          !hardBans.test(sql),
          `destructive statement detected in migration ${dir.name}`,
        );
        const droppedFks = sql.match(/DROP CONSTRAINT "([^"]+)"/g);
        for (const drop of droppedFks ?? []) {
          const name = /"([^"]+)"/.exec(drop)![1];
          assert.ok(
            sql.includes(`ADD CONSTRAINT "${name}"`),
            `DROP CONSTRAINT "${name}" in ${dir.name} must re-create the same constraint`,
          );
        }
      }

      // 10. Fresh-deploy probe: every production-written model that was never
      //     materialized by the chain accepts the writes the application does.
      await client.documentVersion.create({
        data: {
          version: 1,
          fileType: "pdf",
          size: 100,
          storageKey: "k",
          storageUrl: null,
          documentId: doc.id,
          uploadedById: owner.id,
        },
      });
      await client.documentActivity.create({
        data: { action: "UPLOADED", documentId: doc.id, userId: owner.id },
      });
      await client.notification.create({
        data: { type: "SYSTEM", title: "t", message: "m", userId: owner.id },
      });
      await client.invitation.create({
        data: {
          email: `i-${randomUUID()}@test.local`,
          token: randomUUID().replace(/-/g, "").slice(0, 16),
          expiresAt: new Date(Date.now() + 3_600_000),
          organizationId: org.id,
          invitedById: owner.id,
        },
      });
      await client.shareLink.create({
        data: {
          token: randomUUID().replace(/-/g, "").slice(0, 16),
          resourceType: "kb",
          resourceId: kb.id,
          organizationId: org.id,
          createdById: owner.id,
        },
      });
      await client.workspaceSettings.create({
        data: { key: "flags", value: {}, organizationId: org.id },
      });
      const apiKey = await client.apiKey.create({
        data: {
          name: "chain-key",
          keyHash: randomUUID().replace(/-/g, ""),
          keyPrefix: "chaintk",
          userId: owner.id,
          organizationId: org.id,
        },
      });
      assert.deepEqual(apiKey.scopes, ["read", "write"], "ApiKey.scopes default must survive");
      await client.auditLog.create({
        data: { action: "chain.probe", resource: "kb", organizationId: org.id, userId: owner.id },
      });

      // 11. The realigned Organization.ownerId FK actually cascades like the
      //     schema declares.
      const cascadeOwner = await client.user.create({
        data: { email: `cascade-${randomUUID()}@test.local` },
      });
      const cascadeOrg = await client.organization.create({
        data: {
          name: `cascade-${randomUUID()}`,
          slug: `cascade-${randomUUID().slice(0, 8)}`,
          ownerId: cascadeOwner.id,
        },
      });
      await client.user.delete({ where: { id: cascadeOwner.id } });
      const stillThere = await client.organization.findUnique({ where: { id: cascadeOrg.id } });
      assert.equal(stillThere, null, "deleting an org owner must cascade to the org");
    } finally {
      await client.$disconnect();
    }
  });
});