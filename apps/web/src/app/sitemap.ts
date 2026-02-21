import { getAllUpdates } from "@/lib/updates";
import type { MetadataRoute } from "next";

export const baseUrl = "https://avelero.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all updates for dynamic routes
  let updates: { slug: string; date: string }[] = [];
  try {
    updates = await getAllUpdates();
  } catch {
    // If no updates exist yet, continue with empty array
  }

  // Generate update routes
  const updateRoutes = updates.map((update) => ({
    url: `${baseUrl}/updates/${update.slug}/`,
    lastModified: update.date,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const latestUpdateDate = updates[0]?.date ?? new Date().toISOString();

  // Static routes
  const staticRoutes = [
    {
      route: "/",
      lastModified: latestUpdateDate,
      priority: 1.0,
      changeFrequency: "monthly" as const,
    },
    {
      route: "/updates/",
      lastModified: latestUpdateDate,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    },
    {
      route: "/terms-and-conditions/",
      lastModified: "2025-11-09",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    {
      route: "/privacy-policy/",
      lastModified: "2025-11-09",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
  ].map((item) => ({
    url: `${baseUrl}${item.route}`,
    lastModified: item.lastModified,
    changeFrequency: item.changeFrequency,
    priority: item.priority,
  }));

  return [...staticRoutes, ...updateRoutes];
}
