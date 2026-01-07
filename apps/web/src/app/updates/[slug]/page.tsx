import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUpdateBySlug, getAllUpdateSlugs, type Update } from "@/lib/updates";
import { MDXRenderer } from "@/components/mdx-renderer";
import { UpdateFooter } from "@/components/update-footer";
import { RelatedUpdates } from "@/components/related-updates";
import { baseUrl } from "@/app/sitemap";

interface UpdatePageProps {
    params: Promise<{ slug: string }>;
}

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
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
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
        },
        publisher: {
            "@type": "Organization",
            name: "Avelero",
            logo: {
                "@type": "ImageObject",
                url: `${baseUrl}/og-image.jpg`,
            },
        },
        citation: [
            {
                "@type": "CreativeWork",
                name: "ThredUp & GlobalData 2024 Resale Report",
                url: "https://cf-assets-tup.thredup.com/resale_report/2024/ThredUp_2024_Resale%20Report.pdf",
            },
            {
                "@type": "CreativeWork",
                name: "WRAP: Extending Product Lifetimes - Clothing Durability",
                url: "https://www.wrap.ngo/resources/case-study/extending-product-lifetimes-wraps-work-clothing-durability",
            },
        ],
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
                            >{update.author || "Avelero"}</a> · {formatDate(update.date)}
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
                                sizes="100vw"
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
