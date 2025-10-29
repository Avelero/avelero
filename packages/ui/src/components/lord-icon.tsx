'use client';

import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';
import type { CSSProperties } from 'react';

interface LordIconProps {
  animationData: object; // The imported JSON
  loop?: boolean;
  autoplay?: boolean;
  style?: CSSProperties;
  className?: string;
  lottieRef?: React.RefObject<LottieRefCurrentProps | null>;
  onComplete?: () => void;
  onLoopComplete?: () => void;
}

/**
 * LordIcon - A wrapper component for Lottie animations from Lordicon
 * 
 * @example
 * ```tsx
 * import { LordIcon } from '@v1/ui/lord-icon';
 * import animationData from '@/public/animations/icon.json';
 * 
 * <LordIcon 
 *   animationData={animationData}
 *   style={{ width: 48, height: 48 }}
 * />
 * ```
 */
export function LordIcon({
  animationData,
  loop = true,
  autoplay = true,
  style,
  className,
  lottieRef,
  onComplete,
  onLoopComplete,
}: LordIconProps) {
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      style={style}
      className={`${className || ''} [&_path]:!fill-current [&_ellipse]:!stroke-current [&_path[stroke]]:!stroke-current`.trim()}
      lottieRef={lottieRef}
      onComplete={onComplete}
      onLoopComplete={onLoopComplete}
    />
  );
}

