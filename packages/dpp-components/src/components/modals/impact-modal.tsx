"use client";

/**
 * Mock impact clarification modal content.
 */

import {
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalField,
  ModalSection,
  ModalSubtitle,
  ModalTitle,
  ModalValue,
  getModalSelectionProps,
} from "../modal";
import type { ModalSelectionGetter, ModalStyles } from "../modal";

interface ImpactModalFact {
  label: string;
  value: string;
}

interface ImpactModalProps {
  description?: string;
  equivalentLabel?: string;
  equivalentValue?: string;
  facts?: ImpactModalFact[];
  select?: ModalSelectionGetter;
  styles: ModalStyles;
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
    <ModalContent styles={styles}>
      <ModalBody>
        <ModalSection>
          <ModalSubtitle
            {...getModalSelectionProps(select, "modal.subtitle")}
            styles={styles}
          >
            {subtitle}
          </ModalSubtitle>
          <ModalTitle
            {...getModalSelectionProps(select, "modal.title")}
            styles={styles}
          >
            {title}
          </ModalTitle>
        </ModalSection>

        <ModalDescription
          {...getModalSelectionProps(select, "modal.description")}
          styles={styles}
        >
          {description}
        </ModalDescription>

        <ModalSection className="gap-2">
          <ModalValue
            {...getModalSelectionProps(select, "modal.label")}
            styles={styles}
            style={styles["modal.label"]}
          >
            {equivalentLabel}
          </ModalValue>
          <ModalValue
            {...getModalSelectionProps(select, "modal.value")}
            className="text-balance"
            styles={styles}
          >
            {equivalentValue}
          </ModalValue>
        </ModalSection>

        <ModalSection>
          {facts.map((fact) => (
            <ModalField
              key={fact.label}
              label={fact.label}
              labelProps={getModalSelectionProps(select, "modal.label")}
              styles={styles}
              value={fact.value}
              valueProps={getModalSelectionProps(select, "modal.value")}
            />
          ))}
        </ModalSection>
      </ModalBody>
    </ModalContent>
  );
}
