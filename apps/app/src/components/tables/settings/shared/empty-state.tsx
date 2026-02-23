import { Button } from "@v1/ui/button";

export function SettingsTableEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="border border-border bg-background min-h-[220px] flex items-center justify-center px-6">
      <div className="text-center space-y-2">
        <p className="type-p text-primary">{title}</p>
        {description ? <p className="type-small text-secondary">{description}</p> : null}
        {actionLabel && onAction ? (
          <div className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
