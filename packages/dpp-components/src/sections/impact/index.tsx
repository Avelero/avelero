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

function getMetricIconStyle(
  metricIcon: string,
  styles: Record<string, React.CSSProperties | undefined>,
  fallbackColor?: string,
): React.CSSProperties {
  // Resolve the shared icon sizing plus the metric-specific color slot.
  const specificStyle =
    metricIcon === "leaf"
      ? styles["card.carbonIcon"]
      : metricIcon === "drop"
        ? styles["card.waterIcon"]
        : undefined;

  return {
    ...styles["card.icon"],
    ...specificStyle,
    color: specificStyle?.color ?? fallbackColor ?? styles["card.icon"]?.color,
  };
}

export function ImpactSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
  modalStyles,
  forceModalType,
}: SectionProps) {
  // Resolve styles and map the available impact metrics into cards.
  const s = resolveStyles(section.styles, tokens);
  const metrics = transformImpactMetrics(data);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isForceOpen = forceModalType === "impact";
  const hapticTap = useHapticTap();
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("impact");
  const helpLinkStyle = createInteractiveHoverStyle(s.helpLink, {
    color: true,
  });

  if (metrics.length === 0) return null;

  return (
    <Modal
      open={isModalOpen || isForceOpen}
      onOpenChange={setIsModalOpen}
      modal={!isForceOpen}
    >
      <div
        {...rootSelection}
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex flex-wrap items-end justify-between gap-md">
          <h6 style={s.title}>Impact</h6>
          <button
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
            const iconStyle = getMetricIconStyle(
              metric.icon,
              s,
              metric.iconColor,
            );
            return (
              <div
                key={metric.type}
                className="flex items-center justify-between gap-md p-md"
                style={s.card}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-micro">
                  <div style={s["card.type"]}>{metric.type}</div>
                  <div className="flex flex-wrap items-baseline gap-micro">
                    <div style={s["card.value"]}>{metric.value}</div>
                    <div style={s["card.unit"]}>{metric.unit}</div>
                  </div>
                </div>
                <IconComponent
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
        cardStyles={{
          type: s["card.type"],
          value: s["card.value"],
          unit: s["card.unit"],
        }}
        metrics={metrics.map((m) => ({
          type: m.type,
          value: Number(m.value),
          unit: m.unit,
        }))}
        styles={modalStyles ?? {}}
      />
    </Modal>
  );
}
