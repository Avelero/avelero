"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Step {
  label: string;
  description: string;
  image: string;
}

const STEP_DURATION = 8000;

const DEFAULT_STEPS: Step[] = [
  {
    label: "Connect your data",
    description:
      "Integrate your ERP, PLM, or product sheets \u2014 we pull in materials, suppliers, and composition automatically.",
    image: "/connect-your-data.webp",
  },
  {
    label: "Estimate your footprint",
    description:
      "Our ML-powered LCA engine predicts carbon and water impact from your product data, even with minimal information.",
    image: "/calculate-your-footprint.webp",
  },
  {
    label: "Design your passport",
    description:
      "Build on-brand passports from modular sections. Set your own typography, colors, and layout \u2014 then reuse across your catalog.",
    image: "/design-your-passport.webp",
  },
  {
    label: "Publish and distribute",
    description:
      "Generate QR codes, connect to your e-commerce platform, and go live with digital product passports at scale.",
    image: "/publish-and-distribute.webp",
  },
];

export type { Step as StepCarouselStep };

export function StepCarousel({
  topTitle,
  bottomTitle,
  steps = DEFAULT_STEPS,
}: {
  topTitle: string;
  bottomTitle: string;
  steps?: Step[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef<number>(0);

  const goToStep = useCallback((index: number) => {
    setActiveIndex(index);
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(elapsed / STEP_DURATION, 1);
      setProgress(p);

      if (p >= 1) {
        const next = (activeIndex + 1) % steps.length;
        setActiveIndex(next);
        setProgress(0);
        startTimeRef.current = Date.now();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeIndex]);

  const titleBlock = (
    <h4 className="text-h6 md:text-h5 w-full">
      <span className="text-foreground">
        {topTitle}
        <br />
      </span>
      <span className="text-muted-foreground">{bottomTitle}</span>
    </h4>
  );

  const stepsBlock = (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={step.label}
            type="button"
            className="flex flex-col cursor-pointer text-left border-t border-border"
            onClick={() => goToStep(i)}
          >
            <div className="flex items-center justify-between w-full py-4">
              <span className="text-body text-muted-foreground relative">
                {step.label}
                {isActive && (
                  <span
                    className="absolute inset-0 text-foreground"
                    style={{
                      clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
                    }}
                    aria-hidden="true"
                  >
                    {step.label}
                  </span>
                )}
              </span>
              <span
                className={`text-body tabular-nums ${isActive ? "text-foreground" : "text-muted-foreground"}`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="pb-4 text-small text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const imageBlock = (
    <div className="relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-sm">
      {steps.map((step, i) => (
        <Image
          key={step.image}
          src={step.image}
          alt={step.label}
          fill
          loading={i === 0 ? "eager" : "lazy"}
          sizes="(max-width: 639px) calc(100vw - 3rem), (max-width: 767px) calc(100vw - 8rem), (max-width: 1279px) calc((100vw - 8rem - 2rem) / 2), 560px"
          className="object-cover transition-opacity duration-500"
          style={{ opacity: i === activeIndex ? 1 : 0 }}
          quality={90}
        />
      ))}
    </div>
  );

  return (
    <div className="flex md:flex-row flex-col w-full py-[45px] sm:py-[62px] gap-4 md:gap-8">
      {/* Desktop: title top-left, steps bottom-left (single column) */}
      <div className="hidden md:flex flex-col items-start justify-between flex-1">
        {titleBlock}
        {stepsBlock}
      </div>

      {/* Mobile: title, then image, then steps */}
      <div className="flex flex-col gap-4 md:hidden">
        {titleBlock}
      </div>

      <div className="flex flex-col items-start justify-between w-full md:w-1/2 flex-1">
        {imageBlock}
      </div>

      <div className="flex flex-col md:hidden">
        {stepsBlock}
      </div>
    </div>
  );
}
