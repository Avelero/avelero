import { Icons } from "@v1/ui/icons";

const TYPO_ITEMS = [
  "Heading 1",
  "Heading 2",
  "Heading 3",
  "Heading 4",
  "Heading 5",
  "Heading 6",
  "Body",
  "Small",
  "Colors",
];

export function DesignRightPanel() {
  return (
    <div className="flex h-full w-[300px] flex-col border-l bg-background">
      <div className="flex  w-full px-6 py-3 border-b border-border justify-start items-center">
        <p className="type-p !font-medium text-foreground">Theme</p>
      </div>
      <div className="flex flex-col">
        {TYPO_ITEMS.map((item) => (
            <button
            key={item}
            type="button"
            className="group flex items-center justify-between px-6 py-3 text-left type-p text-primary hover:bg-accent transition-colors duration-100 ease-out border-b border-border"
          >
            <span className="type-p truncate">{item}</span>
            <Icons.ChevronDown className="h-4 w-4 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
