import { FeatureCards, FeatureCard } from "../feature-cards";
import { PassportMenu } from "./passport-menu";

/**
 * EXAMPLE USAGE - Delete this file after understanding the pattern
 * 
 * This shows how to use the feature card system with showcase components.
 * Overlapping is handled WITHIN each showcase component, not in the card.
 */
export function ExampleFeatureShowcase() {
  return (
    <FeatureCards>
      <FeatureCard
        title="Digital Product Passport"
        description="Track your product's journey and authenticity"
        backgroundImage="/your-background.webp"
      >
        <PassportMenu />
      </FeatureCard>

      <FeatureCard
        title="Another Feature"
        description="Description here"
        backgroundImage="/your-background.webp"
      >
        {/* Another showcase component would go here */}
      </FeatureCard>
    </FeatureCards>
  );
}

