import { baseUrl } from "@/app/sitemap";
import { MDXRenderer } from "@/components/mdx-renderer";
import { RelatedUpdates } from "@/components/related-updates";
import { UpdateFooter } from "@/components/update-footer";
import { type Update, getAllUpdateSlugs, getUpdateBySlug } from "@/lib/updates";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

interface UpdatePageProps {
  params: Promise<{ slug: string }>;
}

interface CreativeWorkCitation {
  "@type": "CreativeWork";
  name: string;
  url: string;
}

const EXTERNAL_MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

/**
 * Format date to human-readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getExternalCitations(content: string): CreativeWorkCitation[] {
  const citations: CreativeWorkCitation[] = [];
  const seenUrls = new Set<string>();

  for (const match of content.matchAll(EXTERNAL_MARKDOWN_LINK_REGEX)) {
    const name = match[1]?.trim();
    const url = match[2]?.trim();

    if (!name || !url || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    citations.push({
      "@type": "CreativeWork",
      name,
      url,
    });
  }

  return citations;
}

/**
 * Generate static params for all update slugs
 */
export async function generateStaticParams() {
  const slugs = await getAllUpdateSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Generate dynamic metadata for each update page
 */
export async function generateMetadata({
  params,
}: UpdatePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const update = await getUpdateBySlug(slug);

    const canonicalUrl = `${baseUrl}/updates/${slug}/`;

    return {
      title: update.title,
      description: update.description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: update.title,
        description: update.description,
        type: "article",
        publishedTime: update.date,
        modifiedTime: update.date,
        authors: [update.author || "Avelero"],
        url: canonicalUrl,
        images: [
          {
            url: `${baseUrl}${update.image}`,
            width: 1200,
            height: 630,
            alt: update.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: update.title,
        description: update.description,
        images: [`${baseUrl}${update.image}`],
      },
    };
  } catch {
    return {
      title: "Update Not Found",
    };
  }
}

export default async function UpdatePage({ params }: UpdatePageProps) {
  const { slug } = await params;

  let update: Update;
  try {
    update = await getUpdateBySlug(slug);
  } catch {
    notFound();
  }

  // JSON-LD structured data for SEO
  const canonicalUrl = `${baseUrl}/updates/${slug}/`;
  const citations = getExternalCitations(update.content);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    headline: update.title,
    description: update.description,
    image: `${baseUrl}${update.image}`,
    datePublished: update.date,
    dateModified: update.date,
    author: {
      "@type": "Person",
      name: update.author || "Avelero",
      ...(update.linkedin ? { url: update.linkedin } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "Avelero",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/hero-image.webp`,
      },
    },
    ...(citations.length > 0 ? { citation: citations } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="w-full flex flex-col items-center">
        <article className="w-full flex flex-col items-center">
          {/* Header Section - Author, Date, Title */}
          <header className="w-full max-w-[976px] mx-auto pt-[58px] sm:pt-[92px] pb-[45px] sm:pb-[62px]">
            {/* Author and Date */}
            <p className="text-body text-center text-foreground/50 mb-2 transition-all duration-150">
              <a
                href={update.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:underline"
              >
                {update.author || "Avelero"}
              </a>{" "}
              · <time dateTime={update.date}>{formatDate(update.date)}</time>
            </p>

            {/* Title */}
            <h1 className="text-h4 md:text-h3 text-center text-foreground">
              {update.title}
            </h1>
          </header>

          {/* Cover Image - Full width with 18:10 aspect ratio */}
          <div className="w-full max-w-[976px] mx-auto py-[45px] sm:py-[62px]">
            <div className="relative w-full aspect-[18/10] overflow-hidden">
              <Image
                src={update.image}
                alt={update.title}
                fill
                priority
                sizes="(max-width: 639px) calc(100vw - 3rem), (max-width: 1103px) calc(100vw - 8rem), 976px"
                className="object-cover"
                quality={90}
              />
            </div>
          </div>

          {/* MDX Content Section */}
          <div className="w-full py-[45px] sm:py-[62px]">
            {/* MDX content with max-width for text readability */}
            <div className="max-w-[624px] w-full mx-auto">
              <MDXRenderer source={update.content} />
            </div>
          </div>

          {/* Update Footer with share buttons */}
          <UpdateFooter title={update.title} slug={slug} />
        </article>

        {/* Related Updates Section */}
        <RelatedUpdates currentSlug={slug} />
      </main>
    </>
  );
}
