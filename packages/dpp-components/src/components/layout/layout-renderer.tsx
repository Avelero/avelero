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
function getSidebarSectionWrapperClassName(
  index: number,
  sidebarLength: number,
): string {
  // Give each sidebar section its own 16px shell while collapsing the outer edges.
  return [
    "w-full",
    "px-md",
    index === 0 ? "pt-0" : "pt-md",
    index === sidebarLength - 1 ? "pb-0" : "pb-md",
  ].join(" ");
}

export function LayoutRenderer({ passport, data, content }: Props) {
  // Render the fixed left media column and the dynamic right-hand section stack.
  const { tokens, sidebar, canvas } = passport;
  const modalStyles = resolveStyles(passport.modal.styles, tokens);

  return (
    <main className="flex-grow flex flex-col pb-xl w-full">
      <div className="flex flex-col">
        {/* Two-column grid: product image + sidebar sections */}
        <div className="max-w-container mx-auto w-full @3xl:px-lg">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 @3xl:gap-lg w-full">
            {/* Left column — product image (hardcoded) */}
            <div className="w-full">
              <div className="@3xl:sticky @3xl:top-[var(--header-height)] flex flex-col gap-2x">
                <ProductImage
                  productImage={passport.productImage}
                  tokens={tokens}
                  image={data.productIdentifiers.productImage}
                  alt={`${data.productAttributes.brand} ${data.productIdentifiers.productName}`}
                />
              </div>
            </div>

            {/* Right column — sidebar sections */}
            <div className="@3xl:flex @3xl:justify-end @3xl:w-full">
              <div className="@3xl:max-w-[428px]">
                <div className="relative flex flex-col overflow-visible @3xl:ml-auto @3xl:w-full @3xl:py-12">
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
                        modalStyles={modalStyles}
                        wrapperClassName={getSidebarSectionWrapperClassName(
                          index,
                          sidebar.length,
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
          <div className="w-full">
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
                  modalStyles={modalStyles}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
