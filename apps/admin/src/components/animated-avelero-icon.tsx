"use client";

import dashboardAnimation from "@/animations/avelero-icon-animation.json";
import { cn } from "@v1/ui/cn";
import { LordIcon, type LottieRefCurrentProps } from "@v1/ui/lord-icon";
import { useRef } from "react";

interface AnimatedAveleroIconProps {
  size?: number;
  className?: string;
}

export function AnimatedAveleroIcon({
  size = 24,
  className,
}: AnimatedAveleroIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  const playAnimation = () => {
    lottieRef.current?.stop();
    lottieRef.current?.play();
  };

  const stopAnimation = () => {
    lottieRef.current?.stop();
  };

  return (
    <span
      className={cn("inline-flex items-center justify-center text-primary", className)}
      onMouseEnter={playAnimation}
      onMouseLeave={stopAnimation}
      aria-hidden="true"
    >
      <LordIcon
        animationData={dashboardAnimation}
        style={{ width: size, height: size }}
        loop={false}
        autoplay={false}
        lottieRef={lottieRef}
      />
    </span>
  );
}
