import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/signup", "/forgot-password", "/reset-password"],
    },
    sitemap: "https://kairos.dev/sitemap.xml",
  };
}
