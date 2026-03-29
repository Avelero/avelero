import type { ReactNode } from "react";

interface SplitTextBlockProps {
  title: ReactNode;
  description: string;
}

export function SplitTextBlock({ title, description }: SplitTextBlockProps) {
  return (
    <div className="w-full py-[45px] sm:py-[62px] grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-16">
      <h2 className="text-h6 sm:text-h5 text-foreground">{title}</h2>
      <p className="text-body sm:text-h6 text-muted-foreground">{description}</p>
    </div>
  );
}
