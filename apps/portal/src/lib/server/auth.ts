import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { nextCookies } from "better-auth/next-js";

const isProduction = process.env.NODE_ENV === "production";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAuth(): any {
  if (_auth) return _auth;

  _auth = betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7,
      },
    },
    advanced: {
      cookiePrefix: "kairos",
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
      },
    },
    socialProviders: {
      ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    plugins: [nextCookies()],
  });

  return _auth;
}

// Lazy proxy — betterAuth() is only created when auth is first accessed at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: any = new Proxy({} as any, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
});
