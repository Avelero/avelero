/**
 * Registry-based layout renderer.
 *
 * Product image is hardcoded in the left column.
 * Sidebar sections render in the right column.
 * Canvas sections render full-width below the columns.
 */

import { SECTION_REGISTRY } from "../../sections/registry";
import type { DppContent } from "../../types/dpp-content";
import type { DppData } from "../../types/dpp-data";
import type { Passport } from "../../types/passport";
import { ProductImage } from "./product-image";

interface Props {
  passport: Passport;
  data: DppData;
  content?: DppContent;
}

export function LayoutRenderer({ passport, data, content }: Props) {
  // Render the fixed left media column and the dynamic right-hand section stack.
  const { tokens, sidebar, canvas } = passport;

  return (
    <main className="flex-grow flex flex-col pb-xl w-full">
      <div className="flex flex-col">
        {/* Two-column grid: product image + sidebar sections */}
        <div className="max-w-container mx-auto w-full @3xl:px-lg">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 @3xl:gap-lg w-full">
            {/* Left column — product image (hardcoded) */}
            <div className="w-full">
              <div className="@3xl:sticky @3xl:top-[65px] flex flex-col gap-2x">
                <ProductImage
                  image={data.productIdentifiers.productImage}
                  alt={`${data.productAttributes.brand} ${data.productIdentifiers.productName}`}
                />
              </div>
            </div>

            {/* Right column — sidebar sections */}
            <div className="@3xl:flex @3xl:justify-end @3xl:w-full">
              <div className="@3xl:w-5/6">
                <div className="flex flex-col gap-2x overflow-x-hidden relative @3xl:ml-auto @3xl:w-full">
                  {sidebar.map((section) => {
                    const entry = SECTION_REGISTRY[section.type];
                    if (!entry) return null;
                    const Component = entry.component;
                    return (
                      <Component
                        key={section.id}
                        section={section}
                        tokens={tokens}
                        data={data}
                        content={content}
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
                  content={content}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
