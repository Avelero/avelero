import { ColorSelect, normalizeColorHex } from "@/components/select/color-select";
import type { FlatTableColumn } from "@/components/tables/settings/shared";
import { cn } from "@v1/ui/cn";
import { format } from "date-fns";
import * as React from "react";
import { isDraftTagListItem, type TagsTableRow } from "./types";

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy");
}

function TagNameCell({
  row,
  isEditing,
  focusRequest,
  onFocusRequestConsumed,
  onEditingTagIdChange,
  onCommitTagName,
  onUpdateTagColor,
}: {
  row: TagsTableRow;
  isEditing: boolean;
  focusRequest: { tagId: string; nonce: number } | null;
  onFocusRequestConsumed: (tagId: string) => void;
  onEditingTagIdChange: (id: string | null) => void;
  onCommitTagName: (row: TagsTableRow, nextName: string) => Promise<void>;
  onUpdateTagColor: (row: TagsTableRow, nextHex: string) => Promise<void>;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isCommittingRef = React.useRef(false);
  const [draftName, setDraftName] = React.useState(row.name);
  const [isColorOpen, setIsColorOpen] = React.useState(false);
  const [isNameHovered, setIsNameHovered] = React.useState(false);
  const showInputField = isEditing || isDraftTagListItem(row);
  const showInputShell = showInputField || isNameHovered;

  React.useEffect(() => {
    setDraftName(row.name);
  }, [row.name]);

  React.useEffect(() => {
    if (!focusRequest || focusRequest.tagId !== row.id) return;

    const input = inputRef.current;
    if (!input) return;

    requestAnimationFrame(() => {
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
      onFocusRequestConsumed(row.id);
    });
  }, [focusRequest, onFocusRequestConsumed, row.id]);

  const commitName = React.useCallback(async () => {
    if (isCommittingRef.current) return;
    let failed = false;

    const trimmed = draftName.trim();
    const current = row.name.trim();

    if (!trimmed) {
      if (isDraftTagListItem(row)) {
        try {
          await onCommitTagName(row, "");
        } catch {
          // noop
        }
        return;
      }

      setDraftName(row.name);
      onEditingTagIdChange(null);
      return;
    }

    if (trimmed === current) {
      setDraftName(row.name);
      onEditingTagIdChange(null);
      return;
    }

    isCommittingRef.current = true;
    try {
      await onCommitTagName(row, trimmed);
      setDraftName(trimmed);
    } catch {
      failed = true;
      if (!isDraftTagListItem(row)) {
        setDraftName(row.name);
      }
    } finally {
      isCommittingRef.current = false;
      if (!(failed && isDraftTagListItem(row))) {
        onEditingTagIdChange(null);
      }
    }
  }, [draftName, onCommitTagName, onEditingTagIdChange, row]);

  const handleColorChange = React.useCallback(
    async (nextHex: string) => {
      try {
        await onUpdateTagColor(row, nextHex);
      } catch {
        // toast/error handled by parent
      }
    },
    [onUpdateTagColor, row],
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      <ColorSelect
        value={row.hex}
        onValueChange={(nextHex) => void handleColorChange(nextHex)}
        open={isColorOpen}
        onOpenChange={setIsColorOpen}
        align="start"
      >
        <button
          type="button"
          aria-label={`Change color for ${row.name}`}
          className="group/color h-6 w-6 flex items-center justify-center rounded hover:bg-accent data-[state=open]:bg-accent"
          onMouseDown={(event) => {
            // Keep the inline text input focused while opening/selecting a color.
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full border border-border"
            style={{ backgroundColor: `#${normalizeColorHex(row.hex)}` }}
          />
        </button>
      </ColorSelect>

      <div
        className="relative inline-grid min-w-[200px] w-fit max-w-full"
        onMouseEnter={() => setIsNameHovered(true)}
        onMouseLeave={() => setIsNameHovered(false)}
      >
        <span
          aria-hidden
          className="invisible inline-flex h-8 min-w-[200px] max-w-full items-center whitespace-pre border border-transparent px-2 type-p"
        >
          {draftName || (isDraftTagListItem(row) ? "Tag name" : row.name) || " "}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onFocus={() => onEditingTagIdChange(row.id)}
          onBlur={() => {
            if (isColorOpen) return;
            void commitName();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftName(row.name);
              onEditingTagIdChange(null);
              event.currentTarget.blur();
            }
          }}
          className={cn(
            "absolute inset-0 h-8 w-full min-w-[200px] max-w-full px-2 type-p text-primary outline-none focus:outline-none",
            "border box-border",
            showInputShell
              ? "border-border bg-background"
              : "border-transparent bg-transparent",
          )}
          aria-label={`Tag name ${row.name}`}
          placeholder={isDraftTagListItem(row) ? "Tag name" : undefined}
        />
      </div>
    </div>
  );
}

export function getTagColumns({
  editingTagId,
  focusRequest,
  onFocusRequestConsumed,
  onEditingTagIdChange,
  onCommitTagName,
  onUpdateTagColor,
}: {
  editingTagId: string | null;
  focusRequest: { tagId: string; nonce: number } | null;
  onFocusRequestConsumed: (tagId: string) => void;
  onEditingTagIdChange: (id: string | null) => void;
  onCommitTagName: (row: TagsTableRow, nextName: string) => Promise<void>;
  onUpdateTagColor: (row: TagsTableRow, nextHex: string) => Promise<void>;
}): Array<FlatTableColumn<TagsTableRow>> {
  return [
    {
      id: "name",
      header: "Tag",
      headerClassName: "min-w-[320px]",
      cellClassName: "min-w-[320px]",
      cell: (row) => (
        <TagNameCell
          row={row}
          isEditing={editingTagId === row.id}
          focusRequest={focusRequest}
          onFocusRequestConsumed={onFocusRequestConsumed}
          onEditingTagIdChange={onEditingTagIdChange}
          onCommitTagName={onCommitTagName}
          onUpdateTagColor={onUpdateTagColor}
        />
      ),
    },
    {
      id: "products_count",
      header: "Products",
      headerClassName: "w-[120px] min-w-[120px]",
      cellClassName: "w-[120px] min-w-[120px]",
      cell: (row) => (
        <span className="type-p text-primary">{row.products_count ?? 0}</span>
      ),
    },
    {
      id: "created_at",
      header: "Created",
      headerClassName: "w-[200px] min-w-[200px]",
      cellClassName: cn("w-[200px] min-w-[200px]"),
      cell: (row) => (
        <span className="type-p text-primary">
          {isDraftTagListItem(row) ? "" : formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      id: "updated_at",
      header: "Updated",
      headerClassName: "w-[240px] min-w-[240px]",
      cellClassName: "w-[240px] min-w-[240px]",
      cell: (row) => (
        <span className="type-p text-primary">
          {isDraftTagListItem(row) ? "" : formatDate(row.updatedAt)}
        </span>
      ),
    },
  ];
}
