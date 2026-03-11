"use client";

/**
 * Description modal content for expanded product storytelling.
 */

import {
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalSection,
  ModalSubtitle,
  ModalTitle,
  getModalSelectionProps,
} from "../../modal";
import type { ModalSelectionGetter, ModalStyles } from "../../modal";

interface DescriptionModalProps {
  description: string;
  manufacturerName?: string;
  productTitle?: string;
  select?: ModalSelectionGetter;
  styles: ModalStyles;
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
    <ModalContent styles={styles}>
      <ModalBody>
        <ModalSection>
          {manufacturerName ? (
            <ModalSubtitle
              {...getModalSelectionProps(select, "modal.subtitle")}
              styles={styles}
            >
              {manufacturerName}
            </ModalSubtitle>
          ) : null}

          {productTitle ? (
            <ModalTitle
              {...getModalSelectionProps(select, "modal.title")}
              styles={styles}
            >
              {productTitle}
            </ModalTitle>
          ) : null}
        </ModalSection>

        <ModalDescription
          {...getModalSelectionProps(select, "modal.description")}
          asChild
          styles={styles}
        >
          <div>{description}</div>
        </ModalDescription>
      </ModalBody>
    </ModalContent>
  );
}
