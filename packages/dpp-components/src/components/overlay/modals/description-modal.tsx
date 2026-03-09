"use client";

/**
 * Description modal content for expanded product storytelling.
 */

import {
  DppModalContent,
  DppModalDescription,
  DppModalSection,
  DppModalSubtitle,
  DppModalTitle,
  getModalSelectionProps,
} from "./modal-building-blocks";
import type {
  DppModalSelectionGetter,
  DppModalStyles,
} from "./modal-building-blocks";

interface DescriptionModalProps {
  description: string;
  manufacturerName?: string;
  productTitle?: string;
  select?: DppModalSelectionGetter;
  styles: DppModalStyles;
}

export function DescriptionModal({
  description,
  manufacturerName,
  productTitle,
  select,
  styles,
}: DescriptionModalProps) {
  // Render the product narrative modal with dedicated title, subtitle, and body slots.
  return (
    <DppModalContent styles={styles}>
      <DppModalSection>
        {manufacturerName ? (
          <DppModalSubtitle
            {...getModalSelectionProps(select, "modal.subtitle")}
            styles={styles}
          >
            {manufacturerName}
          </DppModalSubtitle>
        ) : null}

        {productTitle ? (
          <DppModalTitle
            {...getModalSelectionProps(select, "modal.title")}
            styles={styles}
          >
            {productTitle}
          </DppModalTitle>
        ) : null}
      </DppModalSection>

      <DppModalDescription
        {...getModalSelectionProps(select, "modal.description")}
        asChild
        styles={styles}
      >
        <div>{description}</div>
      </DppModalDescription>
    </DppModalContent>
  );
}
