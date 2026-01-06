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
        })
    );

    // Sort by date, newest first
    return updates.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
        content,
    };
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
