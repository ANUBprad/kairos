import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") ?? "https://kairos.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingRoutes = [
    "", "/features", "/capabilities", "/docs", "/blog", "/security",
    "/about", "/changelog", "/privacy", "/terms",
  ];

  return [
    ...marketingRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: route === "" ? "weekly" as const : "monthly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
  ];
}