"use server";

import { authActionClient } from "@/actions/safe-action";
import { z } from "zod";

const schema = z.object({
    url: z.string().url(),
});

/**
 * Scrapes the title from a URL's HTML page.
 * Returns the title from either <title> tag or og:title meta tag.
 * Falls back to a cleaned-up URL if no title is found.
 */
export const scrapeUrlTitle = authActionClient
    .schema(schema)
    .metadata({ name: "design.scrape-url-title" })
    .action(async ({ parsedInput }) => {
        const { url } = parsedInput;

        try {
            // Fetch the page with a timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (compatible; AveleroBot/1.0; +https://avelero.com)",
                    Accept: "text/html",
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Only read first 100KB for efficiency
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let html = "";
            const maxBytes = 100 * 1024; // 100KB

            while (html.length < maxBytes) {
                const { done, value } = await reader.read();
                if (done) break;
                html += decoder.decode(value, { stream: true });
            }

            reader.cancel();

            // Try to extract <title> tag
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch?.[1]) {
                const title = titleMatch[1].trim();
                // Decode HTML entities
                const decodedTitle = title
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, " ");

                return { title: decodedTitle };
            }

            // Try og:title meta tag
            const ogTitleMatch = html.match(
                /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
            );
            if (ogTitleMatch?.[1]) {
                return { title: ogTitleMatch[1].trim() };
            }

            // Try twitter:title meta tag
            const twitterTitleMatch = html.match(
                /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i,
            );
            if (twitterTitleMatch?.[1]) {
                return { title: twitterTitleMatch[1].trim() };
            }

            // Fallback: Clean up URL to create a readable title
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split("/").filter(Boolean);
            if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart) {
                    // Convert slug to title case
                    const title = lastPart
                        .replace(/[-_]/g, " ")
                        .replace(/\.[^.]+$/, "") // Remove file extension
                        .split(" ")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ");

                    return { title };
                }
            }

            // Final fallback: Use domain name
            const domain = urlObj.hostname.replace(/^www\./, "");
            return { title: domain };
        } catch (error) {
            // On any error, create a title from the URL
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace(/^www\./, "");
                return { title: domain };
            } catch {
                return { title: "Link" };
            }
        }
    });
