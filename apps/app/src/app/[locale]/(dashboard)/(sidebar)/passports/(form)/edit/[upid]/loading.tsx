import { Icons } from "@v1/ui/icons";

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Icons.Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

