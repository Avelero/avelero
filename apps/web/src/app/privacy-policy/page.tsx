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
    <main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <div className="max-w-[768px] pt-[58px] pb-[45px] sm:pt-[92px] sm:pb-[62px]">
        <MDXRenderer source={content} />
      </div>
    </main>
  );
}

