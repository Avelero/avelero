import { DropIcon } from "@phosphor-icons/react/dist/ssr/Drop";
import { FactoryIcon } from "@phosphor-icons/react/dist/ssr/Factory";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr/Leaf";
import { RecycleIcon } from "@phosphor-icons/react/dist/ssr/Recycle";
import { resolveStyles } from "../../lib/resolve-styles";
import { transformImpactMetrics } from "../_transforms";
import type { SectionProps } from "../registry";

const ICON_MAP = {
  leaf: LeafIcon,
  drop: DropIcon,
  recycle: RecycleIcon,
  factory: FactoryIcon,
} as const;

export function ImpactSection({ section, tokens, data }: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const metrics = transformImpactMetrics(data);

  if (metrics.length === 0) return null;

  return (
    <div className="px-sm @3xl:px-0 flex flex-col gap-sm">
      <h6 style={s.title}>Impact</h6>

      <div className="flex flex-col gap-sm">
        {metrics.map((metric) => {
          const IconComponent = ICON_MAP[metric.icon] ?? LeafIcon;
          return (
            <div
              key={metric.type}
              className="p-md border flex justify-between items-center"
              style={s.card}
            >
              <div className="flex flex-col gap-xs">
                <div style={s["card.type"]}>{metric.type}</div>
                <div className="flex items-end gap-micro">
                  <div style={s["card.value"]}>{metric.value}</div>
                  <div style={s["card.unit"]}>{metric.unit}</div>
                </div>
              </div>
              <IconComponent style={s["card.icon"]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
