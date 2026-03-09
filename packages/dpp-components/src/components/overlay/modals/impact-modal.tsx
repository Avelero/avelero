"use client";

/**
 * Mock impact clarification modal content.
 */

import {
  DppModalContent,
  DppModalDescription,
  DppModalField,
  DppModalSection,
  DppModalSubtitle,
  DppModalTitle,
  DppModalValue,
  getModalSelectionProps,
} from "./modal-building-blocks";
import type {
  DppModalSelectionGetter,
  DppModalStyles,
} from "./modal-building-blocks";

interface ImpactModalFact {
  label: string;
  value: string;
}

interface ImpactModalProps {
  description?: string;
  equivalentLabel?: string;
  equivalentValue?: string;
  facts?: ImpactModalFact[];
  select?: DppModalSelectionGetter;
  styles: DppModalStyles;
  subtitle?: string;
  title?: string;
}

const DEFAULT_IMPACT_FACTS: ImpactModalFact[] = [
  {
    label: "Measured over",
    value:
      "The full lifecycle data currently attached to this product passport.",
  },
  {
    label: "How to read it",
    value:
      "Lower values indicate a smaller resource footprint for the same product.",
  },
];

export function ImpactModal({
  description = "This modal explains what the impact metric represents and how customers should interpret it in plain language.",
  equivalentLabel = "Equivalent to",
  equivalentValue = "Roughly the same carbon footprint as driving 28 km in an average passenger car.",
  facts = DEFAULT_IMPACT_FACTS,
  select,
  styles,
  subtitle = "Impact clarification",
  title = "Carbon emissions",
}: ImpactModalProps) {
  // Render a mock metric explainer using the shared title, description, label, and value slots.
  return (
    <DppModalContent styles={styles}>
      <DppModalSection>
        <DppModalSubtitle
          {...getModalSelectionProps(select, "modal.subtitle")}
          styles={styles}
        >
          {subtitle}
        </DppModalSubtitle>
        <DppModalTitle
          {...getModalSelectionProps(select, "modal.title")}
          styles={styles}
        >
          {title}
        </DppModalTitle>
      </DppModalSection>

      <DppModalDescription
        {...getModalSelectionProps(select, "modal.description")}
        styles={styles}
      >
        {description}
      </DppModalDescription>

      <DppModalSection className="gap-2">
        <DppModalValue
          {...getModalSelectionProps(select, "modal.label")}
          styles={styles}
          style={styles["modal.label"]}
        >
          {equivalentLabel}
        </DppModalValue>
        <DppModalValue
          {...getModalSelectionProps(select, "modal.value")}
          className="text-balance"
          styles={styles}
        >
          {equivalentValue}
        </DppModalValue>
      </DppModalSection>

      <DppModalSection>
        {facts.map((fact) => (
          <DppModalField
            key={fact.label}
            label={fact.label}
            labelProps={getModalSelectionProps(select, "modal.label")}
            styles={styles}
            value={fact.value}
            valueProps={getModalSelectionProps(select, "modal.value")}
          />
        ))}
      </DppModalSection>
    </DppModalContent>
  );
}
