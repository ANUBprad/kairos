import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") ?? "https://kairos.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/login", "/signup"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}