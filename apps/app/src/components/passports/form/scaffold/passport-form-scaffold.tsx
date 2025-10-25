import { cn } from "@v1/ui/cn";

/**
 * Renders a titled two-column scaffold for passport-related forms.
 *
 * @param title - Node displayed as the scaffold title above the columns
 * @param left - Node rendered inside the left (primary) column
 * @param right - Node rendered inside the right (secondary) column
 * @param className - Optional additional classes applied to the outer container
 * @param leftClassName - Optional additional classes applied to the left column
 * @param rightClassName - Optional additional classes applied to the right column
 * @returns The scaffold JSX element containing the title and two responsive columns
 */
export function PassportFormScaffold({
  title,
  left,
  right,
  className,
  leftClassName,
  rightClassName,
}: {
  title: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-[774px]", className)}>
      <p className="type-h4 text-primary">{title}</p>
      <div className="flex flex-row gap-6">
        <div className={cn("flex flex-col gap-6 w-full max-w-[500px]", leftClassName)}>
          {left}
        </div>
        <div className={cn("flex flex-col gap-6 w-full max-w-[250px]", rightClassName)}>
          {right}
        </div>
      </div>
    </div>
  );
}


