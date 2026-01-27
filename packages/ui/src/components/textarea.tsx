import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../utils";

const textareaVariants = cva(
  "flex min-h-[60px] max-h-[300px] w-full border border-border bg-background px-3 py-2 type-p placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      error: {
        true: "focus-visible:!ring-destructive",
        false: "",
      },
    },
    defaultVariants: {
      error: false,
    },
  },
);

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ error, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
