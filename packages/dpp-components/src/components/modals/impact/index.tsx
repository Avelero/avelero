"use client";

/**
 * Impact comparison modal.
 *
 * Translates raw environmental metrics (carbon, water) into relatable
 * everyday equivalents using Phosphor icons and the shared modal primitives.
 * Conversion factors sourced from the EEA, IEA, and EPA.
 */

import type { Icon } from "@phosphor-icons/react";
import { BathtubIcon } from "@phosphor-icons/react/dist/ssr/Bathtub";
import { CarIcon } from "@phosphor-icons/react/dist/ssr/Car";
import { CoffeeIcon } from "@phosphor-icons/react/dist/ssr/Coffee";
import { DropIcon } from "@phosphor-icons/react/dist/ssr/Drop";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr/Leaf";
import { LightningIcon } from "@phosphor-icons/react/dist/ssr/Lightning";
import { MonitorPlayIcon } from "@phosphor-icons/react/dist/ssr/MonitorPlay";
import { ShowerIcon } from "@phosphor-icons/react/dist/ssr/Shower";
import { TShirtIcon } from "@phosphor-icons/react/dist/ssr/TShirt";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useHapticTap } from "../../../lib/haptics";
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

// ─── Constants ──────────────────────────────────────────────────────────────

const SURFACE_CARD_SHADOW =
  "0 4px 4px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.62)";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ComparisonResult {
  value: string;
  unit: string;
}

interface ComparisonItem {
  icon: Icon;
  label: string;
  compute: (value: number) => ComparisonResult;
}

export interface ImpactMetric {
  type: string;
  value: number;
  unit: string;
}

export interface ImpactCardStyles {
  type?: React.CSSProperties;
  value?: React.CSSProperties;
  unit?: React.CSSProperties;
}

interface ImpactModalProps {
  cardStyles?: ImpactCardStyles;
  metrics: ImpactMetric[];
  select?: ModalSelectionGetter;
  styles: ModalStyles;
  subtitle?: string;
  title?: string;
}

// ─── Comparison definitions ─────────────────────────────────────────────────

type MetricCategory = "carbon" | "water";

const COMPARISONS: Record<MetricCategory, ComparisonItem[]> = {
  carbon: [
    {
      icon: CarIcon,
      label: "Driving a car",
      compute: (kg) => ({
        value: `${Math.round(kg / 0.121)}`,
        unit: "kilometers",
      }),
    },
    {
      icon: MonitorPlayIcon,
      label: "Streaming video",
      compute: (kg) => ({
        value: `${Math.round(kg / 0.036)}`,
        unit: "hours",
      }),
    },
    {
      icon: LightningIcon,
      label: "Charging phones",
      compute: (kg) => ({
        value: `${Math.round(kg / 0.008).toLocaleString()}`,
        unit: "charges",
      }),
    },
    {
      icon: CoffeeIcon,
      label: "Cups of coffee",
      compute: (kg) => ({
        value: `${Math.round(kg / 0.21)}`,
        unit: "cups",
      }),
    },
  ],
  water: [
    {
      icon: ShowerIcon,
      label: "Taking showers",
      compute: (l) => ({
        value: `${Math.round(l / 65)}`,
        unit: "showers",
      }),
    },
    {
      icon: BathtubIcon,
      label: "Filling bathtubs",
      compute: (l) => ({
        value: `${Math.round(l / 150)}`,
        unit: "baths",
      }),
    },
    {
      icon: TShirtIcon,
      label: "Washing clothes",
      compute: (l) => ({
        value: `${Math.round(l / 50)}`,
        unit: "loads",
      }),
    },
    {
      icon: DropIcon,
      label: "Glasses of water",
      compute: (l) => ({
        value: `${Math.round(l / 0.25).toLocaleString()}`,
        unit: "glasses",
      }),
    },
  ],
};

const TAB_CONFIG: Record<
  MetricCategory,
  { icon: Icon; label: string; iconColor: string }
> = {
  carbon: { icon: LeafIcon, label: "Carbon", iconColor: "#10A651" },
  water: { icon: DropIcon, label: "Water", iconColor: "#1616F3" },
};

const CATEGORY_MATCHERS: { pattern: RegExp; category: MetricCategory }[] = [
  { pattern: /carbon/i, category: "carbon" },
  { pattern: /water/i, category: "water" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectCategory(type: string): MetricCategory | null {
  for (const { pattern, category } of CATEGORY_MATCHERS) {
    if (pattern.test(type)) return category;
  }
  return null;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ComparisonCard({
  item,
  value,
  cardStyles,
  isLast,
}: {
  item: ComparisonItem;
  value: number;
  cardStyles: ImpactCardStyles;
  isLast: boolean;
}) {
  const IconComponent = item.icon;
  const result = item.compute(value);

  return (
    <div
      className="flex items-center gap-md py-sm"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--border, #E8E9EC)",
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{
          borderRadius: "4px",
          border: "1px solid var(--border, #E8E9EC)",
        }}
      >
        <IconComponent
          weight="fill"
          className="h-5 w-5"
          style={{ color: "var(--foreground, #1E2040)" }}
          aria-hidden="true"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-micro">
        <div style={cardStyles.type}>{item.label}</div>
        <div className="flex flex-wrap items-baseline gap-micro">
          <div style={cardStyles.value}>{result.value}</div>
          <div style={cardStyles.unit}>{result.unit}</div>
        </div>
      </div>
    </div>
  );
}

function TabGroup({
  categories,
  activeTab,
  onTabChange,
}: {
  categories: { category: MetricCategory }[];
  activeTab: MetricCategory;
  onTabChange: (category: MetricCategory) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<MetricCategory, HTMLButtonElement>>(new Map());
  const [pressedCategory, setPressedCategory] = useState<MetricCategory | null>(
    null,
  );
  const ready = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const indicatorPressed = pressedCategory === activeTab;

  // Measure the active button and set CSS custom properties on the container.
  useLayoutEffect(() => {
    const button = buttonRefs.current.get(activeTab);
    const container = containerRef.current;
    if (!button || !container) return;
    container.style.setProperty(
      "--tab-indicator-left",
      `${button.offsetLeft}px`,
    );
    container.style.setProperty(
      "--tab-indicator-width",
      `${button.offsetWidth}px`,
    );
  }, [activeTab]);

  // Enable transitions only after the first paint so the indicator doesn't
  // animate from 0,0 when the modal opens.
  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(() => setIsReady(true));
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex gap-xs"
      style={
        {
          "--tab-indicator-left": "0px",
          "--tab-indicator-width": "0px",
        } as React.CSSProperties
      }
    >
      {/* Sliding pill indicator */}
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: "var(--tab-indicator-left)",
          width: "var(--tab-indicator-width)",
          backgroundColor: "var(--card, #FFFFFF)",
          boxShadow: SURFACE_CARD_SHADOW,
          transform: indicatorPressed ? "scale(0.98)" : "scale(1)",
          transition: isReady
            ? "left 200ms ease-in-out, width 200ms ease-in-out, transform 100ms ease-in-out"
            : "none",
          pointerEvents: "none",
        }}
      />
      {categories.map(({ category }) => {
        const config = TAB_CONFIG[category];
        const active = activeTab === category;
        const IconComponent = config.icon;
        return (
          <button
            key={category}
            ref={(el) => {
              if (el) buttonRefs.current.set(category, el);
            }}
            type="button"
            onClick={() => onTabChange(category)}
            onPointerDown={() => setPressedCategory(category)}
            onPointerUp={() => setPressedCategory(null)}
            onPointerLeave={() => setPressedCategory(null)}
            className="relative z-[1] inline-flex cursor-pointer items-center gap-xs rounded-full border-none bg-transparent px-md py-xs text-sm font-semibold"
            style={{
              color: active
                ? "var(--foreground, #1E2040)"
                : "var(--muted-light-foreground, #62637A)",
              transform:
                pressedCategory === category && active
                  ? "scale(0.98)"
                  : "scale(1)",
              transition:
                "color 100ms ease-in-out, transform 100ms ease-in-out",
            }}
          >
            <IconComponent
              weight={active ? "fill" : "regular"}
              className="h-4 w-4"
              style={{
                color: active
                  ? config.iconColor
                  : "var(--muted-light-foreground, #62637A)",
                transition: "color 100ms ease-in-out",
              }}
              aria-hidden="true"
            />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sources ────────────────────────────────────────────────────────────────

const SOURCES = [
  { label: "EEA", href: "https://eea.europa.eu" },
  { label: "IEA", href: "https://iea.org" },
  { label: "EPA", href: "https://epa.gov" },
] as const;

// ─── Fallback card styles ───────────────────────────────────────────────────

const FALLBACK_CARD_STYLES: ImpactCardStyles = {
  type: { color: "var(--muted-light-foreground, #62637A)" },
  value: {
    color: "var(--card-foreground, var(--foreground, #1E2040))",
    fontWeight: 500,
    lineHeight: 1,
  },
  unit: { color: "var(--muted-light-foreground, #62637A)" },
};

// ─── Main component ─────────────────────────────────────────────────────────

export function ImpactModal({
  cardStyles,
  metrics,
  select,
  styles,
  subtitle = "Impact explained",
  title = "What do these numbers mean?",
}: ImpactModalProps) {
  // Resolve which metric categories are available from the supplied data.
  const availableCategories: {
    category: MetricCategory;
    metric: ImpactMetric;
  }[] = [];
  for (const metric of metrics) {
    const category = detectCategory(metric.type);
    if (category && COMPARISONS[category]) {
      availableCategories.push({ category, metric });
    }
  }

  const [activeTab, setActiveTab] = useState<MetricCategory>(
    availableCategories[0]?.category ?? "carbon",
  );
  const hapticTap = useHapticTap();
  const scrollRef = useRef<HTMLDivElement>(null);

  const activePair = availableCategories.find(
    (pair) => pair.category === activeTab,
  );
  const activeMetric = activePair?.metric;
  const activeComparisons = COMPARISONS[activeTab] ?? [];
  const showTabs = availableCategories.length > 1;
  const resolvedCardStyles = cardStyles ?? FALLBACK_CARD_STYLES;

  const handleTabChange = useCallback(
    (category: MetricCategory) => {
      const scrollEl = scrollRef.current;
      const prevScrollTop = scrollEl?.scrollTop ?? 0;
      hapticTap();
      setActiveTab(category);
      // Restore scroll position after React re-renders the card list.
      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop = prevScrollTop;
        }
      });
    },
    [hapticTap],
  );

  return (
    <ModalContent styles={styles}>
      <ModalBody ref={scrollRef}>
        {/* Header */}
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

        {/* Intro */}
        <ModalDescription
          {...getModalSelectionProps(select, "modal.description")}
          styles={styles}
        >
          {activeMetric
            ? `To help you understand this product\u2019s footprint, here\u2019s what ${activeMetric.value} ${activeMetric.unit} of ${activeTab === "carbon" ? "carbon emissions" : "water usage"} looks like in everyday terms.`
            : "To help you understand this product\u2019s environmental footprint, here\u2019s what the numbers mean in everyday terms."}
        </ModalDescription>

        {/* Tabs */}
        {showTabs && (
          <TabGroup
            categories={availableCategories}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        )}

        {/* Comparison cards */}
        {activeMetric && (
          <div className="flex flex-col">
            {activeComparisons.map((item, i) => (
              <ComparisonCard
                key={item.label}
                item={item}
                value={activeMetric.value}
                cardStyles={resolvedCardStyles}
                isLast={i === activeComparisons.length - 1}
              />
            ))}
          </div>
        )}

        {/* Separator + disclaimer */}
        <div
          className="border-t pt-md"
          style={{ borderColor: "var(--border, #E8E9EC)" }}
        >
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--muted-light-foreground, #62637A)" }}
          >
            These comparisons are approximate and meant to help you
            contextualize impact. Estimates based on data from the{" "}
            {SOURCES.map((source, i) => (
              <span key={source.label}>
                {i > 0 && (i === SOURCES.length - 1 ? ", and " : ", ")}
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "var(--link, #0000FF)" }}
                >
                  {source.label}
                </a>
              </span>
            ))}
            .
          </p>
        </div>
      </ModalBody>
    </ModalContent>
  );
}
