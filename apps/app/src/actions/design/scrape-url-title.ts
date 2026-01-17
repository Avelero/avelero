"use server";

import { authActionClient } from "@/actions/safe-action";
import { z } from "zod";

const schema = z.object({
  url: z.string().url(),
});

/**
 * Validates that a URL is safe to fetch (not internal/private network).
 * Prevents SSRF attacks by blocking:
 * - Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
 * - Localhost (127.x.x.x, ::1)
 * - Link-local addresses (169.254.x.x)
 * - Non-http(s) schemes
 */
function validateUrlSafety(urlString: string): void {
  const url = new URL(urlString);

  // Only allow http and https
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS protocols are allowed");
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname === "[::1]"
  ) {
    throw new Error("Cannot fetch from localhost");
  }

  // Block private IP ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = Number(match[3]);
    const d = Number(match[4]);

    // Validate IP octets
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      throw new Error("Invalid IP address");
    }

    // Block private ranges
    if (
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
      a === 0 || // 0.0.0.0/8
      a >= 224 // Multicast and reserved
    ) {
      throw new Error("Cannot fetch from private IP ranges");
    }
  }

  // Block IPv6 private addresses
  if (hostname.includes(":")) {
    const lowerHost = hostname.replace(/[\[\]]/g, "");
    if (
      lowerHost.startsWith("fe80:") || // Link-local
      lowerHost.startsWith("fc") || // Unique local
      lowerHost.startsWith("fd") // Unique local
    ) {
      throw new Error("Cannot fetch from private IPv6 addresses");
    }
  }
}

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
      // Validate URL safety to prevent SSRF attacks
      validateUrlSafety(url);

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
