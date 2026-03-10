/**
 * Registry-based layout renderer.
 *
 * Product image is fixed in the left column.
 * Sidebar sections render in the right column.
 * Canvas sections render full-width below the columns.
 */

import { resolveStyles } from "../../lib/resolve-styles";
import { SECTION_REGISTRY } from "../../sections/registry";
import type { DppContent } from "../../types/content";
import type { DppData } from "../../types/data";
import type { Passport } from "../../types/passport";
import { ProductImage } from "./product-image";

interface Props {
  passport: Passport;
  data: DppData;
  content?: DppContent;
}

/** Builds the sidebar section shell classes for selectable spacing. */
function getSidebarSectionWrapperClassName(index: number, isLast: boolean): string {
  // Give each sidebar section its own 16px shell while collapsing the top edge of the first and bottom edge of the last.
  return ["w-full", "px-md", index === 0 ? "pt-0" : "pt-md", isLast ? "pb-0" : "pb-md"].join(" ");
}

/** Builds the shared canvas section shell classes for consistent alignment. */
function getCanvasSectionWrapperClassName(): string {
  // Keep every canvas block aligned to the shared content container.
  return "max-w-container py-8 mx-auto w-full @md:px-md";
}

export function LayoutRenderer({ passport, data, content }: Props) {
  // Render the fixed left media column and the dynamic right-hand section stack.
  const { tokens, sidebar, canvas } = passport;
  const modalStyles = resolveStyles(passport.modal.styles, tokens);
  const modalContent = passport.modal.content ?? { showExactLocation: true };

  return (
    <main className="flex-grow flex flex-col pb-xl w-full">
      <div className="flex flex-col">
        {/* Two-column grid: product image + sidebar sections */}
        <div className="max-w-container mx-auto w-full @md:px-lg">
          <div className="grid grid-cols-1 @md:grid-cols-[1fr_min(calc(50%_-_16px),452px)] @md:gap-xl w-full">
            {/* Left column — product image (hardcoded) */}
            <div className="w-full">
              <div className="@md:sticky @md:top-[var(--header-height)] flex flex-col gap-2x">
                <ProductImage
                  productImage={passport.productImage}
                  tokens={tokens}
                  image={data.productIdentifiers.productImage}
                  alt={`${data.productAttributes.brand} ${data.productIdentifiers.productName}`}
                />
              </div>
            </div>

            {/* Right column — sidebar sections */}
            <div className="@md:flex @md:justify-end @md:w-full">
              <div className="@md:max-w-[452px]">
                <div className="relative flex flex-col overflow-visible @md:ml-auto @md:w-full pb-8 @md:py-12">
                  {sidebar.map((section, index) => {
                    const entry = SECTION_REGISTRY[section.type];
                    if (!entry) return null;
                    const Component = entry.component;
                    return (
                      <Component
                        key={section.id}
                        section={section}
                        tokens={tokens}
                        data={data}
                        zoneId="sidebar"
                        content={content}
                        modalContent={modalContent}
                        modalStyles={modalStyles}
                        wrapperClassName={getSidebarSectionWrapperClassName(
                          index,
                          index === sidebar.length - 1,
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas sections — full-width below columns */}
        {canvas.length > 0 && (
          <div className="max-w-container mx-auto w-full @md:px-lg">
            {canvas.map((section) => {
              const entry = SECTION_REGISTRY[section.type];
              if (!entry) return null;
              const Component = entry.component;
              return (
                <Component
                  key={section.id}
                  section={section}
                  tokens={tokens}
                  data={data}
                  zoneId="canvas"
                  content={content}
                  modalContent={modalContent}
                  modalStyles={modalStyles}
                  wrapperClassName={getCanvasSectionWrapperClassName()}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
