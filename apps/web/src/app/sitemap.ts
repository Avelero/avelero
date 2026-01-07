import type { MetadataRoute } from "next";
import { getAllUpdates } from "@/lib/updates";

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

  // Static routes
  const staticRoutes = [
    {
      route: "/",
      priority: 1.0,
      changeFrequency: "monthly" as const,
    },
    {
      route: "/updates/",
      priority: 0.8,
      changeFrequency: "weekly" as const,
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

  return [...staticRoutes, ...updateRoutes];
}
