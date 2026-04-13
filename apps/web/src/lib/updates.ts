import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

const UPDATES_DIR = join(process.cwd(), "content/updates");

export interface UpdateMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  image: string;
  author?: string;
  linkedin?: string;
}

export interface Update extends UpdateMeta {
  content: string;
}

/**
 * Get all updates, sorted by date (newest first)
 */
export async function getAllUpdates(): Promise<UpdateMeta[]> {
  const files = await readdir(UPDATES_DIR);
  const mdxFiles = files.filter((file) => file.endsWith(".mdx"));

  const updates = await Promise.all(
    mdxFiles.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const filePath = join(UPDATES_DIR, file);
      const fileContent = await readFile(filePath, "utf-8");
      const { data } = matter(fileContent);

      return {
        slug,
        title: data.title,
        description: data.description,
        date: data.date,
        image: data.image,
        author: data.author,
      } as UpdateMeta;
    }),
  );

  // Sort by date, newest first
  return updates.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * Get a single update by slug
 */
export async function getUpdateBySlug(slug: string): Promise<Update> {
  const filePath = join(UPDATES_DIR, `${slug}.mdx`);
  const fileContent = await readFile(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    image: data.image,
    author: data.author,
    linkedin: data.linkedin,
    content,
  };
}

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Extract h2 and h3 headings from raw MDX content for table of contents.
 * Uses the same slugification logic as the MDX heading components.
 */
export function extractHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;

  for (const match of content.matchAll(headingRegex)) {
    const level = match[1].length as 2 | 3;
    const rawText = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown links
      .replace(/[*_`]/g, "") // strip bold/italic/code markers
      .trim();

    const id = rawText
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (id && rawText) {
      headings.push({ id, text: rawText, level });
    }
  }

  return headings;
}

/**
 * Get all slugs for static generation
 */
export async function getAllUpdateSlugs(): Promise<string[]> {
  const files = await readdir(UPDATES_DIR);
  return files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}
