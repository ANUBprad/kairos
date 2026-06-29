import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn(
    "\n  ⚠  DATABASE_URL is not configured.\n" +
    "     Create apps/portal/.env.local with:\n" +
    "       DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kairos?schema=public\n" +
    "     See apps/portal/.env.example for all required variables.\n"
  );
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
