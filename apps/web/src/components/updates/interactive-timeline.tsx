"use client";

import { useState } from "react";

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

const timelineEvents: TimelineEvent[] = [
  {
    date: "30 March 2022",

    title: "ESPR proposed alongside EU Textile Strategy",
    description:
      "The European Commission publishes both the ESPR proposal and the EU Strategy for Sustainable and Circular Textiles on the same day, naming Digital Product Passports as a core mechanism for textile transparency.",
  },
  {
    date: "18 July 2024",

    title: "ESPR enters into force",
    description:
      "The Ecodesign for Sustainable Products Regulation is officially enacted as Regulation (EU) 2024/1781, establishing the legal framework for Digital Product Passports across product categories.",
  },
  {
    date: "16 April 2025",

    title: "ESPR Working Plan 2025-2030 adopted",
    description:
      "The European Commission publishes its first working plan, officially designating textiles (apparel) as a top-priority product group for ecodesign requirements and DPP, with a delegated act adoption target of 2027.",
  },
  {
    date: "19 July 2026",

    title: "DPP Registry operational + ban on destruction of unsold textiles",
    description:
      "The central DPP registry must be operational per ESPR Article 13. On the same date, the ban on destruction of unsold textiles and footwear takes effect for large enterprises. Medium enterprises are exempt until July 2030.",
  },
  {
    date: "27 September 2026",

    title: "Empowering Consumers Directive becomes binding",
    description:
      "Generic green claims and offset-based climate-neutrality claims are prohibited across the EU. Brands will need verifiable product-level data to substantiate any environmental claims.",
  },
  {
    date: "Late 2026 - Q2 2027",

    title: "Textile delegated act adopted",
    description:
      "The delegated act for textiles is expected to be adopted, defining the specific data fields, scope, and compliance requirements for the textile DPP. The ESPR Working Plan targets 2027; most industry sources project late 2026 to Q2 2027.",
  },
  {
    date: "14 December 2027",

    title: "Forced Labour Regulation fully applicable",
    description:
      "Regulation (EU) 2024/3015 bans products made with forced labour from the EU market. DPP traceability data will be directly relevant for demonstrating compliance. Textiles and fashion are among the most exposed industries.",
  },
  {
    date: "~April 2028",

    title: "EU-wide textile EPR schemes operational",
    description:
      "Under the revised Waste Framework Directive, all EU Member States must have operational Extended Producer Responsibility schemes for textiles. Eco-modulated fees will draw on the same product attributes tracked in DPPs.",
  },
  {
    date: "~Mid-2028",

    title: "DPPs mandatory for new textile products on the EU market",
    description:
      "Based on 18 months after the expected delegated act adoption, every new garment, accessory, or textile product entering the EU market will need a functioning Digital Product Passport with all required data fields populated.",
  },
];

export function InteractiveTimeline() {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  return (
    <div className="my-10">
      {timelineEvents.map((event, index) => {
        const isActive = activeIndex === index;

        return (
          <div key={event.title} className="border-b border-border">
            <button
              type="button"
              onClick={() => setActiveIndex(isActive ? null : index)}
              className="w-full cursor-pointer py-4 text-left"
              aria-expanded={isActive}
              aria-controls={`timeline-item-content-${index}`}
            >
              <p className="text-micro text-foreground/50">{event.date}</p>
              <p className="mt-1 text-small text-foreground">{event.title}</p>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div
                  id={`timeline-item-content-${index}`}
                  className="pb-4 text-small text-foreground/60"
                >
                  {event.description}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
