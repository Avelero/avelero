"use client";

/**
 * Journey sidebar section.
 *
 * Renders the product journey as a vertical timeline inside a shadowed card shell.
 */

import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { useState } from "react";
import { OperatorModal, ResponsiveDialog } from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { getResolvedTextLineHeight } from "../../lib/text-line-height";
import { toExternalHref } from "../../lib/url-utils";
import { transformJourney } from "../_transforms";
import type { SectionProps } from "../registry";

const TIMELINE_COLUMN_WIDTH = 48;
const TIMELINE_DOT_SIZE = 8;
const TIMELINE_LINE_WIDTH = 2;
const TIMELINE_STAGE_PADDING = 16;
const TIMELINE_FADE_HEIGHT = "min(120px, 60%)";

type JourneyCompany = ReturnType<
  typeof transformJourney
>[number]["companies"][number];

function createJourneyModalSelectionGetter(
  select: ReturnType<typeof createSectionSelectionAttributes>,
) {
  // Scope modal slot ids to the journey section namespace for editor selection.
  return (slotId: string) => select(`journey.${slotId}`);
}

function buildOperatorModalFacts(stageName: string, company: JourneyCompany) {
  // Gather the operator details that should appear in the quick overview modal.
  const facts: Array<{ label: string; value: React.ReactNode }> = [];

  if (company.location) {
    facts.push({ label: "Location", value: company.location });
  }

  facts.push({ label: "Role", value: stageName });

  if (company.url) {
    const operatorHref = toExternalHref(company.url);

    facts.push({
      label: "Website",
      value: operatorHref ? (
        <a
          className="underline underline-offset-4"
          href={operatorHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {company.url}
        </a>
      ) : (
        company.url
      ),
    });
  }

  if (company.email) {
    facts.push({ label: "Contact", value: company.email });
  }

  if (company.phone) {
    facts.push({ label: "Phone", value: company.phone });
  }

  return facts;
}

function getFirstStageLineTop(titleRowHeight: string | number) {
  // Start the first stage rail at the dot center instead of the card's top edge.
  if (typeof titleRowHeight === "number") {
    return TIMELINE_STAGE_PADDING + titleRowHeight / 2;
  }

  return `calc(${TIMELINE_STAGE_PADDING}px + (${titleRowHeight}) / 2)`;
}

export function JourneySection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and build the stage timeline for the sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const journey = transformJourney(data);
  const [isOperatorDialogOpen, setIsOperatorDialogOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<{
    company: JourneyCompany;
    stageName: string;
  } | null>(null);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const titleSelection = select("journey.title");
  const cardSelection = select("journey.card");
  const typeSelection = select("journey.card.type");
  const operatorSelection = select("journey.card.operator");
  const locationSelection = select("journey.card.location");
  const locationIconSelection = select("journey.card.locationIcon");
  const lineSelection = select("journey.card.line");
  const dotSelection = select("journey.card.dot");

  if (journey.length === 0) return null;

  // Use resolved colors for the timeline and stage dividers, with border as fallback.
  const lineColor = s["card.line"]?.backgroundColor ?? "var(--border)";
  const dotColor = s["card.dot"]?.backgroundColor ?? lineColor;
  const dividerColor = s.card?.borderColor ?? "var(--border)";
  const operatorStyle = createInteractiveHoverStyle(s["card.operator"], {
    color: true,
  });
  const modalSelect = createJourneyModalSelectionGetter(select);
  const titleRowHeight = getResolvedTextLineHeight(
    s["card.type"],
    tokens.typography.h6.fontSize * tokens.typography.h6.lineHeight,
  );
  const locationRowHeight = getResolvedTextLineHeight(
    s["card.location"],
    tokens.typography.body.fontSize * tokens.typography.body.lineHeight,
  );

  return (
    <ResponsiveDialog
      open={isOperatorDialogOpen}
      onOpenChange={setIsOperatorDialogOpen}
    >
      <div
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <h6 {...titleSelection} style={s.title}>
          Journey
        </h6>

        <div {...cardSelection} className="overflow-hidden" style={s.card}>
          {journey.map((stage, stageIndex) => {
            const isFirstStage = stageIndex === 0;
            const isLastStage = stageIndex === journey.length - 1;
            const lineMaskImage = `linear-gradient(to bottom, #000 0, #000 calc(100% - ${TIMELINE_FADE_HEIGHT}), transparent 100%)`;
            const timelineLineStyle: React.CSSProperties = {
              top: isFirstStage ? getFirstStageLineTop(titleRowHeight) : 0,
              bottom: isLastStage ? `${TIMELINE_STAGE_PADDING}px` : 0,
              left: "50%",
              width: 0,
              transform: "translateX(-50%)",
              borderLeft: `${TIMELINE_LINE_WIDTH}px dotted ${lineColor}`,
            };

            if (isLastStage) {
              timelineLineStyle.maskImage = lineMaskImage;
              timelineLineStyle.WebkitMaskImage = lineMaskImage;
              timelineLineStyle.maskRepeat = "no-repeat";
              timelineLineStyle.WebkitMaskRepeat = "no-repeat";
            }

            return (
              <div
                key={stage.id}
                className="grid overflow-hidden"
                style={{
                  gridTemplateColumns: `${TIMELINE_COLUMN_WIDTH}px minmax(0, 1fr)`,
                }}
              >
                <div className="relative flex flex-col items-center px-md pt-md pb-md">
                  {/* Keep the rail separate from the content column so dividers stop at the text edge. */}
                  <div
                    {...lineSelection}
                    className="absolute"
                    style={timelineLineStyle}
                  />
                  <div
                    className="flex w-full items-center justify-center"
                    style={{ minHeight: titleRowHeight }}
                  >
                    <div
                      {...dotSelection}
                      className="relative z-10 rounded-full"
                      style={{
                        ...s["card.dot"],
                        width: `${TIMELINE_DOT_SIZE}px`,
                        height: `${TIMELINE_DOT_SIZE}px`,
                        backgroundColor: dotColor,
                      }}
                    />
                  </div>
                </div>

                <div
                  className="min-w-0 flex flex-col gap-xs pt-md pr-md pb-md"
                  style={
                    isLastStage
                      ? undefined
                      : {
                          borderBottom: `1px solid ${dividerColor}`,
                        }
                  }
                >
                  <div
                    className="flex items-center"
                    style={{ minHeight: titleRowHeight }}
                  >
                    <span
                      {...typeSelection}
                      className="block"
                      style={s["card.type"]}
                    >
                      {stage.name}
                    </span>
                  </div>

                  <div className="flex flex-col gap-xs">
                    {stage.companies.map((company) => {
                      return (
                        <div
                          key={`${stageIndex}-${company.name}-${company.location}`}
                          className="flex items-start gap-xs"
                        >
                          <div
                            className="flex shrink-0 items-center"
                            style={{ height: locationRowHeight }}
                          >
                            <MapPinIcon
                              {...locationIconSelection}
                              style={s["card.locationIcon"]}
                              aria-hidden="true"
                            />
                          </div>
                          <div
                            className="min-w-0 flex flex-wrap items-start gap-micro"
                            style={{
                              minHeight: locationRowHeight,
                              lineHeight: locationRowHeight,
                            }}
                          >
                            <span
                              className="min-w-0 inline-flex items-center"
                              style={{ minHeight: locationRowHeight }}
                            >
                              <button
                                {...operatorSelection}
                                type="button"
                                className={`appearance-none border-0 bg-transparent p-0 cursor-pointer underline underline-offset-4 ${INTERACTIVE_HOVER_CLASS_NAME}`}
                                style={operatorStyle}
                                onClick={() => {
                                  // Keep the selected operator mounted while the dialog animates out.
                                  setSelectedOperator({
                                    company,
                                    stageName: stage.name,
                                  });
                                  setIsOperatorDialogOpen(true);
                                }}
                              >
                                {company.name}
                              </button>
                            </span>
                            {company.location && (
                              <span
                                aria-hidden="true"
                                className="inline-flex items-center"
                                style={{
                                  ...s["card.location"],
                                  minHeight: locationRowHeight,
                                }}
                              >
                                •
                              </span>
                            )}
                            {company.location && (
                              <span
                                {...locationSelection}
                                className="inline-flex items-center"
                                style={{
                                  ...s["card.location"],
                                  minHeight: locationRowHeight,
                                }}
                              >
                                {company.location}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedOperator ? (
        <OperatorModal
          description={`This operator is responsible for the ${selectedOperator.stageName.toLowerCase()} step recorded in the product journey.`}
          facts={buildOperatorModalFacts(
            selectedOperator.stageName,
            selectedOperator.company,
          )}
          select={modalSelect}
          styles={s}
          subtitle="Supply chain operator"
          title={selectedOperator.company.name}
        />
      ) : null}
    </ResponsiveDialog>
  );
}
