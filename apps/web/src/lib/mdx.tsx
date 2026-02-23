import { DPPDemoCallout } from "@/components/updates/dpp-demo-callout";
import { InteractiveTimeline } from "@/components/updates/interactive-timeline";
import { cn } from "@/lib/utils";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import NextImage, { type ImageProps as NextImageProps } from "next/image";
import { isValidElement, type ReactNode } from "react";

type MdxImageProps = Omit<NextImageProps, "src" | "alt" | "width" | "height"> & {
  src: string;
  alt: string;
  width: number | string;
  height: number | string;
  caption?: ReactNode;
  figureClassName?: string;
};

function toNumberDimension(value: number | string, name: "width" | "height"): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`MDX <Image> requires a valid numeric ${name} prop.`);
  }

  return parsed;
}

function MdxImage({
  src,
  alt,
  width,
  height,
  caption,
  className,
  figureClassName,
  sizes = "(max-width: 639px) calc(100vw - 3rem), 688px",
  ...props
}: MdxImageProps) {
  const numericWidth = toNumberDimension(width, "width");
  const numericHeight = toNumberDimension(height, "height");

  return (
    <figure className={cn("my-8 w-full sm:-mx-8 sm:w-[calc(100%+4rem)]", figureClassName)}>
      <NextImage
        src={src}
        alt={alt}
        width={numericWidth}
        height={numericHeight}
        sizes={sizes}
        className={cn("h-auto w-full border border-border", className)}
        {...props}
      />
      {caption ? (
        <figcaption className="text-small mt-2 text-center text-foreground/60">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }

  return "";
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getHeadingId(children: ReactNode, id?: string): string | undefined {
  if (id) {
    return id;
  }

  const text = getTextContent(children);
  const slug = slugifyHeading(text);
  return slug || undefined;
}

/**
 * MDX component mappings for styling markdown elements
 * Maps markdown syntax to your design system's typography
 */
export const mdxComponents: MDXComponents = {
  InteractiveTimeline,
  DPPDemoCallout,
  Image: MdxImage,

  // Headings
  h1: ({ children, ...props }) => (
    <h1 className="text-h4 mb-6 mt-8 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, id, ...props }) => {
    const headingId = getHeadingId(children, id);
    const headingText = getTextContent(children);

    return (
      <h2 id={headingId} className="group text-h5 mb-4 mt-8 scroll-mt-28" {...props}>
        {children}
        {headingId ? (
          <a
            href={`#${headingId}`}
            className="ml-2 text-foreground/40 no-underline opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100"
            aria-label={`Link to section: ${headingText}`}
          >
            #
          </a>
        ) : null}
      </h2>
    );
  },
  h3: ({ children, id, ...props }) => {
    const headingId = getHeadingId(children, id);
    const headingText = getTextContent(children);

    return (
      <h3 id={headingId} className="group text-h6 mb-3 mt-6 scroll-mt-28" {...props}>
        {children}
        {headingId ? (
          <a
            href={`#${headingId}`}
            className="ml-2 text-foreground/40 no-underline opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100"
            aria-label={`Link to section: ${headingText}`}
          >
            #
          </a>
        ) : null}
      </h3>
    );
  },
  h4: ({ children, ...props }) => (
    <h4 className="text-body mb-2 mt-4" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-body mb-2 mt-4" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-small mb-2 mt-4" {...props}>
      {children}
    </h6>
  ),

  // Paragraphs and text
  p: ({ children, ...props }) => (
    <p
      className="text-body text-foreground/80 my-6 leading-relaxed first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </p>
  ),

  // Links
  a: ({ href, children, ...props }) => {
    const isExternal = href?.startsWith("http");
    const Component = isExternal ? "a" : Link;
    const externalProps = isExternal
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    return (
      <Component
        href={href ?? "#"}
        className="text-primary underline hover:text-primary/70 transition-colors duration-150"
        {...externalProps}
        {...props}
      >
        {children}
      </Component>
    );
  },

  // Lists
  ul: ({ children, ...props }) => (
    <ul className="list-disc ml-6 mb-4 space-y-2" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal ml-6 mb-4 space-y-2" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-body text-foreground/80" {...props}>
      {children}
    </li>
  ),

  // Emphasis
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),

  // Block elements
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-4 border-border pl-4 py-2 my-4 italic text-foreground/70"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Code
  code: ({ children, ...props }) => (
    <code
      className="bg-card px-1.5 py-0.5 rounded text-small font-geist-mono"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="bg-card p-4 rounded-lg overflow-x-auto mb-4 text-small font-geist-mono"
      {...props}
    >
      {children}
    </pre>
  ),

  // Horizontal rule
  hr: ({ ...props }) => <hr className="border-border my-8" {...props} />,

  // Tables
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full border-collapse border border-border" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-card" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => (
    <tr className="border-b border-border" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-border px-4 py-2 text-left text-small font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border border-border px-4 py-2 text-small text-foreground/80"
      {...props}
    >
      {children}
    </td>
  ),
};
