import { Icons } from "@v1/ui/icons";

const NAV_ITEMS = [
  { label: "Logo" },
  { label: "First menu" },
  { label: "Second menu" },
  { label: "Product carousel" },
  { label: "Banner" },
  { label: "Socials" },
];

export function DesignLeftPanel() {
  return (
    <div className="flex h-full w-[300px] flex-col border-r bg-background">
      <div className="flex  w-full px-6 py-3 border-b border-border justify-start items-center">
        <p className="type-p !font-medium text-foreground">Content</p>
      </div>
      <div className="flex flex-col p-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="group flex items-center justify-between px-3 py-2.5 text-left type-p text-primary hover:bg-accent transition-colors duration-100 ease-out"
          >
            <div className="flex items-center gap-2">
              <Icons.Folder className="h-4 w-4" />
              <span className="type-p truncate">
              {item.label}
              </span>
            </div>
            <Icons.ChevronRight className="h-4 w-4 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
