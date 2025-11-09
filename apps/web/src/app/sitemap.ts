import type { MetadataRoute } from "next";

export const baseUrl = "https://avelero.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    {
      route: "",
      priority: 1.0,
      changeFrequency: "monthly" as const,
    },
    {
      route: "/terms-and-conditions/",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      route: "/privacy-policy/",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
  ].map((item) => ({
    url: `${baseUrl}${item.route}`,
    lastModified: "2025-11-09",
    changeFrequency: item.changeFrequency,
    priority: item.priority,
  }));

  return [...routes];
}
