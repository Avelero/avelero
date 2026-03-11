"use client";

/**
 * Journey sidebar section.
 *
 * Renders the product journey as a vertical timeline inside a shadowed card shell.
 */

import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { useState } from "react";
import { Modal, OperatorModal } from "../../components";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { useHapticTap } from "../../lib/haptics";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import { getResolvedTextLineHeight } from "../../lib/text-line-height";
import { toExternalHref } from "../../lib/url-utils";
import type { SectionProps } from "../registry";
import { getCountryName, transformJourney } from "../transforms";

const TIMELINE_COLUMN_WIDTH = 48;
const TIMELINE_DOT_SIZE = 8;
const TIMELINE_LINE_WIDTH = 2;
const TIMELINE_STAGE_PADDING = 16;
const TIMELINE_FADE_HEIGHT = "min(120px, 60%)";

type JourneyCompany = ReturnType<
  typeof transformJourney
>[number]["companies"][number];

function buildOperatorModalFacts(stageName: string, company: JourneyCompany) {
  // Gather the operator details that should appear in the quick overview modal.
  const facts: Array<{
    key: string;
    label: string;
    value: React.ReactNode;
  }> = [];

  if (company.name) {
    facts.push({ key: "Name", label: "Name", value: company.name });
  }

  facts.push({ key: "Role", label: "Role", value: stageName });

  if (company.legalName && company.legalName !== company.name) {
    facts.push({
      key: "Legal name",
      label: "Legal name",
      value: company.legalName,
    });
  }

  if (company.website) {
    const operatorHref = toExternalHref(company.website);

    facts.push({
      key: "Website",
      label: "Website",
      value: operatorHref ? (
        <a
          className="underline underline-offset-4"
          href={operatorHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {company.website}
        </a>
      ) : (
        company.website
      ),
    });
  }

  if (company.email) {
    facts.push({ key: "Email", label: "Email", value: company.email });
  }

  if (company.phone) {
    facts.push({ key: "Phone", label: "Phone", value: company.phone });
  }

  if (company.city) {
    facts.push({ key: "City", label: "City", value: company.city });
  }

  if (company.countryCode) {
    facts.push({
      key: "Country",
      label: "Country",
      value: getCountryName(company.countryCode) || company.countryCode,
    });
  }

  return facts;
}

function buildOperatorMapQuery(
  company: JourneyCompany,
  showExactLocation: boolean,
): string | null {
  // Collapse the operator address into either an exact or city-level Google Maps query.
  const country = company.countryCode
    ? getCountryName(company.countryCode) ?? company.countryCode
    : undefined;
  const queryParts = (
    showExactLocation
      ? [
          company.addressLine1,
          company.city,
          company.state,
          company.zip,
          country,
        ]
      : [company.city, country]
  )
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (queryParts.length === 0) {
    return null;
  }

  return queryParts.join(", ");
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
  modalContent,
  modalStyles,
  forceModalType,
}: SectionProps) {
  // Resolve styles and build the stage timeline for the sidebar card.
  const s = resolveStyles(section.styles, tokens);
  const isForceOpen = forceModalType === "journey";
  const journey = transformJourney(data);
  const [isOperatorDialogOpen, setIsOperatorDialogOpen] = useState(false);
  const hapticTap = useHapticTap();
  const [selectedOperator, setSelectedOperator] = useState<{
    company: JourneyCompany;
    stageName: string;
  } | null>(null);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("journey");

  if (journey.length === 0) return null;

  // Use resolved colors for the timeline and stage dividers, with border as fallback.
  const lineColor = s["card.line"]?.backgroundColor ?? "var(--border)";
  const dotColor = s["card.dot"]?.backgroundColor ?? lineColor;
  const dividerColor = s.card?.borderColor ?? "var(--border)";
  const operatorStyle = createInteractiveHoverStyle(s["card.operator"], {
    color: true,
  });
  const showExactLocation = modalContent?.showExactLocation !== false;
  const titleRowHeight = getResolvedTextLineHeight(
    s["card.type"],
    tokens.typography.h6.fontSize * tokens.typography.h6.lineHeight,
  );
  const locationRowHeight = getResolvedTextLineHeight(
    s["card.location"],
    tokens.typography.body.fontSize * tokens.typography.body.lineHeight,
  );

  return (
    <Modal
      open={isOperatorDialogOpen || isForceOpen}
      onOpenChange={setIsOperatorDialogOpen}
      modal={!isForceOpen}
    >
      <div
        {...rootSelection}
        className={["flex flex-col gap-xs w-full", wrapperClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <h6 style={s.title}>Journey</h6>

        <div className="overflow-hidden" style={s.card}>
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
                  <div className="absolute" style={timelineLineStyle} />
                  <div
                    className="flex w-full items-center justify-center"
                    style={{ minHeight: titleRowHeight }}
                  >
                    <div
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
                    <span className="block" style={s["card.type"]}>
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
                              style={s["card.locationIcon"]}
                              aria-hidden="true"
                            />
                          </div>
                          <div
                            className="min-w-0"
                            style={{
                              minHeight: locationRowHeight,
                              lineHeight: locationRowHeight,
                            }}
                          >
                            {/* Keep operator, separator, and location in one text flow so the location can wrap naturally. */}
                            <span className="min-w-0 break-words">
                              <button
                                type="button"
                                className={`inline cursor-pointer appearance-none border-0 bg-transparent p-0 align-baseline underline underline-offset-4 ${INTERACTIVE_HOVER_CLASS_NAME}`}
                                style={operatorStyle}
                                onClick={() => {
                                  hapticTap();
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
                              {company.location && (
                                <span
                                  aria-hidden="true"
                                  style={s["card.location"]}
                                >
                                  {"\u00A0• "}
                                </span>
                              )}
                              {company.location && (
                                <span
                                  className="break-words"
                                  style={s["card.location"]}
                                >
                                  {company.location}
                                </span>
                              )}
                            </span>
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

      {(() => {
        const operator =
          selectedOperator ??
          (isForceOpen && journey[0]?.companies[0]
            ? { company: journey[0].companies[0], stageName: journey[0].name }
            : null);
        if (!operator) return null;
        return (
          <OperatorModal
            description={`This operator is responsible for the ${operator.stageName.toLowerCase()} step recorded in the product journey.`}
            facts={buildOperatorModalFacts(
              operator.stageName,
              operator.company,
            )}
            mapQuery={buildOperatorMapQuery(
              operator.company,
              showExactLocation,
            )}
            styles={modalStyles ?? {}}
            subtitle="Supply chain operator"
            title={operator.company.name}
          />
        );
      })()}
    </Modal>
  );
}
