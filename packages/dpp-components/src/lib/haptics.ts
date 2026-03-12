import { useWebHaptics } from "web-haptics/react";

export function useHapticTap() {
  const { trigger } = useWebHaptics();
  return () => trigger([{ duration: 50 }], { intensity: 0.8 });
}
