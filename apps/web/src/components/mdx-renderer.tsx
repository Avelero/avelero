import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/lib/mdx";

interface MDXRendererProps {
  source: string;
  components?: MDXRemoteProps["components"];
}

/**
 * MDX renderer component that processes and renders MDX content
 * Uses the component mappings from @/lib/mdx
 */
export function MDXRenderer({ source, components = {} }: MDXRendererProps) {
  return (
    <div className="mdx-content">
      <MDXRemote
        source={source}
        components={{ ...mdxComponents, ...components }}
      />
    </div>
  );
}

