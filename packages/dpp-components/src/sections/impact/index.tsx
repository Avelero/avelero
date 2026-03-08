/**
 * Impact metrics sidebar section.
 *
 * Renders the transformed environmental metrics as a titled card stack with a helper link.
 */
import { DropIcon } from "@phosphor-icons/react/dist/ssr/Drop";
import { FactoryIcon } from "@phosphor-icons/react/dist/ssr/Factory";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr/Leaf";
import { RecycleIcon } from "@phosphor-icons/react/dist/ssr/Recycle";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import { toExternalHref } from "../../lib/url-utils";
import { transformImpactMetrics } from "../_transforms";
import type { SectionProps } from "../registry";

const ICON_MAP = {
  leaf: LeafIcon,
  drop: DropIcon,
  recycle: RecycleIcon,
  factory: FactoryIcon,
} as const;

export function ImpactSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and map the available impact metrics into cards.
  const s = resolveStyles(section.styles, tokens);
  const metrics = transformImpactMetrics(data);
  const { helpText, helpUrl } = section.content as {
    helpText?: string;
    helpUrl?: string;
  };
  const normalizedHelpUrl = toExternalHref(helpUrl);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const titleSelection = select("impact.title");
  const helpLinkSelection = select("impact.helpLink");
  const cardSelection = select("impact.card");
  const cardTypeSelection = select("impact.card.type");
  const cardValueSelection = select("impact.card.value");
  const cardUnitSelection = select("impact.card.unit");
  const cardIconSelection = select("impact.card.icon");
  const cardStyle: React.CSSProperties = {
    ...s.card,
    border: "none",
  };

  if (metrics.length === 0) return null;

  return (
    <div
      className={["flex flex-col gap-xs w-full", wrapperClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-end justify-between gap-md">
        <h6 {...titleSelection} style={s.title}>
          Impact
        </h6>
        {helpText && normalizedHelpUrl && (
          <a
            {...helpLinkSelection}
            href={normalizedHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 cursor-pointer text-right"
            style={s.helpLink}
          >
            {helpText}
          </a>
        )}
      </div>

      <div className="flex flex-col gap-md">
        {metrics.map((metric) => {
          const IconComponent = ICON_MAP[metric.icon] ?? LeafIcon;
          const iconStyle: React.CSSProperties = {
            ...s["card.icon"],
            color: metric.iconColor ?? s["card.icon"]?.color,
          };
          return (
            <div
              key={metric.type}
              {...cardSelection}
              className="flex items-center justify-between gap-md p-md"
              style={cardStyle}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-xs">
                <div {...cardTypeSelection} style={s["card.type"]}>
                  {metric.type}
                </div>
                <div className="flex flex-wrap items-baseline gap-micro">
                  <div {...cardValueSelection} style={s["card.value"]}>
                    {metric.value}
                  </div>
                  <div {...cardUnitSelection} style={s["card.unit"]}>
                    {metric.unit}
                  </div>
                </div>
              </div>
              <IconComponent
                {...cardIconSelection}
                className="shrink-0"
                style={iconStyle}
                weight="fill"
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
