import { cn } from "@v1/ui/cn";

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



