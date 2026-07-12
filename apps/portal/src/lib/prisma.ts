import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (_prisma) return _prisma;
  if (globalForPrisma.prisma) {
    _prisma = globalForPrisma.prisma;
    return _prisma;
  }

  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
    console.warn(
      "\n  ⚠  DATABASE_URL is not configured.\n" +
      "     Create apps/portal/.env.local with:\n" +
      "       DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kairos?schema=public\n" +
      "     See apps/portal/.env.example for all required variables.\n"
    );
  }

  _prisma = new PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = _prisma;
  }

  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrismaClient(), prop);
  },
});
