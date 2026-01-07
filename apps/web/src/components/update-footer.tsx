"use client";

import { useState } from "react";
import { TwitterIcon } from "./icons/twitter-icon";
import { LinkedInIcon } from "./icons/linkedin-icon";
import { Button } from "./button";
import { Copy, Check } from "lucide-react";

interface UpdateFooterProps {
    title: string;
    slug: string;
}

// Canonical URL for sharing (always production)
const BASE_URL = "https://avelero.com";

export function UpdateFooter({ title, slug }: UpdateFooterProps) {
    const [copied, setCopied] = useState(false);

    // Always use canonical URL for social sharing (consistent SSR/client)
    const shareUrl = `${BASE_URL}/updates/${slug}/`;

    const handleCopyLink = async () => {
        try {
            // For copy, use current URL if available (better for dev/preview)
            const urlToCopy =
                typeof window !== "undefined"
                    ? `${window.location.origin}/updates/${slug}/`
                    : shareUrl;
            await navigator.clipboard.writeText(urlToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy link:", err);
        }
    };

    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`;
    const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

    return (
        <div className="max-w-[624px] w-full mx-auto border-t border-border pt-6 pb-[45px] sm:pb-[62px]">
            <div className="flex flex-col gap-5">
                {/* Label */}
                <p className="text-body text-foreground">Share this article</p>

                {/* Share buttons */}
                <div className="flex flex-row gap-4">
                    {/* Twitter button */}
                    <Button asChild size="icon" aria-label="Share on Twitter">
                        <a
                            href={twitterShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <TwitterIcon />
                        </a>
                    </Button>

                    {/* LinkedIn button */}
                    <Button asChild size="icon" aria-label="Share on LinkedIn">
                        <a
                            href={linkedInShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <LinkedInIcon />
                        </a>
                    </Button>

                    {/* Copy link button */}
                    <Button onClick={handleCopyLink} aria-label="Copy link">
                        <span>{copied ? "Copied!" : "Copy link"}</span>
                        {copied ? <Check /> : <Copy />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
