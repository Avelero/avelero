import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MDXRenderer } from "@/components/mdx-renderer";
import matter from "gray-matter";

export const metadata = {
  title: "Privacy Policy | Avelero",
  description: "Privacy policy for Avelero's digital product passport platform",
};

export default async function PrivacyPolicyPage() {
  const contentPath = join(process.cwd(), "content/legal/privacy-policy.mdx");
  const fileContent = await readFile(contentPath, "utf-8");
  
  // Parse frontmatter and content
  const { content, data } = matter(fileContent);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 sm:px-16 py-12 max-w-4xl">
        <MDXRenderer source={content} />
      </div>
    </main>
  );
}

