import type { MDXComponents } from "mdx/types";
import Link from "next/link";

/**
 * MDX component mappings for styling markdown elements
 * Maps markdown syntax to your design system's typography
 */
export const mdxComponents: MDXComponents = {
  // Headings
  h1: ({ children, ...props }) => (
    <h1 className="text-h4 font-bold mb-6 mt-8 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-h5 font-semibold mb-4 mt-8" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-h6 font-semibold mb-3 mt-6" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-body font-semibold mb-2 mt-4" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-body font-semibold mb-2 mt-4" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-small font-semibold mb-2 mt-4" {...props}>
      {children}
    </h6>
  ),

  // Paragraphs and text
  p: ({ children, ...props }) => (
    <p
      className="text-small text-foreground/80 mb-4 leading-relaxed"
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
        className="text-foreground underline hover:text-foreground/70 transition-colors"
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
};
