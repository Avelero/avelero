"use client";

/**
 * Impact metrics sidebar section.
 *
 * Renders the transformed environmental metrics as a titled card stack with a helper link.
 */

import { DropIcon } from "@phosphor-icons/react/dist/ssr/Drop";
import { FactoryIcon } from "@phosphor-icons/react/dist/ssr/Factory";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr/Leaf";
import { RecycleIcon } from "@phosphor-icons/react/dist/ssr/Recycle";
import { useState } from "react";
import { ImpactModal, Modal } from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { useHapticTap } from "../../lib/haptics";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";
import { transformImpactMetrics } from "../transforms";

const ICON_MAP = {
  leaf: LeafIcon,
  drop: DropIcon,
  recycle: RecycleIcon,
  factory: FactoryIcon,
} as const;

const IMPACT_MODAL_TRIGGER_LABEL = "What does this mean?";

function createImpactModalSelectionGetter(
  select: ReturnType<typeof createSectionSelectionAttributes>,
) {
  // Scope modal slot ids to the impact section namespace for editor selection.
  return (slotId: string) => select(`impact.${slotId}`);
}

function buildImpactModalFacts(
  metrics: ReturnType<typeof transformImpactMetrics>,
) {
  // Present the available impact metrics as scannable modal fact rows.
  return metrics.map((metric) => ({
    label: metric.type,
    value: `${metric.value} ${metric.unit}`,
  }));
}

export function ImpactSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
  modalStyles,
}: SectionProps) {
  // Resolve styles and map the available impact metrics into cards.
  const s = resolveStyles(section.styles, tokens);
  const metrics = transformImpactMetrics(data);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hapticTap = useHapticTap();
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const titleSelection = select("impact.title");
  const helpLinkSelection = select("impact.helpLink");
  const cardSelection = select("impact.card");
  const cardTypeSelection = select("impact.card.type");
  const cardValueSelection = select("impact.card.value");
  const cardUnitSelection = select("impact.card.unit");
  const cardIconSelection = select("impact.card.icon");
  const helpLinkStyle = createInteractiveHoverStyle(s.helpLink, {
    color: true,
  });
  const modalSelect = createImpactModalSelectionGetter(select);
  const modalFacts = buildImpactModalFacts(metrics);
  const primaryMetric = metrics[0];

  if (metrics.length === 0) return null;

  return (
    <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
      <div
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex flex-wrap items-end justify-between gap-md">
          <h6 {...titleSelection} style={s.title}>
            Impact
          </h6>
          <button
            {...helpLinkSelection}
            type="button"
            className={`appearance-none border-0 bg-transparent p-0 underline underline-offset-4 cursor-pointer text-right ${INTERACTIVE_HOVER_CLASS_NAME}`}
            style={helpLinkStyle}
            onClick={() => {
              hapticTap();
              setIsModalOpen(true);
            }}
          >
            {IMPACT_MODAL_TRIGGER_LABEL}
          </button>
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
                style={s.card}
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

      <ImpactModal
        description="Impact metrics summarize the environmental footprint data currently attached to this product passport. Use them to compare products in context, not as standalone claims."
        equivalentLabel={primaryMetric ? primaryMetric.type : "Reported metric"}
        equivalentValue={
          primaryMetric
            ? `${primaryMetric.value} ${primaryMetric.unit}`
            : "No impact data available."
        }
        facts={modalFacts}
        select={modalSelect}
        styles={modalStyles ?? {}}
        subtitle="Impact clarification"
        title="Impact"
      />
    </Modal>
  );
}
